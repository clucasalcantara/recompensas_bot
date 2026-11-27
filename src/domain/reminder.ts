import { openAccount, type Balances } from "./ledger.js";
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
  lucasClimbedToday: boolean;
  giClimbedToday: boolean;
  streak: number;
}): string {
  if (!input.everLogged) {
    return [
      "Oi, vocês dois.",
      "",
      "A escada ainda não começou.",
      `A cada ${CYCLE_MINUTES} min da própria escada, ${input.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${input.lucasName} ganha ${ORAL_PER_CYCLE} min de mamadinha.`,
    ].join("\n");
  }

  return [
    "Oi, vocês dois.",
    "",
    dayLine(input),
    "",
    personLine(input.lucasName, input.current.lucas, ORAL_PER_CYCLE, "mamadinha", input.lucasClimbedToday),
    personLine(input.giName, input.current.gi, MASSAGE_PER_CYCLE, "massagem", input.giClimbedToday),
    "",
    input.loggedToday ? "Se sobrar fôlego, ela aceita mais." : "A escada está lá quando vocês quiserem.",
  ].join("\n");
}

function dayLine(input: { loggedToday: boolean; streak: number; lucasClimbedToday: boolean; giClimbedToday: boolean }): string {
  if (input.lucasClimbedToday && input.giClimbedToday) {
    return input.streak > 1 ? `Hoje os dois já subiram. São ${input.streak} dias seguidos.` : "Hoje os dois já subiram.";
  }
  if (!input.loggedToday && input.streak > 1) {
    return `Hoje a escada ainda está parada. A sequência de ${input.streak} dias aguenta mais uma subida.`;
  }
  if (!input.loggedToday && input.streak === 1) return "Ontem teve escada. Hoje ela ainda está esperando.";
  if (!input.loggedToday) return "Hoje a escada ainda está parada.";
  return input.streak > 1 ? `Hoje a escada já andou. São ${input.streak} dias seguidos.` : "Hoje a escada já andou.";
}

function personLine(
  name: string,
  side: Balances["lucas"],
  perCycle: number,
  prize: string,
  climbedToday: boolean,
): string {
  const open = openAccount(side, perCycle);
  const available = Math.max(0, side.reward.available);
  const spent = Math.max(0, side.reward.spent);

  if (open.totalMinutes === 0 && spent === 0) {
    return `${name}, a sua escada ainda está zerada.`;
  }

  if (open.totalMinutes === 0) {
    const today = climbedToday ? "Hoje você já passou por ela." : "Hoje a sua ainda não andou.";
    return `${name}, você já coletou ${spent} min de ${prize}. ${today}`;
  }

  const today = climbedToday ? "Hoje você já subiu." : "Hoje você ainda não subiu.";
  if (available > 0) {
    return `${name}, você tem ${open.totalMinutes} min. ${today} Dá pra coletar ${available} min de ${prize}, ou deixar crescer.`;
  }
  const left = open.bankMinutes === 0 ? CYCLE_MINUTES : open.minutesToNextCycle;
  return `${name}, você tem ${open.totalMinutes} min. ${today} Faltam ${left} min pra fechar a próxima.`;
}
