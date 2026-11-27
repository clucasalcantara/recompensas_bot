import type { Owner } from "./ledger.js";

export type PrefKind = "gosta" | "evita";
export type PrefAbout = Owner | "couple";
export type LearnedAbout = "me" | "partner" | PrefAbout;

export type Learned = {
  about: LearnedAbout;
  kind: PrefKind;
  note: string;
};

export type Preference = {
  id: number;
  userId: number;
  owner: Owner;
  about: PrefAbout;
  kind: PrefKind;
  note: string;
  question: string | null;
};

export type PrefQuestion = {
  id: string;
  kind: PrefKind;
  text: string;
};

const QUESTIONS: { id: string; kind: PrefKind; ask: (name: string) => string }[] = [
  {
    id: "gosta",
    kind: "gosta",
    ask: (name) => `${name}, o que você gosta que entre no clima de vocês?`,
  },
  {
    id: "evita",
    kind: "evita",
    ask: (name) => `${name}, o que você não quer que apareça, nem quando esquenta?`,
  },
  {
    id: "quente",
    kind: "gosta",
    ask: (name) => `${name}, quando o clima esquenta, o que você quer mais?`,
  },
];

export function learnPreference(
  raw: string,
  names: { giName: string; lucasName: string },
): Learned | null {
  const text = fold(raw);
  if (text.length < 8 || text.length > 240) return null;
  if (/^(voce|vc|bot)\b/.test(text)) return null;

  const kind = kindOf(text);
  if (!kind) return null;

  const note = extractNote(text, names);
  if (!note) return null;
  return { about: aboutOf(text, names), kind, note };
}

export function answerNote(raw: string): string | null {
  const note = raw.replace(/\s+/g, " ").trim();
  if (note.length < 2) return null;
  return note.slice(0, 180);
}

export function resolveAbout(about: LearnedAbout, speaker: Owner): PrefAbout {
  if (about === "me") return speaker;
  if (about === "partner") return speaker === "gi" ? "lucas" : "gi";
  return about;
}

export function nextQuestion(
  items: Preference[],
  userId: number,
  name: string,
): PrefQuestion | null {
  const pending = QUESTIONS.find(
    (question) => !items.some((item) => item.userId === userId && item.question === question.id),
  );
  if (!pending) return null;
  return { id: pending.id, kind: pending.kind, text: pending.ask(name) };
}

export function questionById(id: string, name: string): PrefQuestion | null {
  const question = QUESTIONS.find((item) => item.id === id);
  if (!question) return null;
  return { id: question.id, kind: question.kind, text: question.ask(name) };
}

export function preferenceBrief(
  items: Preference[],
  names: { giName: string; lucasName: string },
): string {
  const recent = [...items].sort((a, b) => b.id - a.id).slice(0, 8).reverse();
  if (recent.length === 0) {
    return "Preferências salvas: nenhuma. Não invente um gosto específico.";
  }

  const lines = [
    "Preferências salvas. Siga isso.",
    "O que a própria pessoa disse vale mais do que o que o outro contou.",
    "Não sugira o que alguém disse que não quer.",
  ];
  for (const about of ["lucas", "gi", "couple"] as const) {
    const rows = recent.filter((item) => item.about === about);
    if (rows.length === 0) continue;
    const who = about === "couple" ? "Os dois" : about === "gi" ? names.giName : names.lucasName;
    for (const item of rows) {
      const said = item.owner === "gi" ? names.giName : names.lucasName;
      const verb = item.kind === "gosta" ? "gosta de" : "não quer";
      lines.push(`${who} ${verb} ${item.note} (dito por ${said}).`);
    }
  }
  return lines.join("\n");
}

export function formatKnown(
  items: Preference[],
  names: { giName: string; lucasName: string },
): string {
  if (items.length === 0) return "Ainda não anotei nada de vocês.";
  const lines = ["Do que eu lembro, e uso nos jogos:"];
  for (const about of ["lucas", "gi", "couple"] as const) {
    const rows = items.filter((item) => item.about === about);
    if (rows.length === 0) continue;
    const who = about === "couple" ? "Os dois" : about === "gi" ? names.giName : names.lucasName;
    const likes = rows.filter((item) => item.kind === "gosta").map((item) => item.note);
    const avoids = rows.filter((item) => item.kind === "evita").map((item) => item.note);
    if (likes.length > 0) lines.push(`${who} gosta: ${likes.join("; ")}.`);
    if (avoids.length > 0) lines.push(`${who} não quer: ${avoids.join("; ")}.`);
  }
  return lines.join("\n");
}

export function formatSaved(input: {
  aboutName: string;
  self: boolean;
  kind: PrefKind;
  note: string;
  fresh: boolean;
}): string {
  if (!input.fresh) return `Isso eu já tinha anotado: ${input.note}. Continuo usando nos jogos.`;
  if (input.aboutName === "Vocês") {
    const verb = input.kind === "gosta" ? "gostam de" : "não querem";
    return `Anotei. Vocês ${verb} ${input.note}. Vou usar isso nos jogos.`;
  }
  const who = input.self ? "Você" : input.aboutName;
  const verb = input.kind === "gosta" ? "gosta de" : "não quer";
  return `Anotei. ${who} ${verb} ${input.note}. Vou usar isso nos jogos.`;
}

function kindOf(text: string): PrefKind | null {
  if (/\b(nao gosto|nao quero|nao curto|nao posso|nao gosta|nao quer|odeio|detesto)\b/.test(text)) {
    return "evita";
  }
  if (/\b(gosto|adoro|amo|curto|prefiro|quero mais|gosta|adora|ama|curte)\b/.test(text)) {
    return "gosta";
  }
  return null;
}

function extractNote(
  text: string,
  names: { giName: string; lucasName: string },
): string | null {
  const gi = escapeRe(fold(names.giName));
  const lucas = escapeRe(fold(names.lucasName));
  const subject = `(?:eu|a gente|ela|ele|a ${gi}|o ${gi}|a ${lucas}|o ${lucas})`;
  const verb =
    "nao gosto|nao quero|nao curto|nao posso|nao gosta|nao quer|odeio|detesto|gosto|adoro|amo|curto|prefiro|quero mais|gosta|adora|ama|curte";
  const match = text.match(new RegExp(`^(?:${subject}\\s+)?(?:${verb})(?:\\s+de)?\\s+(.+)$`));
  const note = match?.[1]?.replace(/^(?:de|que)\s+/, "").trim();
  if (!note || note.length < 3 || note.length > 160) return null;
  if (/^(ela|ele|voce|disso|isso|aquilo)$/.test(note)) return null;
  return note;
}

function aboutOf(text: string, names: { giName: string; lucasName: string }): LearnedAbout {
  if (/\b(a gente|nos dois|os dois|entre a gente|entre nos)\b/.test(text)) return "couple";
  const gi = new RegExp(`\\b${escapeRe(fold(names.giName))}\\b`).test(text);
  const lucas = new RegExp(`\\b${escapeRe(fold(names.lucasName))}\\b`).test(text);
  if (gi && !lucas) return "gi";
  if (lucas && !gi) return "lucas";
  if (/\bela\b/.test(text) && !/\bele\b/.test(text)) return "partner";
  if (/\bele\b/.test(text) && !/\bela\b/.test(text)) return "partner";
  return "me";
}

function fold(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
