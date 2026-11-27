import type { Balances } from "./ledger.js";
import { CYCLE_MINUTES, MASSAGE_PER_CYCLE, ORAL_PER_CYCLE } from "./rules.js";
import { zonedStamp } from "./time.js";

export function shouldSendReminder(input: {
  now: Date;
  timeZone: string;
  hour: number;
  minute: number;
  lastSentOn: string | null;
}): boolean {
  const local = zonedStamp(input.now, input.timeZone);
  if (input.lastSentOn === local.date) return false;
  return local.hour * 60 + local.minute >= input.hour * 60 + input.minute;
}

export function buildReminder(input: {
  giName: string;
  lucasName: string;
  current: Balances;
  everLogged: boolean;
  loggedToday: boolean;
  streak: number;
  tip: string;
}): string {
  if (!input.everLogged) {
    return [
      "A escada ainda não começou.",
      "",
      `A cada ${CYCLE_MINUTES} min da própria escada, ${input.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${input.lucasName} ganha ${ORAL_PER_CYCLE} min de mamadinha. O que sobra fica no banco de quem subiu.`,
      "",
      `Dica: ${input.tip}`,
    ].join("\n");
  }

  const lines = [
    input.loggedToday ? "Hoje a escada já entrou." : "Hoje ainda não teve escada.",
    streakLine(input.streak, input.loggedToday),
    "",
    bankLine(input),
    "",
    `Dica: ${input.tip}`,
  ];

  return lines.join("\n");
}

function bankLine(input: { giName: string; lucasName: string; current: Balances }): string {
  return [sideBank(input.lucasName, input.current.lucas), sideBank(input.giName, input.current.gi)].join(
    "\n",
  );
}

function sideBank(name: string, side: Balances["lucas"]): string {
  if (side.totalMinutes === 0) return `${name} zerada.`;
  const left = side.bankMinutes === 0 ? CYCLE_MINUTES : side.minutesToNextCycle;
  return `${name}: ${side.bankMinutes} min no banco. Faltam ${left} min.`;
}

function streakLine(streak: number, loggedToday: boolean): string {
  if (streak === 0) return "Sequência parada.";
  const days = streak === 1 ? "1 dia" : `${streak} dias`;
  if (!loggedToday) return `Sequência: ${days}. Hoje ainda dá tempo de não quebrar.`;
  return `Sequência: ${days}.`;
}
