import type { Balances } from "./domain/ledger.js";
import type { Scene } from "./domain/scene.js";
import type { Preference } from "./domain/prefs.js";
import type { RewardKind } from "./domain/rules.js";
import type { Story } from "./domain/story.js";

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

export type ChatLine = {
  name: string;
  role: "user" | "bot";
  text: string;
};

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
  deletePreference(id: number): Promise<void>;
  listStories(): Promise<Story[]>;
  addStory(input: {
    userId: number;
    owner: Story["owner"];
    topic: Story["topic"];
    note: string;
  }): Promise<{ story: Story; fresh: boolean }>;
  deleteStory(id: number): Promise<void>;
  getPendingPref(userId: number): Promise<string | null>;
  setPendingPref(userId: number, questionId: string | null): Promise<void>;
  addMessage(input: {
    chatId: number;
    userId: number | null;
    name: string;
    role: "user" | "bot";
    text: string;
  }): Promise<void>;
  recentMessages(chatId: number, limit: number): Promise<ChatLine[]>;
  getScene(chatId: number): Promise<Scene | null>;
  setScene(chatId: number, scene: Scene | null): Promise<void>;
  claimUpdate(updateId: number): Promise<boolean>;
  updateMesa(change: (mesa: Mesa) => void): Promise<Mesa>;
  searchContent(input: {
    level: 1 | 2 | 3;
    kind?: string | null;
    embedding: number[];
    limit?: number;
  }): Promise<ContentHit[]>;
  close(): Promise<void>;
};

export type MesaPhase = "idle" | "role" | "writing" | "card";

export type Mesa = {
  heat: 1 | 2 | 3;
  kind: string | null;
  phase: MesaPhase;
  actor: "lucas" | "gi" | null;
  cara: "lucas" | "gi" | null;
  turn: "lucas" | "gi" | null;
  title: string | null;
  line: string | null;
  offline: boolean;
  lucasSeen: number | null;
  giSeen: number | null;
};

export function emptyMesa(): Mesa {
  return {
    heat: 1,
    kind: null,
    phase: "idle",
    actor: null,
    cara: null,
    turn: null,
    title: null,
    line: null,
    offline: false,
    lucasSeen: null,
    giSeen: null,
  };
}

export type ContentHit = {
  id: string;
  direction: string;
  intensityLevel: 1 | 2 | 3;
  sexualContent: "none" | "suggestive" | "sensual" | "explicit";
  interactionType: string;
  distance: number;
};

export type { Preference };
