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
  dare: string;
}): string {
  if (!input.everLogged) {
    return [
      "A escada ainda não começou.",
      "",
      `A cada ${CYCLE_MINUTES} min, ${input.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${input.lucasName} ganha ${ORAL_PER_CYCLE} min de boquete. O que sobra fica no banco.`,
      "",
      `Dica de hoje: ${input.tip}`,
      "",
      `Brincadeira: ${input.dare}`,
      "",
      "Quando subirem: /escada 20",
    ].join("\n");
  }

  const prize = prizeLine(input);
  const lines = [
    input.loggedToday
      ? "Hoje a escada já entrou."
      : "Hoje ainda não teve escada.",
    streakLine(input.streak, input.loggedToday),
    "",
    bankLine(input.current),
  ];

  if (prize) lines.push("", prize);

  lines.push(
    "",
    input.loggedToday
      ? "O cardio de hoje já tá feito. O resto é clima, e não mexe no saldo."
      : "Dá pra andar o banco sem fechar o ciclo.",
    "",
    `Dica: ${input.tip}`,
    "",
    `Brincadeira: ${input.dare}`,
  );

  return lines.join("\n");
}

function bankLine(current: Balances): string {
  if (current.bankMinutes === 0) {
    return `Banco 0/${CYCLE_MINUTES}. Faltam ${CYCLE_MINUTES} min pro próximo prêmio.`;
  }
  return `Banco ${current.bankMinutes}/${CYCLE_MINUTES}. Faltam ${current.minutesToNextCycle} min pro próximo prêmio.`;
}

function prizeLine(input: {
  giName: string;
  lucasName: string;
  current: Balances;
}): string | null {
  const lines: string[] = [];
  if (input.current.massagem.available > 0) {
    lines.push(
      `${input.giName} tem ${input.current.massagem.available} min de massagem pra coletar.`,
    );
  }
  if (input.current.boquete.available > 0) {
    lines.push(
      `${input.lucasName} tem ${input.current.boquete.available} min de boquete pra coletar.`,
    );
  }
  if (lines.length === 0) return null;
  lines.push("É só mandar /coletar.");
  return lines.join("\n");
}

function streakLine(streak: number, loggedToday: boolean): string {
  if (streak === 0) return "Sequência parada.";
  const days = streak === 1 ? "1 dia" : `${streak} dias`;
  if (!loggedToday) return `Sequência: ${days}. Hoje ainda dá tempo de não quebrar.`;
  return `Sequência: ${days}.`;
}
