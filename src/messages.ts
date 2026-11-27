import { openAccount, type Balances, type Owner, type Side } from "./domain/ledger.js";
import type { DomainError } from "./domain/ledger.js";
import {
  CYCLE_MINUTES,
  MASSAGE_PER_CYCLE,
  MAX_SESSION_MINUTES,
  ORAL_PER_CYCLE,
  type RewardKind,
} from "./domain/rules.js";
import type { Config } from "./config.js";
import type { LedgerEvent } from "./store.js";

export function formatRules(config: Pick<Config, "giName" | "lucasName">): string {
  return [
    "Só vale escada. Esteira, bike e corrida ficam de fora.",
    "",
    `A cada ${CYCLE_MINUTES} min da ${config.giName}, ${MASSAGE_PER_CYCLE} min de massagem. A cada ${CYCLE_MINUTES} min do ${config.lucasName}, ${ORAL_PER_CYCLE} min de mamadinha.`,
    "A escada de um não paga o prêmio do outro. O que sobra fica no banco de quem subiu.",
    "",
    "Manda os minutos quando subir. De tarde eu lembro da escada, sem cobrar o prêmio.",
  ].join("\n");
}

export function formatLog(input: {
  config: Pick<Config, "giName" | "lucasName">;
  minutes: number;
  note: string | null;
  owner: Owner;
  before: Balances;
  after: Balances;
}): string {
  const beforeSide = input.before[input.owner];
  const afterSide = input.after[input.owner];
  const cyclesGained = afterSide.cycles - beforeSide.cycles;
  const perCycle = input.owner === "gi" ? MASSAGE_PER_CYCLE : ORAL_PER_CYCLE;
  const who = input.owner === "gi" ? input.config.giName : input.config.lucasName;
  const lines = [`${who}, ${input.minutes} min${input.note ? ` · ${input.note}` : ""}.`];

  if (cyclesGained > 0) {
    lines.push(`${who}, já pode coletar ${cyclesGained * perCycle} min.`);
  } else {
    const next = minutesToNext(afterSide);
    if (next) lines.push(next);
  }
  return lines.join("\n");
}

export function formatBalance(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.lucas.totalMinutes === 0 && current.gi.totalMinutes === 0) {
    return formatEmptyAccount(config);
  }

  const lines = [
    formatPerson(config.lucasName, current.lucas, "Mamadinha", ORAL_PER_CYCLE),
    "",
    formatPerson(config.giName, current.gi, "Massagem", MASSAGE_PER_CYCLE),
  ];

  return lines.join("\n");
}

export function formatNothingToCollect(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.lucas.totalMinutes === 0 && current.gi.totalMinutes === 0) {
    return formatEmptyAccount(config);
  }

  return [
    "Nenhum prêmio esperando.",
    "",
    formatPerson(config.lucasName, current.lucas, "Mamadinha", ORAL_PER_CYCLE),
    "",
    formatPerson(config.giName, current.gi, "Massagem", MASSAGE_PER_CYCLE),
  ].join("\n");
}

export function formatCollectMenu(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.massagem.available === 0 && current.boquete.available === 0) {
    return formatNothingToCollect(config, current);
  }

  const lines = [
    "Os ciclos acumulam.",
    "Dá pra levar tudo de uma vez, ou só uma parte.",
    "",
    `${config.giName}: ${current.massagem.available} min de massagem`,
    `${config.lucasName}: ${current.boquete.available} min de mamadinha`,
    "",
    "Levar tudo: o botão, /massagem ou /mamadinha.",
  ];

  const parts = partialExamples(current);
  if (parts.length > 0) {
    lines.push("Levar uma parte:", ...parts);
  }

  return lines.join("\n");
}

function partialExamples(current: Balances): string[] {
  const lines: string[] = [];
  const massage = prizeExamples("massagem", current.massagem.available, MASSAGE_PER_CYCLE);
  const oral = prizeExamples("mamadinha", current.boquete.available, ORAL_PER_CYCLE);
  if (massage) lines.push(massage);
  if (oral) lines.push(oral);
  return lines;
}

function prizeExamples(command: string, available: number, unit: number): string | null {
  if (available <= 1) return null;

  const cycles = Math.floor(available / unit);
  if (cycles >= 2) return `/${command} ${unit} leva um ciclo. /${command} 2 ciclos leva ${unit * 2}.`;
  if (available > unit) return `/${command} ${unit} leva um ciclo.`;
  return `/${command} ${available - 1} leva ${available - 1} min.`;
}

export function personName(
  userId: number,
  stored: string,
  people: { lucasName: string; giName: string; lucasUserId: number | null; giUserId: number | null },
): string {
  if (people.giUserId !== null && userId === people.giUserId) return people.giName;
  if (people.lucasUserId !== null && userId === people.lucasUserId) return people.lucasName;
  return stored;
}

export function formatHistory(
  events: LedgerEvent[],
  timeZone: string,
  people?: { lucasName: string; giName: string; lucasUserId: number | null; giUserId: number | null },
): string {
  if (events.length === 0) {
    return [
      "Nada lançado ainda.",
      "",
      "Quando subirem a escada, o histórico aparece aqui. Esteira e bike não entram.",
    ].join("\n");
  }

  const lines = ["Últimos lançamentos", ""];
  for (const event of events) {
    const when = formatWhen(
      event.type === "session" ? event.session.createdAt : event.redemption.createdAt,
      timeZone,
    );
    lines.push(`${when} · ${historyText(event, people)}`);
  }
  return lines.join("\n");
}

export function historyText(
  event: LedgerEvent,
  people?: { lucasName: string; giName: string; lucasUserId: number | null; giUserId: number | null },
): string {
  if (event.type === "session") {
    const note = event.session.note ? ` · ${event.session.note}` : "";
    const name = people
      ? personName(event.session.userId, event.session.actorName, people)
      : event.session.actorName;
    return `${name} lançou ${event.session.minutes} min de escada${note}`;
  }
  const name = people
    ? personName(event.redemption.userId, event.redemption.actorName, people)
    : event.redemption.actorName;
  return `${name} coletou ${event.redemption.minutes} min de ${prizeLabel(event.redemption.kind)}`;
}

export function formatRedeem(kind: RewardKind, minutes: number, after: Balances): string {
  const left = after[kind].available;
  const prize = prizeLabel(kind);
  if (left === 0) return `Coletei ${minutes} min de ${prize}. Essa conta zerou.`;
  return `Coletei ${minutes} min de ${prize}. Ainda tem ${left} min.`;
}

export function formatUndo(event: LedgerEvent): string {
  if (event.type === "session") {
    return `Tirei os ${event.session.minutes} min de escada.`;
  }
  return `Desfiz a coleta de ${event.redemption.minutes} min de ${prizeLabel(event.redemption.kind)}.`;
}

export function formatNothingToUndo(): string {
  return "Nada pra desfazer. Ainda não tem lançamento.";
}

export function formatDomainError(
  error: DomainError,
  kind?: RewardKind,
): string {
  switch (error) {
    case "minutes-invalid":
      return "Manda os minutos em número inteiro, maior que zero.";
    case "minutes-too-long":
      return `O máximo por lançamento é ${MAX_SESSION_MINUTES} min. Divide em mais de um.`;
    case "not-enough":
      return `Não tem ${kind} suficiente. Olha o /saldo.`;
    case "undo-would-overdraw":
      return "Não dá pra desfazer essa escada: o prêmio desse ciclo já foi resgatado. Desfaz o resgate antes.";
  }
}

export function formatParseError(
  type: "need-minutes" | "rejected" | "invalid" | "too-long" | "ambiguous",
): string {
  switch (type) {
    case "need-minutes":
      return "Quantos minutos de escada? Ex.: /escada 40";
    case "rejected":
      return "Só vale escada.";
    case "invalid":
      return formatDomainError("minutes-invalid");
    case "too-long":
      return formatDomainError("minutes-too-long");
    case "ambiguous":
      return "Não entendi os minutos. Manda /escada 40.";
  }
}

export function formatOwnBalance(
  config: Pick<Config, "giName" | "lucasName">,
  owner: Owner,
  current: Balances,
): string {
  if (owner === "gi") return formatPerson(config.giName, current.gi, "Massagem", MASSAGE_PER_CYCLE);
  return formatPerson(config.lucasName, current.lucas, "Mamadinha", ORAL_PER_CYCLE);
}

function formatPerson(name: string, side: Side, prize: string, perCycle: number): string {
  const open = openAccount(side, perCycle);
  if (open.totalMinutes === 0 && side.reward.available === 0) {
    return `${name}\nZerada. ${prize}: 0 min.`;
  }
  const collected = perCycle > 0 ? Math.floor(side.reward.spent / perCycle) : 0;
  const lines = [
    name,
    `${open.totalMinutes} min · ${open.bankMinutes} min no banco`,
    `${prize}: ${side.reward.available} min`,
  ];
  if (collected > 0) lines.push(collected === 1 ? "1 recompensa já coletada." : `${collected} recompensas já coletadas.`);
  const next = minutesToNext(open);
  if (next) lines.push(next);
  return lines.join("\n");
}

function minutesToNext(side: { totalMinutes: number; bankMinutes: number; minutesToNextCycle: number }): string | null {
  if (side.totalMinutes === 0) return null;
  const left = side.bankMinutes === 0 ? CYCLE_MINUTES : side.minutesToNextCycle;
  return `Faltam ${left} min pro próximo prêmio.`;
}

function prizeLabel(kind: RewardKind): string {
  return kind === "massagem" ? "massagem" : "mamadinha";
}

function formatEmptyAccount(config: Pick<Config, "giName" | "lucasName">): string {
  return [
    "Ainda não tem escada na conta.",
    "",
    `A cada ${CYCLE_MINUTES} min da própria escada, ${config.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${config.lucasName} ganha ${ORAL_PER_CYCLE} min de mamadinha.`,
    "",
    "Começa com /escada 20.",
  ].join("\n");
}

function formatWhen(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
