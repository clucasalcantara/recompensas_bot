import type { Balances } from "./domain/ledger.js";
import type { Preference } from "./domain/prefs.js";
import type { RewardKind } from "./domain/rules.js";

export type Session = {
  id: number;
  minutes: number;
  note: string | null;
  actorName: string;
  userId: number;
  createdAt: string;
};

export type Redemption = {
  id: number;
  kind: RewardKind;
  minutes: number;
  actorName: string;
  userId: number;
  createdAt: string;
};

export type LedgerEvent =
  | { type: "session"; at: string; session: Session }
  | { type: "redemption"; at: string; redemption: Redemption };

export type Store = {
  balances(): Promise<Balances>;
  listSessions(): Promise<Session[]>;
  listRedemptions(): Promise<Redemption[]>;
  recent(limit: number): Promise<LedgerEvent[]>;
  addSession(input: {
    minutes: number;
    note: string | null;
    actorName: string;
    userId: number;
  }): Promise<Session>;
  addRedemption(input: {
    kind: RewardKind;
    minutes: number;
    actorName: string;
    userId: number;
  }): Promise<Redemption>;
  lastEvent(): Promise<LedgerEvent | null>;
  deleteSession(id: number): Promise<void>;
  deleteRedemption(id: number): Promise<void>;
  rememberChat(chatId: number): Promise<void>;
  getReminderChat(): Promise<number | null>;
  getLastReminderDate(): Promise<string | null>;
  setLastReminderDate(date: string): Promise<void>;
  listPreferences(): Promise<Preference[]>;
  addPreference(input: {
    userId: number;
    owner: Preference["owner"];
    about: Preference["about"];
    kind: Preference["kind"];
    note: string;
    question: string | null;
  }): Promise<{ preference: Preference; fresh: boolean }>;
  getPendingPref(userId: number): Promise<string | null>;
  setPendingPref(userId: number, questionId: string | null): Promise<void>;
};

export type { Preference };
