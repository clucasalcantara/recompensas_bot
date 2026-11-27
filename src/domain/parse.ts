import { sessionError } from "./ledger.js";
import { MAX_SESSION_MINUTES, type RewardKind } from "./rules.js";

const REJECTED =
  /\b(esteira|bike|bicicleta|corrida|correr|caminhada|eliptic[oa]|elíptic[oa]|remo|natacao|natação|hiit|spinning)\b/i;

export type StairsParse =
  | { type: "stairs"; minutes: number; note: string | null }
  | { type: "need-minutes" }
  | { type: "rejected" }
  | { type: "invalid" }
  | { type: "too-long" }
  | { type: "ambiguous" }
  | { type: "ignore" };

type DurationHit =
  | { kind: "duration"; minutes: number; rest: string }
  | { kind: "ambiguous" };

export function parseStairs(raw: string, fromCommand: boolean): StairsParse {
  const text = raw.trim();
  if (!text) return fromCommand ? { type: "need-minutes" } : { type: "ignore" };

  const hasStairs = /\bescadas?\b/i.test(text);
  const hasRejected = REJECTED.test(text);
  const duration = findDuration(text);

  if (hasRejected && !hasStairs && (duration || fromCommand)) {
    return { type: "rejected" };
  }

  if (!duration) {
    if (fromCommand || /^escadas?\??$/i.test(text)) return { type: "need-minutes" };
    return { type: "ignore" };
  }

  if (duration.kind === "ambiguous") {
    if (!fromCommand && !hasStairs) return { type: "ignore" };
    return { type: "ambiguous" };
  }

  if (!fromCommand && !hasStairs) return { type: "ignore" };

  const error = sessionError(duration.minutes);
  if (error === "minutes-invalid") return { type: "invalid" };
  if (error === "minutes-too-long") return { type: "too-long" };

  return {
    type: "stairs",
    minutes: duration.minutes,
    note: cleanupNote(duration.rest),
  };
}

export type RedeemParse =
  | { ok: true; kind: RewardKind; minutes: number }
  | { ok: false; reason: "usage" | "invalid" | "too-long" };

export function parseRedeem(raw: string): RedeemParse {
  const match = raw
    .trim()
    .toLowerCase()
    .match(/^(massagem|boquete)\s+(\d+)\s*$/);

  if (!match) return { ok: false, reason: "usage" };

  const minutes = Number(match[2]);
  if (!Number.isInteger(minutes) || minutes <= 0) return { ok: false, reason: "invalid" };
  if (minutes > MAX_SESSION_MINUTES) return { ok: false, reason: "too-long" };

  return { ok: true, kind: match[1] as RewardKind, minutes };
}

export type CollectParse =
  | { ok: true; kind: RewardKind; minutes: number | "all" }
  | { ok: false; reason: "menu" | "usage" | "invalid" | "too-long" };

export function parseCollect(raw: string, assumed?: RewardKind): CollectParse {
  const text = raw.trim().toLowerCase();
  if (!text) {
    return assumed
      ? { ok: true, kind: assumed, minutes: "all" }
      : { ok: false, reason: "menu" };
  }

  const withKind = text.match(/^(massagem|boquete)(?:\s+(tudo|\d+))?$/);
  if (withKind) {
    const kind = withKind[1] as RewardKind;
    const amount = withKind[2];
    if (!amount || amount === "tudo") return { ok: true, kind, minutes: "all" };
    return amountOrError(kind, Number(amount));
  }

  if (assumed) {
    if (text === "tudo") return { ok: true, kind: assumed, minutes: "all" };
    if (/^\d+$/.test(text)) return amountOrError(assumed, Number(text));
  }

  return { ok: false, reason: "usage" };
}

function amountOrError(kind: RewardKind, minutes: number): CollectParse {
  if (!Number.isInteger(minutes) || minutes <= 0) return { ok: false, reason: "invalid" };
  if (minutes > MAX_SESSION_MINUTES) return { ok: false, reason: "too-long" };
  return { ok: true, kind, minutes };
}

function findDuration(text: string): DurationHit | null {
  const hoursWord = text.match(/(\d+)\s*horas?\b/i);
  if (hoursWord?.index !== undefined) {
    return {
      kind: "duration",
      minutes: Number(hoursWord[1]) * 60,
      rest: cut(text, hoursWord.index, hoursWord[0].length),
    };
  }

  const hour = text.match(
    /(\d+)\s*h(?=$|\s|\d)(?:\s*(\d{1,2}))?(?:\s*m(?:in(?:utos?)?)?)?(?!\d)/i,
  );
  if (hour?.index !== undefined) {
    const minutes = Number(hour[1]) * 60 + (hour[2] ? Number(hour[2]) : 0);
    return { kind: "duration", minutes, rest: cut(text, hour.index, hour[0].length) };
  }

  const clock = text.match(/(?:^|\s)(\d{1,2})\s*:\s*(\d{2})(?!\d)/);
  if (clock?.index !== undefined) {
    const hours = Number(clock[1]);
    const mins = Number(clock[2]);
    if (hours <= 4 && mins < 60) {
      const leadingSpace = clock[0].startsWith(" ") ? 1 : 0;
      return {
        kind: "duration",
        minutes: hours * 60 + mins,
        rest: cut(text, clock.index + leadingSpace, clock[0].length - leadingSpace),
      };
    }
  }

  const explicit = text.match(/(\d+)\s*(?:minutos|minuto|min)\b/i);
  if (explicit?.index !== undefined) {
    return {
      kind: "duration",
      minutes: Number(explicit[1]),
      rest: cut(text, explicit.index, explicit[0].length),
    };
  }

  const integers = text.match(/\d+/g) ?? [];
  if (integers.length > 1) return { kind: "ambiguous" };
  if (integers.length === 0) return null;

  const only = text.match(/(?:^|\s)(\d+)(?=\s|$)/);
  if (only?.index === undefined) return null;

  const leadingSpace = only[0].startsWith(" ") ? 1 : 0;
  return {
    kind: "duration",
    minutes: Number(only[1]),
    rest: cut(text, only.index + leadingSpace, only[1].length),
  };
}

function cut(text: string, start: number, length: number): string {
  return `${text.slice(0, start)} ${text.slice(start + length)}`.replace(/\s+/g, " ").trim();
}

function cleanupNote(rest: string): string | null {
  const note = rest
    .replace(/\bescadas?\b/gi, " ")
    .replace(/\b(minutos|minuto|min|de|da|do|fiz|feito|uns|umas|um|uma)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return note.length > 0 ? note : null;
}
