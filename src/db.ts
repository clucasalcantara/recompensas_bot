import { readdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { balances, type Owner } from "./domain/ledger.js";
import { decodeScene, encodeScene } from "./domain/scene.js";
import type { RewardKind } from "./domain/rules.js";
import type { Preference } from "./domain/prefs.js";
import { isStoryTopic, type Story } from "./domain/story.js";
import { emptyMesa, type ContentHit, type LedgerEvent, type Mesa, type Redemption, type Session, type Store } from "./store.js";

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
    async deletePreference(id) {
      await pool.query(`DELETE FROM preferences WHERE id = $1`, [id]);
    },
    async listStories() {
      const result = await pool.query<StoryRow>(
        `SELECT id, user_id, owner, topic, note, created_at
         FROM stories ORDER BY id ASC`,
      );
      return result.rows.flatMap((row) => {
        const story = toStory(row);
        return story ? [story] : [];
      });
    },
    async addStory(input) {
      const existing = await pool.query<StoryRow>(
        `SELECT id, user_id, owner, topic, note, created_at
         FROM stories
         WHERE owner = $1 AND topic = $2 AND lower(note) = lower($3)
         LIMIT 1`,
        [input.owner, input.topic, input.note],
      );
      const found = existing.rows[0];
      const already = found ? toStory(found) : null;
      if (already) return { story: already, fresh: false };
      const result = await pool.query<StoryRow>(
        `INSERT INTO stories (user_id, owner, topic, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, owner, topic, note, created_at`,
        [input.userId, input.owner, input.topic, input.note],
      );
      const row = result.rows[0];
      const story = row ? toStory(row) : null;
      if (!story) throw new Error("Não gravou a nota.");
      return { story, fresh: true };
    },
    async deleteStory(id) {
      await pool.query(`DELETE FROM stories WHERE id = $1`, [id]);
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
    async searchContent(input) {
      const limit = input.limit ?? 3;
      const withKind = await searchCards(pool, input.level, input.kind ?? null, input.embedding, limit);
      if (withKind.length > 0 || !input.kind) return withKind;
      return searchCards(pool, input.level, null, input.embedding, limit);
    },
    async close() {
      await pool.end();
    },
    async updateMesa(change) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await readMesa(client);
        change(current);
        await client.query(
          `UPDATE mesa SET
             heat = $1, kind = $2, phase = $3, actor = $4, cara = $5,
             title = $6, line = $7, offline = $8, lucas_seen = $9, gi_seen = $10,
             turn = $11, updated_at = now()
           WHERE id = 1`,
          [
            current.heat,
            current.kind,
            current.phase,
            current.actor,
            current.cara,
            current.title,
            current.line,
            current.offline,
            current.lucasSeen,
            current.giSeen,
            current.turn,
          ],
        );
        await client.query("COMMIT");
        return { ...current };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async claimUpdate(updateId) {
      const key = `upd:${updateId}`;
      const result = await pool.query(
        `INSERT INTO meta (key, value) VALUES ($1, '1')
         ON CONFLICT (key) DO NOTHING
         RETURNING key`,
        [key],
      );
      const claimed = (result.rowCount ?? 0) > 0;
      if (claimed && updateId % 40 === 0) {
        try {
          await pool.query(
            `DELETE FROM meta
             WHERE key LIKE 'upd:%'
               AND substring(key from 5) ~ '^[0-9]+$'
               AND substring(key from 5)::bigint < $1`,
            [Math.max(0, updateId - 200)],
          );
        } catch (error) {
          console.error(error instanceof Error ? error.message : error);
        }
      }
      return claimed;
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

type StoryRow = {
  id: number | string;
  user_id: number | string;
  owner: Story["owner"];
  topic: string;
  note: string;
  created_at: Date | string;
};

function toStory(row: StoryRow): Story | null {
  if (!isStoryTopic(row.topic)) return null;
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    owner: row.owner,
    topic: row.topic,
    note: row.note,
    createdAt: new Date(row.created_at).toISOString(),
  };
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

const CONTENT_FILTER = `
  content_status IN ('approved', 'active')
  AND intensity_level = $1
  AND (
    ($1 = 1 AND sexual_content = 'none')
    OR ($1 = 2 AND sexual_content <> 'explicit')
    OR ($1 = 3 AND sexual_content = 'explicit')
  )
  AND ($2::text IS NULL OR interaction_type = $2)
`;

type ContentRow = {
  id: string;
  direction: string;
  intensity_level: number;
  sexual_content: ContentHit["sexualContent"];
  interaction_type: string;
  distance: number | string;
};

type MesaRow = {
  heat: number;
  kind: string | null;
  phase: string;
  actor: string | null;
  cara: string | null;
  turn: string | null;
  title: string | null;
  line: string | null;
  offline: boolean;
  lucas_seen: number | string | null;
  gi_seen: number | string | null;
};

async function readMesa(client: Pick<Pool, "query">): Promise<Mesa> {
  await client.query(`INSERT INTO mesa (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
  const result = await client.query<MesaRow>(
    `SELECT heat, kind, phase, actor, cara, title, line, offline, lucas_seen, gi_seen, turn
     FROM mesa WHERE id = 1 FOR UPDATE`,
  );
  const row = result.rows[0];
  if (!row) return emptyMesa();
  const phase = row.phase === "role" || row.phase === "writing" || row.phase === "card" ? row.phase : "idle";
  return {
    heat: row.heat === 2 || row.heat === 3 ? row.heat : 1,
    kind: row.kind,
    phase,
    actor: row.actor === "lucas" || row.actor === "gi" ? row.actor : null,
    cara: row.cara === "lucas" || row.cara === "gi" ? row.cara : null,
    turn: row.turn === "lucas" || row.turn === "gi" ? row.turn : null,
    title: row.title,
    line: row.line,
    offline: row.offline,
    lucasSeen: seenOf(row.lucas_seen),
    giSeen: seenOf(row.gi_seen),
  };
}

function seenOf(value: number | string | null): number | null {
  if (value === null) return null;
  const seen = Number(value);
  return Number.isFinite(seen) ? seen : null;
}

async function searchCards(
  pool: Pool,
  level: 1 | 2 | 3,
  kind: string | null,
  embedding: number[],
  limit: number,
): Promise<ContentHit[]> {
  const result = await pool.query<ContentRow>(
    `SELECT id, direction, intensity_level, sexual_content, interaction_type,
            embedding <=> $3::vector AS distance
     FROM content_cards
     WHERE ${CONTENT_FILTER}
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [level, kind, vectorLiteral(embedding), limit],
  );
  return result.rows.flatMap((row) => {
    if (row.intensity_level !== 1 && row.intensity_level !== 2 && row.intensity_level !== 3) return [];
    return [
      {
        id: row.id,
        direction: row.direction,
        intensityLevel: row.intensity_level,
        sexualContent: row.sexual_content,
        interactionType: row.interaction_type,
        distance: Number(row.distance),
      },
    ];
  });
}

export type ContentCardWrite = {
  id: string;
  direction: string;
  intensityLevel: number;
  emotionalDepth: string;
  sexualContent: string;
  interactionType: string;
  romanticIntensity: string;
  requiresMutual: boolean;
  sourceReference: string;
  sourceUrl: string | null;
  origin: string;
  embedding: number[];
};

export async function upsertContentCards(databaseUrl: string, cards: ContentCardWrite[]): Promise<number> {
  const pool = new Pool({ connectionString: forPg(databaseUrl), max: 1 });
  try {
    for (const card of cards) {
      await pool.query(
        `INSERT INTO content_cards (
           id, direction, intensity_level, emotional_depth, sexual_content, interaction_type,
           romantic_intensity, requires_mutual, source_reference, source_url, content_status, origin, embedding
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12::vector)
         ON CONFLICT (id) DO UPDATE SET
           direction = EXCLUDED.direction,
           intensity_level = EXCLUDED.intensity_level,
           emotional_depth = EXCLUDED.emotional_depth,
           sexual_content = EXCLUDED.sexual_content,
           interaction_type = EXCLUDED.interaction_type,
           romantic_intensity = EXCLUDED.romantic_intensity,
           requires_mutual = EXCLUDED.requires_mutual,
           source_reference = EXCLUDED.source_reference,
           source_url = EXCLUDED.source_url,
           content_status = 'active',
           origin = EXCLUDED.origin,
           embedding = EXCLUDED.embedding`,
        [
          card.id,
          card.direction,
          card.intensityLevel,
          card.emotionalDepth,
          card.sexualContent,
          card.interactionType,
          card.romanticIntensity,
          card.requiresMutual,
          card.sourceReference,
          card.sourceUrl,
          card.origin,
          vectorLiteral(card.embedding),
        ],
      );
    }
    return cards.length;
  } finally {
    await pool.end();
  }
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
