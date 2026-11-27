import type { Config } from "../config.js";
import { redeemError, sessionError, type DomainError } from "../domain/ledger.js";
import type { Heat, PlayKind } from "../domain/play.js";
import { resolveAbout, type PrefAbout } from "../domain/prefs.js";
import { MASSAGE_PER_CYCLE, ORAL_PER_CYCLE, CYCLE_MINUTES, type RewardKind } from "../domain/rules.js";
import { cleanNote, coupleBrief, isStoryTopic, topicLabel } from "../domain/story.js";
import { formatDomainError } from "../messages.js";
import type { Store } from "../store.js";
import { composePlay, generateLine, type GenerateInput } from "../suggest.js";
import { retrieveGuide } from "../rag.js";
import {
  passwordOk,
  readSession,
  sessionCookie,
  signSession,
  whoByName,
  type Who,
} from "./auth.js";
import { fromCaderno } from "./caderno.js";
import { monthMinutes, weekSeries } from "./weeks.js";

export type WebConfig = {
  webPassword: string;
  lucasName: string;
  giName: string;
  lucasUserId: number | null;
  giUserId: number | null;
  togetherApiKey: string;
  togetherModel: string;
  reminderTimeZone: string;
};

export function webConfigFrom(config: Config, webPassword: string | undefined): WebConfig {
  return {
    webPassword: webPassword?.trim() ?? "",
    lucasName: config.lucasName,
    giName: config.giName,
    lucasUserId: config.lucasUserId,
    giUserId: config.giUserId,
    togetherApiKey: config.togetherApiKey,
    togetherModel: config.togetherModel,
    reminderTimeZone: config.reminderTimeZone,
  };
}

export type WebRequest = {
  method: string;
  op: string;
  cookie: string | undefined;
  body: unknown;
  ip: string;
  now: number;
  secure: boolean;
};

export type WebResult = {
  status: number;
  body: unknown;
  cookie?: string;
};

export type WebDeps = {
  config: WebConfig;
  store: Store;
  play?: typeof composePlay;
  imagine?: (input: GenerateInput) => Promise<string>;
  guideFor?: (input: { kind: PlayKind; level: 1 | 2 | 3; query: string }) => Promise<string | null>;
  rng?: () => number;
};

const PLAY: PlayKind[] = ["dica", "verdade", "desafio", "dado", "moeda", "brincadeira"];

const NIGHTS: Record<string, { title: string; detail: string }> = {
  jantar: {
    title: "Jantar",
    detail:
      "Inventa um jantar concreto para os dois hoje. Pode ser em casa. Usa o que eles escreveram sobre comida. Romântico, fácil, sem sexo explícito.",
  },
  noite: {
    title: "Hoje à noite",
    detail: "Inventa um plano curto para hoje à noite, em casa, fofo e com clima. Sem sexo explícito.",
  },
  programa: {
    title: "Um programa",
    detail: "Inventa um programa de casal para fazer juntos, específico e leve. Sem sexo explícito.",
  },
  fofo: {
    title: "Uma fofura",
    detail:
      "Inventa um gesto pequeno e fofo que a pessoa que pediu pode fazer pela outra hoje. Sem sexo explícito.",
  },
};

const fails = new Map<string, { n: number; at: number }>();

export function resetGate(): void {
  fails.clear();
}

export async function dispatch(req: WebRequest, deps: WebDeps): Promise<WebResult> {
  const { config } = deps;
  const op = req.op;
  const method = req.method.toUpperCase();
  if (op === "door" || op === "home") {
    if (method !== "GET") return { status: 405, body: { error: "Não é por aqui." } };
  } else if (method !== "POST") {
    return { status: 405, body: { error: "Não é por aqui." } };
  }

  if (op === "door") {
    return { status: 200, body: { lucasName: config.lucasName, giName: config.giName } };
  }

  if (!config.webPassword) {
    return { status: 503, body: { error: "A casa ainda não tem senha." } };
  }

  const names = { giName: config.giName, lucasName: config.lucasName };
  const who = readSession(req.cookie, config.webPassword, req.now);

  if (op === "login") return login(req, deps);
  if (op === "logout") {
    return { status: 200, cookie: sessionCookie("", req.secure, 0), body: { ok: true } };
  }
  if (!who) return { status: 401, body: { error: "Entra de novo." } };

  if (op === "home") return { status: 200, body: await snapshot(deps, who) };
  if (op === "switch") return switchWho(req, deps, who);
  if (op === "play") return play(req, deps, who);
  if (op === "night") return night(req, deps, who);
  if (op === "log") return logMinutes(req, deps, who);
  if (op === "redeem") return redeem(req, deps, who);
  if (op === "story") return saveStory(req, deps, who);
  if (op === "pref") return savePref(req, deps, who);
  if (op === "forget") return forget(req, deps, who);
  return { status: 404, body: { error: "Não achei." } };
}

async function login(req: WebRequest, deps: WebDeps): Promise<WebResult> {
  const { config } = deps;
  if (locked(req.ip, req.now)) {
    return { status: 429, body: { error: "Muitas tentativas. Espera um pouco." } };
  }
  const body = asRecord(req.body);
  const password = str(body.password).slice(0, 200);
  const pass = passwordOk(password, config.webPassword);
  const who = whoByName(str(body.name), config);
  if (!pass || !who) {
    markFail(req.ip, req.now);
    return { status: 401, body: { error: "Não entrou." } };
  }
  fails.delete(req.ip);
  const house = await snapshot(deps, who);
  return {
    status: 200,
    cookie: sessionCookie(signSession(who, config.webPassword, req.now), req.secure),
    body: house,
  };
}

async function switchWho(req: WebRequest, deps: WebDeps, current: Who): Promise<WebResult> {
  const who = whoByName(str(asRecord(req.body).name), deps.config);
  if (!who) return { status: 400, body: { error: "Não achei essa pessoa." } };
  if (who === current) return { status: 200, body: await snapshot(deps, who) };
  return {
    status: 200,
    cookie: sessionCookie(signSession(who, deps.config.webPassword, req.now), req.secure),
    body: await snapshot(deps, who, `Agora é a vez de ${nameOf(who, deps.config)}.`),
  };
}

async function play(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const kind = str(body.kind);
  if (!PLAY.includes(kind as PlayKind)) return { status: 400, body: { error: "Escolhe um jogo." } };
  const heat = heatOf(body.heat);
  const cara = body.cara === "gi" || body.cara === "lucas" ? body.cara : undefined;
  if (kind === "moeda" && !cara) return { status: 400, body: { error: "Escolhe quem é cara." } };
  const names = namesOf(deps.config);
  const tastes = await tastesOf(deps);
  const level = heat ?? 2;
  let guide: string | null = null;
  try {
    guide = deps.guideFor
      ? await deps.guideFor({ kind: kind as PlayKind, level, query: str(body.detail) || kind })
      : await retrieveGuide(deps.store, {
          kind: kind as PlayKind,
          level,
          query: str(body.detail) || kind,
        });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }
  try {
    const playWith = deps.play ?? composePlay;
    const raw = await playWith(kind as PlayKind, names, {
      apiKey: deps.config.togetherApiKey,
      model: deps.config.togetherModel,
      speaker: nameOf(who, deps.config),
      heat,
      cara,
      tastes,
      guide,
      rng: deps.rng,
    });
    return { status: 200, body: { ...splitLine(raw), offline: false } };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return {
      status: 200,
      body: {
        ...fromCaderno({ kind, names, heat, rng: deps.rng }),
        offline: true,
      },
    };
  }
}

async function night(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const kind = str(asRecord(req.body).kind);
  const card = NIGHTS[kind];
  if (!card) return { status: 400, body: { error: "Escolhe uma ideia." } };
  const names = namesOf(deps.config);
  const tastes = await tastesOf(deps);
  try {
    const imagine = deps.imagine ?? generateLine;
    const text = await imagine({
      apiKey: deps.config.togetherApiKey,
      model: deps.config.togetherModel,
      names,
      kind: "dica",
      tone: "romantico",
      heat: 1,
      speaker: nameOf(who, deps.config),
      tastes,
      detail: card.detail,
    });
    return { status: 200, body: { title: card.title, text, offline: false } };
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return {
      status: 200,
      body: { ...fromCaderno({ kind, names, heat: 1, rng: deps.rng }), offline: true },
    };
  }
}

async function logMinutes(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const minutes = integer(body.minutes);
  if (minutes === null) return { status: 400, body: { error: domainMessage("minutes-invalid") } };
  const problem = sessionError(minutes);
  if (problem) return { status: 400, body: { error: domainMessage(problem) } };
  const userId = idOf(who, deps.config);
  if (userId === null) return { status: 400, body: { error: "Falta o id dessa pessoa no bot." } };
  const rawNote = str(body.note).trim();
  let note: string | null = null;
  if (rawNote) {
    note = cleanNote(rawNote, 120);
    if (!note) return { status: 400, body: { error: "A nota precisa ter entre 3 e 120 letras." } };
  }
  await deps.store.addSession({
    minutes,
    note,
    actorName: nameOf(who, deps.config),
    userId,
  });
  return {
    status: 200,
    body: await snapshot(deps, who, `Anotei ${minutes} min na escada de ${nameOf(who, deps.config)}.`),
  };
}

async function redeem(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const kind = body.kind === "massagem" || body.kind === "boquete" ? body.kind : null;
  if (!kind) return { status: 400, body: { error: "Escolhe o prêmio." } };
  const minutes = integer(body.minutes);
  if (minutes === null) return { status: 400, body: { error: domainMessage("minutes-invalid") } };
  const current = await deps.store.balances();
  const problem = redeemError(current, kind, minutes);
  if (problem) return { status: 400, body: { error: domainMessage(problem, kind) } };
  const userId = idOf(who, deps.config);
  if (userId === null) return { status: 400, body: { error: "Falta o id dessa pessoa no bot." } };
  await deps.store.addRedemption({
    kind,
    minutes,
    actorName: nameOf(who, deps.config),
    userId,
  });
  const prize = kind === "massagem" ? "massagem" : "mamadinha";
  return {
    status: 200,
    body: await snapshot(deps, who, `Coletei ${minutes} min de ${prize}.`),
  };
}

async function saveStory(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const topic = str(body.topic);
  if (!isStoryTopic(topic)) return { status: 400, body: { error: "Escolhe um assunto." } };
  const note = cleanNote(body.note, 400);
  if (!note) return { status: 400, body: { error: "Escreve entre 3 e 400 letras." } };
  const userId = idOf(who, deps.config);
  if (userId === null) return { status: 400, body: { error: "Falta o id dessa pessoa no bot." } };
  const saved = await deps.store.addStory({ userId, owner: who, topic, note });
  const line = saved.fresh ? "Guardei. O bot já pode usar." : "Isso já estava na casa.";
  return { status: 200, body: await snapshot(deps, who, line) };
}

async function savePref(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const aboutRaw = str(body.about);
  if (aboutRaw !== "me" && aboutRaw !== "partner" && aboutRaw !== "couple") {
    return { status: 400, body: { error: "Diz se é você, a outra pessoa ou os dois." } };
  }
  const kind = body.kind === "gosta" || body.kind === "evita" ? body.kind : null;
  if (!kind) return { status: 400, body: { error: "Diz se gosta ou se não quer." } };
  const note = cleanNote(body.note, 180);
  if (!note) return { status: 400, body: { error: "Escreve entre 3 e 180 letras." } };
  const userId = idOf(who, deps.config);
  if (userId === null) return { status: 400, body: { error: "Falta o id dessa pessoa no bot." } };
  const saved = await deps.store.addPreference({
    userId,
    owner: who,
    about: resolveAbout(aboutRaw, who),
    kind,
    note,
    question: null,
  });
  const line = saved.fresh ? "Anotei. O bot respeita isso nos jogos." : "Isso já estava anotado.";
  return { status: 200, body: await snapshot(deps, who, line) };
}

async function forget(req: WebRequest, deps: WebDeps, who: Who): Promise<WebResult> {
  const body = asRecord(req.body);
  const id = integer(body.id);
  if (id === null) return { status: 400, body: { error: "Não achei essa nota." } };
  if (body.type === "story") await deps.store.deleteStory(id);
  else if (body.type === "pref") await deps.store.deletePreference(id);
  else return { status: 400, body: { error: "Não achei essa nota." } };
  return { status: 200, body: await snapshot(deps, who, "Tirei.") };
}

async function snapshot(deps: WebDeps, who: Who, line?: string): Promise<Record<string, unknown>> {
  const { config, store } = deps;
  const names = namesOf(config);
  const [balances, sessions, events, prefs, stories] = await Promise.all([
    store.balances(),
    store.listSessions(),
    store.recent(12),
    store.listPreferences(),
    store.listStories(),
  ]);
  const now = new Date();
  const month = monthMinutes(sessions, config.giUserId, config.reminderTimeZone, now);
  const you = nameOf(who, config);
  const partner = who === "gi" ? config.lucasName : config.giName;
  return {
    who,
    you,
    partner,
    lucasName: config.lucasName,
    giName: config.giName,
    cycleMinutes: CYCLE_MINUTES,
    lucas: sideView(balances.lucas, ORAL_PER_CYCLE),
    gi: sideView(balances.gi, MASSAGE_PER_CYCLE),
    weeks: weekSeries(sessions, config.giUserId, config.reminderTimeZone, now),
    month,
    recent: events.map((event) => {
      const at = event.type === "session" ? event.session.createdAt : event.redemption.createdAt;
      const when = new Intl.DateTimeFormat("pt-BR", {
        timeZone: config.reminderTimeZone,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(at));
      if (event.type === "session") {
        const note = event.session.note ? ` · ${event.session.note}` : "";
        return { when, text: `${event.session.actorName} subiu ${event.session.minutes} min${note}` };
      }
      const prize = event.redemption.kind === "massagem" ? "massagem" : "mamadinha";
      return {
        when,
        text: `${event.redemption.actorName} coletou ${event.redemption.minutes} min de ${prize}`,
      };
    }),
    stories: [...stories]
      .sort((a, b) => b.id - a.id)
      .map((story) => ({
        id: story.id,
        owner: story.owner,
        author: story.owner === "gi" ? names.giName : names.lucasName,
        topic: story.topic,
        topicLabel: topicLabel(story.topic),
        note: story.note,
      })),
    prefs: [...prefs]
      .sort((a, b) => b.id - a.id)
      .map((item) => ({
        id: item.id,
        author: item.owner === "gi" ? names.giName : names.lucasName,
        about: item.about,
        aboutName: aboutName(item.about, names),
        kind: item.kind,
        note: item.note,
      })),
    ...(line ? { line } : {}),
  };
}

function sideView(
  side: { totalMinutes: number; bankMinutes: number; minutesToNextCycle: number; cycles: number; reward: { available: number } },
  perCycle: number,
) {
  return {
    totalMinutes: side.totalMinutes,
    bankMinutes: side.bankMinutes,
    minutesToNextCycle: side.minutesToNextCycle,
    cycles: side.cycles,
    available: side.reward.available,
    perCycle,
  };
}

async function tastesOf(deps: WebDeps): Promise<string> {
  const names = namesOf(deps.config);
  const [prefs, stories] = await Promise.all([
    deps.store.listPreferences(),
    deps.store.listStories(),
  ]);
  return coupleBrief(prefs, stories, names);
}

function aboutName(about: PrefAbout, names: { giName: string; lucasName: string }): string {
  if (about === "couple") return "os dois";
  if (about === "gi") return names.giName;
  return names.lucasName;
}

function namesOf(config: WebConfig): { giName: string; lucasName: string } {
  return { giName: config.giName, lucasName: config.lucasName };
}

function nameOf(who: Who, config: WebConfig): string {
  return who === "gi" ? config.giName : config.lucasName;
}

function idOf(who: Who, config: WebConfig): number | null {
  return who === "gi" ? config.giUserId : config.lucasUserId;
}

function heatOf(value: unknown): Heat {
  if (value === 2 || value === "2") return 2;
  if (value === 3 || value === "3") return 3;
  return 1;
}

function domainMessage(error: DomainError, kind?: RewardKind): string {
  if (error === "not-enough") return "Não tem esse prêmio suficiente.";
  return formatDomainError(error, kind);
}

function splitLine(raw: string): { title: string; text: string } {
  const [title, ...rest] = raw.split("\n");
  const text = rest.join("\n").trim();
  return { title: title?.trim() || "Pra vocês", text: text || title?.trim() || "" };
}

function locked(ip: string, now: number): boolean {
  const row = fails.get(ip);
  if (!row) return false;
  if (now - row.at > 10 * 60 * 1000) {
    fails.delete(ip);
    return false;
  }
  return row.n >= 8;
}

function markFail(ip: string, now: number): void {
  const row = fails.get(ip);
  if (!row || now - row.at > 10 * 60 * 1000) {
    fails.set(ip, { n: 1, at: now });
    return;
  }
  row.n += 1;
  row.at = now;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  return body as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function integer(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}
