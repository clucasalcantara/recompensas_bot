import { balances } from "./domain/ledger.js";
import type { LedgerEvent, Redemption, Session, Store } from "./store.js";

export function createMemoryStore(): Store {
  const sessions: Session[] = [];
  const redemptions: Redemption[] = [];
  const meta = new Map<string, string>();
  let nextId = 1;

  return {
    async balances() {
      return balances(sessions, redemptions);
    },
    async listSessions() {
      return [...sessions];
    },
    async listRedemptions() {
      return [...redemptions];
    },
    async recent(limit) {
      const events: LedgerEvent[] = [
        ...sessions.map((session): LedgerEvent => ({
          type: "session",
          at: session.createdAt,
          session,
        })),
        ...redemptions.map((redemption): LedgerEvent => ({
          type: "redemption",
          at: redemption.createdAt,
          redemption,
        })),
      ];
      return events
        .sort((a, b) => b.at.localeCompare(a.at) || eventId(b) - eventId(a))
        .slice(0, limit);
    },
    async addSession(input) {
      const session: Session = {
        id: nextId++,
        minutes: input.minutes,
        note: input.note,
        actorName: input.actorName,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      };
      sessions.push(session);
      return session;
    },
    async addRedemption(input) {
      const redemption: Redemption = {
        id: nextId++,
        kind: input.kind,
        minutes: input.minutes,
        actorName: input.actorName,
        userId: input.userId,
        createdAt: new Date().toISOString(),
      };
      redemptions.push(redemption);
      return redemption;
    },
    async lastEvent() {
      return (await this.recent(1))[0] ?? null;
    },
    async deleteSession(id) {
      const index = sessions.findIndex((session) => session.id === id);
      if (index >= 0) sessions.splice(index, 1);
    },
    async deleteRedemption(id) {
      const index = redemptions.findIndex((redemption) => redemption.id === id);
      if (index >= 0) redemptions.splice(index, 1);
    },
    async rememberChat(chatId) {
      meta.set("reminder_chat_id", String(chatId));
    },
    async getReminderChat() {
      const raw = meta.get("reminder_chat_id");
      if (!raw) return null;
      const value = Number(raw);
      return Number.isInteger(value) ? value : null;
    },
    async getLastReminderDate() {
      return meta.get("last_reminder_on") ?? null;
    },
    async setLastReminderDate(date) {
      meta.set("last_reminder_on", date);
    },
  };
}

function eventId(event: LedgerEvent): number {
  return event.type === "session" ? event.session.id : event.redemption.id;
}
