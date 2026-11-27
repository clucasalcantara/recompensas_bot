import { balances, type Owner } from "./domain/ledger.js";
import { decodeScene, encodeScene } from "./domain/scene.js";
import type { Preference } from "./domain/prefs.js";
import type { ChatLine, LedgerEvent, Redemption, Session, Store } from "./store.js";

export function createMemoryStore(people: { giUserId?: number | null } = {}): Store {
  const giUserId = people.giUserId ?? null;
  const sessions: Session[] = [];
  const redemptions: Redemption[] = [];
  const preferences: Preference[] = [];
  const messages: { chatId: number; name: string; role: "user" | "bot"; text: string }[] = [];
  const meta = new Map<string, string>();
  let nextId = 1;

  return {
    async balances() {
      return balances(
        sessions.map((session) => ({
          minutes: session.minutes,
          owner: (giUserId !== null && session.userId === giUserId ? "gi" : "lucas") as Owner,
        })),
        redemptions,
      );
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
    async listPreferences() {
      return [...preferences];
    },
    async addPreference(input) {
      const existing = preferences.find(
        (item) =>
          item.userId === input.userId &&
          item.about === input.about &&
          item.kind === input.kind &&
          item.note.toLowerCase() === input.note.toLowerCase(),
      );
      if (existing) return { preference: existing, fresh: false };
      const preference: Preference = { id: nextId++, ...input };
      preferences.push(preference);
      return { preference, fresh: true };
    },
    async getPendingPref(userId) {
      return meta.get(`pref_ask:${userId}`) ?? null;
    },
    async setPendingPref(userId, questionId) {
      const key = `pref_ask:${userId}`;
      if (!questionId) meta.delete(key);
      else meta.set(key, questionId);
    },
    async addMessage(input) {
      const text = input.text.trim().slice(0, 2000);
      if (!text) return;
      messages.push({ chatId: input.chatId, name: input.name, role: input.role, text });
      const own = messages.filter((line) => line.chatId === input.chatId);
      if (own.length > 400) messages.splice(0, messages.length, ...messages.filter((line) => line.chatId !== input.chatId), ...own.slice(-400));
    },
    async recentMessages(chatId, limit) {
      return messages
        .filter((line) => line.chatId === chatId)
        .slice(-limit)
        .map((line): ChatLine => ({ name: line.name, role: line.role, text: line.text }));
    },
    async getScene(chatId) {
      return decodeScene(meta.get(`scene:${chatId}`) ?? null);
    },
    async setScene(chatId, scene) {
      const raw = encodeScene(scene);
      if (!raw) meta.delete(`scene:${chatId}`);
      else meta.set(`scene:${chatId}`, raw);
    },
  };
}

function eventId(event: LedgerEvent): number {
  return event.type === "session" ? event.session.id : event.redemption.id;
}
