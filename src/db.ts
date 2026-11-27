import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { balances } from "./domain/ledger.js";
import type { RewardKind } from "./domain/rules.js";
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

const SCHEMA = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../sql/001_init.sql"),
  "utf8",
);

export async function openStore(databaseUrl: string): Promise<Store> {
  const pool = new Pool({ connectionString: forPg(databaseUrl), max: 3 });
  pool.on("error", (error: Error) => {
    console.error(error);
  });
  await applySchema(databaseUrl);
  return bind(pool);
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

function bind(pool: Pool): Store {
  return {
    async balances() {
      return balances(await this.listSessions(), await this.listRedemptions());
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
  };
}

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

function eventId(event: LedgerEvent): number {
  return event.type === "session" ? event.session.id : event.redemption.id;
}
