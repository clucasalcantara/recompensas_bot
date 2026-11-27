import { parseStairs } from "./parse.js";
import { parseHeat, type Heat, type PlayKind } from "./play.js";
import { resolveAbout, type LearnedAbout, type PrefAbout, type PrefKind } from "./prefs.js";
import type { AgentChoice, Decision } from "./reason.js";

export type Scene = {
  heat: Heat;
  kind: PlayKind;
};

export type Recipient = "speaker" | "partner" | "both";

export type Plan = {
  reply: "quiet" | "ledger" | "model" | "hello" | "stop";
  text: string | null;
  scene: Scene | null;
  decision: Decision | null;
  savePreference: {
    owner: "lucas" | "gi";
    about: PrefAbout;
    kind: PrefKind;
    note: string;
  } | null;
  invite: string | null;
  recipient: Recipient;
};

const PLAY_KINDS: PlayKind[] = ["dica", "verdade", "desafio", "dado", "moeda", "brincadeira"];

export function encodeScene(scene: Scene | null): string | null {
  return scene ? JSON.stringify(scene) : null;
}

export function decodeScene(raw: string | null): Scene | null {
  if (!raw) return null;
  try {
    const body = JSON.parse(raw) as { heat?: unknown; kind?: unknown };
    if ((body.heat === 1 || body.heat === 2 || body.heat === 3) && PLAY_KINDS.includes(body.kind as PlayKind)) {
      return { heat: body.heat, kind: body.kind as PlayKind };
    }
  } catch {
    return null;
  }
  return null;
}

const ENDS = new Set<Decision["action"]>([
  "stairs",
  "balance",
  "history",
  "ranking",
  "rules",
  "undo",
  "collect",
  "hello",
  "games",
]);

export function isExplicitStop(raw: string): boolean {
  const text = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:para|chega|pode parar|parar)(?:\s+(?:com isso|agora|ai))?$/.test(text);
}

export function planTurn(input: {
  text: string;
  place: "group" | "private";
  speaker: "lucas" | "gi";
  speakerName: string;
  addressed: boolean;
  scene: Scene | null;
  choice: AgentChoice | null;
}): Plan {
  const base: Plan = {
    reply: "quiet",
    text: null,
    scene: input.scene,
    decision: null,
    savePreference: null,
    invite: null,
    recipient: "speaker",
  };

  if (input.place === "private" && input.speaker === "gi") {
    return {
      ...base,
      reply: "model",
      text: "As perguntas ficam no grupo. Me marca lá, ou responde uma mensagem minha.",
    };
  }

  if (isExplicitStop(input.text)) {
    return { ...base, reply: "stop", text: "Parou.", scene: null };
  }

  const stair = parseStairs(input.text, false).type === "stairs";
  if (input.place === "group" && !input.addressed && !stair) {
    return base;
  }

  if (!input.choice) {
    return { ...base, reply: "model", text: null };
  }

  const decision = input.choice.decision;
  const scene = nextScene(input.scene, input.choice, input.text);
  const recipient = recipientFor(input.choice);
  const savePreference =
    decision.action === "preference"
      ? {
          owner: input.speaker,
          about: resolveAbout(decision.about, input.speaker),
          kind: decision.kind,
          note: decision.note,
        }
      : null;

  if (decision.action === "preference") {
    return { ...base, scene, decision, recipient, savePreference };
  }

  if (decision.action === "hello") {
    return {
      ...base,
      reply: "hello",
      text: decision.say,
      scene,
      decision,
      recipient,
    };
  }

  if (decision.action === "stop") {
    return { ...base, reply: "stop", text: "Parou.", scene: null, decision, recipient };
  }

  if (decision.action === "chat") {
    if (!input.choice.respond) return { ...base, scene, decision, recipient };
    const invite =
      input.scene && input.choice.invite && !pressures(input.choice.invite) ? input.choice.invite : null;
    return {
      ...base,
      reply: "model",
      text: decision.say,
      scene,
      decision,
      recipient,
      invite,
    };
  }

  return { ...base, reply: "ledger", scene, decision, recipient };
}

function nextScene(current: Scene | null, choice: AgentChoice, text: string): Scene | null {
  const decision = choice.decision;
  if (choice.sceneMove === "stop" || choice.sceneMove === "end" || decision.action === "stop") return null;
  if (ENDS.has(decision.action)) return null;
  if (decision.action === "play" || decision.action === "coin") {
    const kind: PlayKind = decision.action === "coin" ? "moeda" : decision.kind;
    const proposed = decision.heat;
    return { heat: directedHeat({ text, current: current?.heat ?? null, proposed }), kind };
  }
  if (choice.sceneMove === "continue" || choice.sceneMove === "none") return current;
  return current;
}

export function directedHeat(input: { text: string; current: Heat | null; proposed?: Heat }): Heat {
  const asked = parseHeat(input.text);
  if (asked) return asked;
  if (input.current) {
    if (input.proposed !== undefined && input.proposed > input.current) return input.current;
    return input.proposed ?? input.current;
  }
  if (input.proposed === 3) return 2;
  return input.proposed ?? 2;
}

function recipientFor(choice: AgentChoice): Recipient {
  const decision = choice.decision;
  if (
    decision.action === "stairs" ||
    decision.action === "hello" ||
    decision.action === "preference" ||
    decision.action === "stop"
  ) {
    return "speaker";
  }
  if (decision.action === "balance") return decision.scope === "both" ? "both" : "speaker";
  return choice.recipient;
}

function pressures(text: string): boolean {
  return /coletar|pr[eê]mio|saldo|mamadinha|massagem/i.test(text);
}

export type { LearnedAbout };
