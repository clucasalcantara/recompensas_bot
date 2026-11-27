import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { balances, type Owner } from "./domain/ledger.js";
import { decodeScene, encodeScene } from "./domain/scene.js";
import type { RewardKind } from "./domain/rules.js";
import type { Preference } from "./domain/prefs.js";
import type { LedgerEvent, Redemption, Session, Store } from "./store.js";

type SessionRow = {
  id: number | string;
  minutes: number;
  note: string | null;
  actor_name: string;
  user_id: number | string;
  created_at: Date | string;
};

type RedemptionRow = SessionRow & { kind: RewardKind };

const SCHEMA = readSchema();

function readSchema(): string {
  const dirs = [
    join(process.cwd(), "sql"),
    join(dirname(fileURLToPath(import.meta.url)), "../sql"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    if (files.length === 0) continue;
    return files.map((file) => readFileSync(join(dir, file), "utf8")).join("\n");
  }
  throw new Error("Não achei sql/001_init.sql");
}

export async function openStore(
  databaseUrl: string,
  people: { giUserId: number | null } = { giUserId: null },
): Promise<Store> {
  const pool = new Pool({ connectionString: forPg(databaseUrl), max: 3 });
  pool.on("error", (error: Error) => {
    console.error(error);
  });
  await applySchema(databaseUrl);
  return bind(pool, people);
}

export function forPg(databaseUrl: string, direct = false): string {
  const url = new URL(databaseUrl);
  if (direct) url.hostname = url.hostname.replace("-pooler", "");
  url.searchParams.delete("channel_binding");
  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}

async function applySchema(databaseUrl: string): Promise<void> {
  try {
    await runSchema(forPg(databaseUrl, true));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await runSchema(forPg(databaseUrl, false));
  }
}

async function runSchema(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(SCHEMA);
  } finally {
    await pool.end();
  }
}

function bind(pool: Pool, people: { giUserId: number | null }): Store {
  const ownerOf = (userId: number): Owner =>
    people.giUserId !== null && userId === people.giUserId ? "gi" : "lucas";

  return {
    async balances() {
      const sessions = await this.listSessions();
      return balances(
        sessions.map((session) => ({ minutes: session.minutes, owner: ownerOf(session.userId) })),
        await this.listRedemptions(),
      );
    },
    async listSessions() {
      const result = await pool.query<SessionRow>(
        `SELECT id, minutes, note, actor_name, user_id, created_at
         FROM sessions ORDER BY id ASC`,
      );
      return result.rows.map(toSession);
    },
    async listRedemptions() {
      const result = await pool.query<RedemptionRow>(
        `SELECT id, kind, minutes, actor_name, user_id, created_at
         FROM redemptions ORDER BY id ASC`,
      );
      return result.rows.map(toRedemption);
    },
    async recent(limit) {
      const sessions = (await this.listSessions()).map(
        (session): LedgerEvent => ({ type: "session", at: session.createdAt, session }),
      );
      const redemptions = (await this.listRedemptions()).map(
        (redemption): LedgerEvent => ({
          type: "redemption",
          at: redemption.createdAt,
          redemption,
        }),
      );
      return [...sessions, ...redemptions]
        .sort((a, b) => b.at.localeCompare(a.at) || eventId(b) - eventId(a))
        .slice(0, limit);
    },
    async addSession(input) {
      const result = await pool.query<SessionRow>(
        `INSERT INTO sessions (minutes, note, actor_name, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, minutes, note, actor_name, user_id, created_at`,
        [input.minutes, input.note, input.actorName, input.userId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Não gravou a escada.");
      return toSession(row);
    },
    async addRedemption(input) {
      const result = await pool.query<RedemptionRow>(
        `INSERT INTO redemptions (kind, minutes, actor_name, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, kind, minutes, actor_name, user_id, created_at`,
        [input.kind, input.minutes, input.actorName, input.userId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Não gravou a coleta.");
      return toRedemption(row);
    },
    async lastEvent() {
      return (await this.recent(1))[0] ?? null;
    },
    async deleteSession(id) {
      await pool.query(`DELETE FROM sessions WHERE id = $1`, [id]);
    },
    async deleteRedemption(id) {
      await pool.query(`DELETE FROM redemptions WHERE id = $1`, [id]);
    },
    async rememberChat(chatId) {
      await setMeta(pool, "reminder_chat_id", String(chatId));
    },
    async getReminderChat() {
      const raw = await getMeta(pool, "reminder_chat_id");
      if (!raw) return null;
      const value = Number(raw);
      return Number.isInteger(value) ? value : null;
    },
    async getLastReminderDate() {
      return getMeta(pool, "last_reminder_on");
    },
    async setLastReminderDate(date) {
      await setMeta(pool, "last_reminder_on", date);
    },
    async listPreferences() {
      const result = await pool.query<PreferenceRow>(
        `SELECT id, user_id, owner, about, kind, note, question
         FROM preferences ORDER BY id ASC`,
      );
      return result.rows.map(toPreference);
    },
    async addPreference(input) {
      const existing = await pool.query<PreferenceRow>(
        `SELECT id, user_id, owner, about, kind, note, question
         FROM preferences
         WHERE user_id = $1 AND about = $2 AND kind = $3 AND lower(note) = lower($4)
         LIMIT 1`,
        [input.userId, input.about, input.kind, input.note],
      );
      const found = existing.rows[0];
      if (found) return { preference: toPreference(found), fresh: false };
      const result = await pool.query<PreferenceRow>(
        `INSERT INTO preferences (user_id, owner, about, kind, note, question)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, user_id, owner, about, kind, note, question`,
        [input.userId, input.owner, input.about, input.kind, input.note, input.question],
      );
      const row = result.rows[0];
      if (!row) throw new Error("Não gravou a preferência.");
      return { preference: toPreference(row), fresh: true };
    },
    async getPendingPref(userId) {
      return getMeta(pool, `pref_ask:${userId}`);
    },
    async setPendingPref(userId, questionId) {
      const key = `pref_ask:${userId}`;
      if (!questionId) {
        await pool.query(`DELETE FROM meta WHERE key = $1`, [key]);
        return;
      }
      await setMeta(pool, key, questionId);
    },
    async addMessage(input) {
      const text = input.text.trim().slice(0, 2000);
      if (!text) return;
      await pool.query(
        `INSERT INTO messages (chat_id, user_id, name, role, text) VALUES ($1, $2, $3, $4, $5)`,
        [input.chatId, input.userId, input.name.slice(0, 80), input.role, text],
      );
      await pool.query(
        `DELETE FROM messages WHERE chat_id = $1 AND id NOT IN (
           SELECT id FROM messages WHERE chat_id = $1 ORDER BY id DESC LIMIT 400
         )`,
        [input.chatId],
      );
    },
    async recentMessages(chatId, limit) {
      const result = await pool.query<{ name: string; role: "user" | "bot"; text: string }>(
        `SELECT name, role, text FROM messages WHERE chat_id = $1 ORDER BY id DESC LIMIT $2`,
        [chatId, limit],
      );
      return result.rows.reverse();
    },
    async getScene(chatId) {
      return decodeScene(await getMeta(pool, `scene:${chatId}`));
    },
    async setScene(chatId, scene) {
      const key = `scene:${chatId}`;
      const raw = encodeScene(scene);
      if (!raw) {
        await pool.query(`DELETE FROM meta WHERE key = $1`, [key]);
        return;
      }
      await setMeta(pool, key, raw);
    },
  };
}

type PreferenceRow = {
  id: number | string;
  user_id: number | string;
  owner: Preference["owner"];
  about: Preference["about"];
  kind: Preference["kind"];
  note: string;
  question: string | null;
};

async function setMeta(pool: Pool, key: string, value: string): Promise<void> {
  await pool.query(
    `INSERT INTO meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}

async function getMeta(pool: Pool, key: string): Promise<string | null> {
  const result = await pool.query<{ value: string }>(`SELECT value FROM meta WHERE key = $1`, [
    key,
  ]);
  return result.rows[0]?.value ?? null;
}

function toSession(row: SessionRow): Session {
  return {
    id: Number(row.id),
    minutes: row.minutes,
    note: row.note,
    actorName: row.actor_name,
    userId: Number(row.user_id),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toRedemption(row: RedemptionRow): Redemption {
  return { ...toSession(row), kind: row.kind };
}

function toPreference(row: PreferenceRow): Preference {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    owner: row.owner,
    about: row.about,
    kind: row.kind,
    note: row.note,
    question: row.question,
  };
}

function eventId(event: LedgerEvent): number {
  return event.type === "session" ? event.session.id : event.redemption.id;
}
