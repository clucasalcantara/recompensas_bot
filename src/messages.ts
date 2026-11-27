import type { Balances, Owner, Side } from "./domain/ledger.js";
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
    "A conta da escada.",
    "",
    "Só vale escada. Esteira, bike e corrida não entram.",
    "",
    `A cada ${CYCLE_MINUTES} min da ${config.giName}: ${MASSAGE_PER_CYCLE} min de massagem.`,
    `A cada ${CYCLE_MINUTES} min do ${config.lucasName}: ${ORAL_PER_CYCLE} min de mamadinha.`,
    "A escada de um não paga o prêmio do outro.",
    "Os ciclos da mesma pessoa somam.",
    "",
    "Pode falar sem comando.",
    "fiz 40 de escada",
    "+35",
    "quanto a gente tem",
    "coleta a massagem",
    "me dá uma dica",
    "",
    "Conta",
    "/escada 40",
    "/saldo",
    "/coletar",
    "/ranking",
    "/historico",
    "/desfazer",
    "",
    "Clima, sem mexer no saldo",
    "/dica",
    "/brincadeira",
    "/jogo",
    "",
    "Uma vez por dia eu lembro neste chat. O bot precisa estar ligado.",
    "No grupo eu só respondo se me marcarem ou responderem uma mensagem minha.",
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
  const prize = input.owner === "gi" ? "massagem" : "mamadinha";
  const perCycle = input.owner === "gi" ? MASSAGE_PER_CYCLE : ORAL_PER_CYCLE;
  const who = input.owner === "gi" ? input.config.giName : input.config.lucasName;
  const lines = [`${who} somou ${input.minutes} min${input.note ? ` · ${input.note}` : ""}.`];

  if (cyclesGained > 0) {
    lines.push(
      "",
      cyclesGained === 1 ? "Fechou 1 ciclo." : `Fechou ${cyclesGained} ciclos.`,
      `${who} ganhou ${cyclesGained * perCycle} min de ${prize} (disponível: ${afterSide.reward.available}).`,
    );
  }

  const next = minutesToNext(afterSide);
  if (next) lines.push("", next);
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
    formatPerson(config.lucasName, current.lucas, "Mamadinha"),
    "",
    formatPerson(config.giName, current.gi, "Massagem"),
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
    formatPerson(config.lucasName, current.lucas, "Mamadinha"),
    "",
    formatPerson(config.giName, current.gi, "Massagem"),
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

export function formatHistory(events: LedgerEvent[], timeZone: string): string {
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
    if (event.type === "session") {
      const note = event.session.note ? ` · ${event.session.note}` : "";
      lines.push(
        `${when} · ${event.session.actorName} lançou ${event.session.minutes} min de escada${note}`,
      );
    } else {
      lines.push(
        `${when} · ${event.redemption.actorName} coletou ${event.redemption.minutes} min de ${prizeLabel(event.redemption.kind)}`,
      );
    }
  }
  return lines.join("\n");
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

function formatPerson(name: string, side: Side, prize: string): string {
  if (side.totalMinutes === 0 && side.reward.available === 0) {
    return `${name}\nZerada. ${prize}: 0 min.`;
  }
  const lines = [
    name,
    `${side.totalMinutes} min · ${cycleLabel(side.cycles)} · ${side.bankMinutes} min no banco`,
    `${prize}: ${side.reward.available} min`,
  ];
  const next = minutesToNext(side);
  if (next) lines.push(next);
  return lines.join("\n");
}

function minutesToNext(side: Side): string | null {
  if (side.totalMinutes === 0) return null;
  const left = side.bankMinutes === 0 ? CYCLE_MINUTES : side.minutesToNextCycle;
  return `Faltam ${left} min pro próximo prêmio.`;
}

function prizeLabel(kind: RewardKind): string {
  return kind === "massagem" ? "massagem" : "mamadinha";
}

function cycleLabel(cycles: number): string {
  return cycles === 1 ? "1 ciclo" : `${cycles} ciclos`;
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
