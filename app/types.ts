export type Names = {
  lucasName: string;
  giName: string;
};

export type Side = {
  totalMinutes: number;
  bankMinutes: number;
  minutesToNextCycle: number;
  cycles: number;
  available: number;
  spent: number;
  perCycle: number;
};

export type House = Names & {
  who: "lucas" | "gi";
  you: string;
  partner: string;
  cycleMinutes: number;
  lucas: Side;
  gi: Side;
  weeks: { label: string; lucas: number; gi: number }[];
  month: { label: string; lucas: number; gi: number };
  recent: { when: string; text: string }[];
  stories: {
    id: number;
    owner: string;
    author: string;
    topic: string;
    topicLabel: string;
    note: string;
  }[];
  prefs: {
    id: number;
    author: string;
    about: string;
    aboutName: string;
    kind: "gosta" | "evita";
    note: string;
  }[];
  line?: string;
};

export type Table = {
  heat: 1 | 2 | 3;
  kind: string;
  phase: "idle" | "role" | "writing" | "card";
  actor: "lucas" | "gi" | null;
  cara: "lucas" | "gi" | null;
  title: string;
  text: string;
  offline: boolean;
  you: "lucas" | "gi";
  writer: "lucas" | "gi" | null;
  partnerHere: boolean;
};

export type Ticket = {
  title: string;
  text: string;
  offline?: boolean;
};

export function isHouse(value: unknown): value is House {
  return !!value && typeof value === "object" && "lucasName" in value && "weeks" in value;
}
