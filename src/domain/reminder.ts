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

export function reminderFacts(input: {
  giName: string;
  lucasName: string;
  current: Balances;
  everLogged: boolean;
  loggedToday: boolean;
  lucasClimbedToday: boolean;
  giClimbedToday: boolean;
  streak: number;
}): string {
  return [
    `Casal: ${input.lucasName} e ${input.giName}.`,
    `Já existiu escada na conta: ${input.everLogged ? "sim" : "não"}.`,
    `Alguém subiu hoje: ${input.loggedToday ? "sim" : "não"}.`,
    `Sequência de dias com escada: ${input.streak}.`,
    `Regra: a cada ${CYCLE_MINUTES} min da própria escada, ${input.giName} ganha ${MASSAGE_PER_CYCLE} min de massagem e ${input.lucasName} ganha uma recompensa de ${ORAL_PER_CYCLE} min.`,
    personFacts(input.lucasName, input.current.lucas, ORAL_PER_CYCLE, "recompensa", input.lucasClimbedToday),
    personFacts(input.giName, input.current.gi, MASSAGE_PER_CYCLE, "massagem", input.giClimbedToday),
  ].join("\n");
}

function personFacts(
  name: string,
  side: Balances["lucas"],
  perCycle: number,
  prize: string,
  climbedToday: boolean,
): string {
  const open = openAccount(side, perCycle);
  const available = Math.max(0, side.reward.available);
  const spent = Math.max(0, side.reward.spent);
  const ready = perCycle > 0 ? Math.floor(available / perCycle) : 0;
  const collected = perCycle > 0 ? Math.floor(spent / perCycle) : 0;
  const collect =
    prize === "recompensa"
      ? `pode coletar: ${rewardOffer(ready, perCycle)}.`
      : `${prize} disponível para coletar: ${available} min.`;
  const done =
    prize === "recompensa"
      ? `recompensas já coletadas: ${collected}.`
      : `${prize} já coletada: ${spent} min.`;
  return [
    `${name}:`,
    `minutos que ainda valem: ${open.totalMinutes}.`,
    `subiu hoje: ${climbedToday ? "sim" : "não"}.`,
    collect,
    done,
  ].join(" ");
}

function rewardOffer(ready: number, perCycle: number): string {
  if (ready === 1) return `1 recompensa de ${perCycle} min`;
  if (ready > 1) return `${ready} recompensas de ${perCycle} min`;
  return "0";
}
