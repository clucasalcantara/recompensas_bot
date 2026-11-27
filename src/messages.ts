import type { Balances } from "./domain/ledger.js";
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
    `A cada ${CYCLE_MINUTES} min:`,
    `· ${config.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem`,
    `· ${config.lucasName} ganha ${ORAL_PER_CYCLE} min de boquete`,
    "",
    `O que passa de ${CYCLE_MINUTES} fica no banco até fechar o próximo ciclo.`,
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
  ].join("\n");
}

export function formatLog(input: {
  config: Pick<Config, "giName" | "lucasName">;
  minutes: number;
  note: string | null;
  before: Balances;
  after: Balances;
}): string {
  const cyclesGained = input.after.cycles - input.before.cycles;
  const lines = [
    `Escada: ${input.minutes} min${input.note ? ` · ${input.note}` : ""}.`,
  ];

  if (cyclesGained > 0) {
    const massage = cyclesGained * MASSAGE_PER_CYCLE;
    const oral = cyclesGained * ORAL_PER_CYCLE;
    lines.push(
      "",
      cyclesGained === 1 ? "Fechou 1 ciclo." : `Fechou ${cyclesGained} ciclos.`,
      `${input.config.giName} ganhou ${massage} min de massagem (disponível: ${input.after.massagem.available}).`,
      `${input.config.lucasName} ganhou ${oral} min de boquete (disponível: ${input.after.boquete.available}).`,
      "",
      "Pra coletar: /coletar",
    );
  }

  lines.push("", formatBank(input.after));
  return lines.join("\n");
}

export function formatBalance(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.totalMinutes === 0) return formatEmptyAccount(config);

  const lines = [
    "Escada",
    `${current.totalMinutes} min no total · ${cycleLabel(current.cycles)} · ${current.bankMinutes} min no banco`,
    "",
    "Prêmios disponíveis",
    `${config.giName} — massagem: ${current.massagem.available} min (ganhou ${current.massagem.earned}, usou ${current.massagem.spent})`,
    `${config.lucasName} — boquete: ${current.boquete.available} min (ganhou ${current.boquete.earned}, usou ${current.boquete.spent})`,
    "",
    formatBank(current),
  ];

  if (current.massagem.available > 0 || current.boquete.available > 0) {
    lines.push("", "Pra coletar: /coletar");
  }

  return lines.join("\n");
}

export function formatNothingToCollect(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.totalMinutes === 0) return formatEmptyAccount(config);

  return [
    "Nenhum prêmio esperando.",
    "",
    formatBank(current),
    "",
    `${config.giName} coleta com /massagem. ${config.lucasName} coleta com /boquete.`,
  ].join("\n");
}

export function formatCollectMenu(
  config: Pick<Config, "giName" | "lucasName">,
  current: Balances,
): string {
  if (current.massagem.available === 0 && current.boquete.available === 0) {
    return formatNothingToCollect(config, current);
  }

  return [
    "Prêmio pra coletar",
    "",
    `${config.giName}: ${current.massagem.available} min de massagem`,
    `${config.lucasName}: ${current.boquete.available} min de boquete`,
    "",
    "O botão coleta tudo. Pra uma parte:",
    "/massagem 5",
    "/boquete 2",
  ].join("\n");
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
        `${when} · ${event.redemption.actorName} coletou ${event.redemption.minutes} min de ${event.redemption.kind}`,
      );
    }
  }
  return lines.join("\n");
}

export function formatRedeem(kind: RewardKind, minutes: number, after: Balances): string {
  const left = after[kind].available;
  if (left === 0) return `Coletei ${minutes} min de ${kind}. Essa conta zerou.`;
  return `Coletei ${minutes} min de ${kind}. Ainda tem ${left} min.`;
}

export function formatUndo(event: LedgerEvent): string {
  if (event.type === "session") {
    return `Tirei os ${event.session.minutes} min de escada.`;
  }
  return `Desfiz a coleta de ${event.redemption.minutes} min de ${event.redemption.kind}.`;
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

function formatBank(current: Balances): string {
  const bank = `${current.bankMinutes}/${CYCLE_MINUTES}`;
  if (current.bankMinutes === 0) {
    const target = current.totalMinutes === 0 ? "primeiro" : "próximo";
    return `Banco: ${bank} · faltam ${CYCLE_MINUTES} min pro ${target} prêmio.`;
  }
  return `Banco: ${bank} · faltam ${current.minutesToNextCycle} min pro próximo prêmio.`;
}

function cycleLabel(cycles: number): string {
  return cycles === 1 ? "1 ciclo" : `${cycles} ciclos`;
}

function formatEmptyAccount(config: Pick<Config, "giName" | "lucasName">): string {
  return [
    "Ainda não tem escada na conta.",
    "",
    `A cada ${CYCLE_MINUTES} min, ${config.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${config.lucasName} ganha ${ORAL_PER_CYCLE} min de boquete.`,
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
