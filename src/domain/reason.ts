import { openAccount, sessionError, type Balances } from "./ledger.js";
import { parseStairs } from "./parse.js";
import type { Heat, PlayKind } from "./play.js";
import type { LearnedAbout, PrefKind } from "./prefs.js";
import { MASSAGE_PER_CYCLE, ORAL_PER_CYCLE, type RewardKind } from "./rules.js";

export type Decision =
  | { action: "balance"; scope: "me" | "both" }
  | { action: "stairs"; minutes: number | null; note: string | null }
  | { action: "history" }
  | { action: "ranking" }
  | { action: "rules" }
  | { action: "undo" }
  | { action: "games" }
  | { action: "play"; kind: PlayKind; heat?: Heat }
  | { action: "coin"; cara?: "me" | "partner" | "lucas" | "gi"; heat?: Heat }
  | { action: "collect"; kind?: RewardKind; minutes?: number | "all" }
  | { action: "preference"; about: LearnedAbout; kind: PrefKind; note: string }
  | { action: "calibrate" }
  | { action: "preferences" }
  | { action: "ask-partner" }
  | { action: "hello"; say: string }
  | { action: "stop" }
  | { action: "chat"; say: string };

const PLAY: PlayKind[] = ["dica", "verdade", "desafio", "dado", "moeda", "brincadeira"];
const REFUSAL =
  /n[aã]o consigo|n[aã]o tenho acesso|n[aã]o posso acessar|pronto para o que precisar|pronto pro que precisar/i;

export function reasonSystemPrompt(): string {
  return [
    "Você decide o que o bot da escada faz agora. Pensa no que a pessoa quis, no contexto e na conta real.",
    "Devolve só um JSON, sem texto em volta.",
    "Você não escreve saldo, minuto nem prêmio. Se a pergunta é sobre a conta, a ação é balance e o código responde com os números de verdade.",
    "Nunca diga que não consegue acessar a conta. A conta está no pedido.",
    "hello quando a pessoa só cumprimenta, sem pergunta. say é a sua resposta, uma frase, para quem falou.",
    "Se tiver pergunta, mesmo curta, a ação é chat e say responde a pergunta.",
    "Saudação com pergunta de conta é balance.",
    "Só escada entra na conta. Esteira, bike e corrida não são escada: a ação é chat e say é exatamente «Só vale escada.»",
    "Verdade ou desafio sem nível fica no 2.",
    "O nível é intensidade sexual, não profundidade emocional. Conversa funda não sobe o nível.",
    "1 é leve, sem direção sexual. 2 é flerte e sensual, sem explícito. 3 só se pedirem quente ou nível 3, e 3 é sexo de propósito.",
    "Se o nível estiver ambíguo, fique no menos sexual.",
    "O prêmio da Gi usa kind massagem. O prêmio do Caio usa kind boquete.",
    "say só existe em chat, uma frase, para quem falou, sem lista, sem saldo, sem oferecer o próximo passo.",
    "Cena aberta continua no mesmo nível. para encerra na hora, ação stop.",
    "recipient é speaker, partner ou both. Não chame a outra pessoa se ela não entra nesta fala.",
    "invite é uma frase ou null. Só se a cena já estava aberta. Sem coletar, sem saldo, sem prêmio.",
    "respond false quando o silêncio for melhor.",
    "Preferência nova não vira sugestão nesta fala. Não diga que anotou.",
    "scene é open, continue, end, stop ou none.",
    "Exemplos:",
    '{"action":"balance","scope":"both"} para «Como que estão os saldos?»',
    '{"action":"balance","scope":"me"} para «Quantos minutos eu tenho?»',
    '{"action":"hello","say":"Oi."} para um cumprimento sozinho.',
    '{"action":"chat","say":"Tudo, e por aí?"} para «tudo bem por aí?».',
    '{"action":"stairs","minutes":35,"note":null} para «subi 35».',
    '{"action":"chat","say":"Só vale escada."} para «30 de bike».',
    '{"action":"stop"} para «para».',
  ].join(" ");
}

export function accountFacts(input: {
  speaker: string;
  partner: string;
  lucasName: string;
  giName: string;
  balances: Balances;
}): string {
  const lucas = openAccount(input.balances.lucas, ORAL_PER_CYCLE);
  const gi = openAccount(input.balances.gi, MASSAGE_PER_CYCLE);
  return [
    `Quem falou: ${input.speaker}. A outra pessoa é ${input.partner}.`,
    "Conta real. Use para decidir. Não copie número nenhum na fala.",
    `${input.lucasName}: ${lucas.totalMinutes} min de escada, ${lucas.cycles} ciclos, ${lucas.bankMinutes} no banco, ${input.balances.lucas.reward.available} min de prêmio dele.`,
    `${input.giName}: ${gi.totalMinutes} min de escada, ${gi.cycles} ciclos, ${gi.bankMinutes} no banco, ${input.balances.gi.reward.available} min de prêmio dela.`,
  ].join("\n");
}

export function reasonUserPrompt(input: {
  speaker: string;
  partner: string;
  lucasName: string;
  giName: string;
  balances: Balances;
  text: string;
  recent?: string[];
  scene?: { heat: number; kind: string } | null;
  tastes?: string;
}): string {
  const recent = (input.recent ?? []).filter((line) => line.trim().length > 0).slice(-12);
  const scene =
    input.scene === undefined
      ? ""
      : input.scene
        ? `Cena aberta: ${input.scene.kind}, nível ${input.scene.heat}.`
        : "Cena: fechada.";
  return [
    accountFacts(input),
    scene,
    input.tastes ?? "",
    recent.length > 0 ? `Contexto recente:\n${recent.join("\n")}` : "",
    `Mensagem: ${input.text}`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export type Recipient = "speaker" | "partner" | "both";

export type SceneMove = "open" | "continue" | "end" | "stop" | "none";

export type AgentChoice = {
  decision: Decision;
  respond: boolean;
  recipient: Recipient;
  invite: string | null;
  sceneMove: SceneMove;
};

export function parseAgent(raw: string): AgentChoice | null {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const body = parsed as Record<string, unknown>;
  const decision = decisionFrom(body);
  if (!decision) return null;
  return {
    decision,
    respond: body.respond !== false,
    recipient: recipientOf(body.recipient),
    invite: inviteOf(body.invite),
    sceneMove: sceneMoveOf(body.scene, decision),
  };
}

export function parseDecision(raw: string): Decision | null {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return decisionFrom(parsed as Record<string, unknown>);
}

function decisionFrom(body: Record<string, unknown>): Decision | null {
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "balance") return { action, scope: scopeOf(body.scope) };
  if (action === "stairs") {
    return { action, minutes: whole(body.minutes), note: noteOf(body.note) };
  }
  if (action === "history" || action === "ranking" || action === "rules" || action === "undo") {
    return { action };
  }
  if (action === "games" || action === "calibrate" || action === "preferences" || action === "ask-partner") {
    return { action };
  }
  if (action === "stop") return { action };
  if (action === "hello") return helloOf(body);
  if (action === "play") return playOf(body);
  if (action === "coin") return coinOf(body);
  if (action === "collect") return collectOf(body);
  if (action === "preference") return preferenceOf(body);
  if (action === "chat") return chatOf(body);
  return null;
}

function recipientOf(value: unknown): Recipient {
  const text = fold(value);
  if (text === "partner" || text === "parceiro" || text === "parceira") return "partner";
  if (text === "both" || text === "casal" || text === "os dois") return "both";
  return "speaker";
}

function sceneMoveOf(value: unknown, decision: Decision): SceneMove {
  const text = fold(value);
  if (text === "open" || text === "continue" || text === "end" || text === "stop" || text === "none") {
    return text;
  }
  if (decision.action === "stop") return "stop";
  if (decision.action === "play" || decision.action === "coin") return "open";
  if (
    decision.action === "stairs" ||
    decision.action === "balance" ||
    decision.action === "history" ||
    decision.action === "ranking" ||
    decision.action === "rules" ||
    decision.action === "undo" ||
    decision.action === "collect" ||
    decision.action === "hello"
  ) {
    return "end";
  }
  return "continue";
}

function inviteOf(value: unknown): string | null {
  const invite = noteOf(value);
  if (!invite || /coletar|pr[eê]mio|saldo|mamadinha|massagem/i.test(invite)) return null;
  return invite;
}

export function stairWrite(
  text: string,
  minutes: number | null,
  note: string | null,
):
  | { ok: true; minutes: number; note: string | null }
  | { ok: false; error: "need-minutes" | "rejected" | "invalid" | "too-long" | "ambiguous" } {
  const parsed = parseStairs(text, false);
  if (parsed.type === "stairs") return { ok: true, minutes: parsed.minutes, note: parsed.note };
  if (parsed.type !== "ignore") return { ok: false, error: parsed.type };
  if (minutes == null) return { ok: false, error: "need-minutes" };
  const error = sessionError(minutes);
  if (error === "minutes-invalid") return { ok: false, error: "invalid" };
  if (error === "minutes-too-long") return { ok: false, error: "too-long" };
  return { ok: true, minutes, note };
}

function playOf(body: Record<string, unknown>): Decision | null {
  const kind = body.kind;
  if (typeof kind !== "string" || !PLAY.includes(kind as PlayKind)) return null;
  const play = kind as PlayKind;
  if (play === "moeda") return coinOf({ ...body, action: "coin" });
  const heat = heatOf(body.heat);
  if (play === "verdade" || play === "desafio") {
    return heat ? { action: "play", kind: play, heat } : { action: "play", kind: play };
  }
  return heat ? { action: "play", kind: play, heat } : { action: "play", kind: play };
}

function coinOf(body: Record<string, unknown>): Decision | null {
  const cara = caraOf(body.cara);
  const heat = heatOf(body.heat);
  return {
    action: "coin",
    ...(cara ? { cara } : {}),
    ...(heat ? { heat } : {}),
  };
}

function collectOf(body: Record<string, unknown>): Decision | null {
  const kind = prizeKind(body.kind);
  const minutes =
    body.minutes === "all" || body.minutes === "tudo" ? "all" : (whole(body.minutes) ?? undefined);
  return { action: "collect", ...(kind ? { kind } : {}), ...(minutes != null ? { minutes } : {}) };
}

function preferenceOf(body: Record<string, unknown>): Decision | null {
  const about = aboutOf(body.about);
  const kind = body.kind === "gosta" || body.kind === "evita" ? body.kind : null;
  const note = noteOf(body.note);
  if (!about || !kind || !note) return null;
  return { action: "preference", about, kind, note };
}

function helloOf(body: Record<string, unknown>): Decision | null {
  const say = spoken(body.say);
  if (!say) return null;
  return { action: "hello", say };
}

function chatOf(body: Record<string, unknown>): Decision | null {
  const say = spoken(body.say);
  if (!say) return null;
  return { action: "chat", say };
}

function spoken(value: unknown): string | null {
  const say = noteOf(value);
  if (!say || REFUSAL.test(say)) return null;
  return say;
}

function scopeOf(value: unknown): "me" | "both" {
  const text = fold(value);
  if (text === "me" || text === "eu" || text === "speaker" || text === "meu" || text === "minha" || text === "proprio") {
    return "me";
  }
  return "both";
}

function heatOf(value: unknown): Heat | undefined {
  if (value === 1 || value === 2 || value === 3) return value;
  const text = fold(value);
  if (text === "1" || text === "leve") return 1;
  if (text === "2" || text === "medio") return 2;
  if (text === "3" || text === "quente") return 3;
  return undefined;
}

function caraOf(value: unknown): "me" | "partner" | "lucas" | "gi" | undefined {
  const text = fold(value);
  if (text === "me" || text === "eu" || text === "speaker") return "me";
  if (text === "partner" || text === "parceiro" || text === "parceira") return "partner";
  if (text === "lucas" || text === "caio") return "lucas";
  if (text === "gi") return "gi";
  return undefined;
}

function aboutOf(value: unknown): LearnedAbout | null {
  const text = fold(value);
  if (text === "me" || text === "eu" || text === "speaker") return "me";
  if (text === "partner" || text === "parceiro" || text === "parceira") return "partner";
  if (text === "lucas" || text === "caio") return "lucas";
  if (text === "gi") return "gi";
  if (text === "couple" || text === "casal" || text === "nos" || text === "a gente") return "couple";
  return null;
}

function prizeKind(value: unknown): RewardKind | undefined {
  const text = fold(value);
  if (text === "massagem") return "massagem";
  if (text === "boquete" || text === "mamadinha") return "boquete";
  return undefined;
}

function fold(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function whole(value: unknown): number | null {
  const minutes = typeof value === "string" ? Number(value) : value;
  if (typeof minutes !== "number" || !Number.isInteger(minutes)) return null;
  return minutes;
}

function noteOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.replace(/\s+/g, " ").trim();
  if (!note) return null;
  return note.slice(0, 180);
}

function extractJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}
