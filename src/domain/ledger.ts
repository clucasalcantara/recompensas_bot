import {
  CYCLE_MINUTES,
  MAX_SESSION_MINUTES,
  REWARD_PER_CYCLE,
  type RewardKind,
} from "./rules.js";

export type Owner = "lucas" | "gi";

export type SessionInput = { minutes: number; owner?: Owner };
export type RedemptionInput = { kind: RewardKind; minutes: number };

export type Bucket = {
  earned: number;
  spent: number;
  available: number;
};

export type Side = {
  totalMinutes: number;
  cycles: number;
  bankMinutes: number;
  minutesToNextCycle: number;
  reward: Bucket;
};

export type Balances = {
  lucas: Side;
  gi: Side;
  massagem: Bucket;
  boquete: Bucket;
};

export type DomainError =
  | "minutes-invalid"
  | "minutes-too-long"
  | "not-enough"
  | "undo-would-overdraw";

export type OpenView = {
  totalMinutes: number;
  cycles: number;
  bankMinutes: number;
  minutesToNextCycle: number;
};

export function openAccount(
  side: { totalMinutes: number; reward: { spent: number } },
  perCycle: number,
): OpenView {
  const closed = perCycle > 0 ? Math.floor(side.reward.spent / perCycle) : 0;
  const totalMinutes = Math.max(0, side.totalMinutes - closed * CYCLE_MINUTES);
  const cycles = Math.floor(totalMinutes / CYCLE_MINUTES);
  const bankMinutes = totalMinutes % CYCLE_MINUTES;

  return {
    totalMinutes,
    cycles,
    bankMinutes,
    minutesToNextCycle: CYCLE_MINUTES - bankMinutes,
  };
}

export function sessionError(minutes: number): DomainError | null {
  if (!Number.isInteger(minutes) || minutes <= 0) return "minutes-invalid";
  if (minutes > MAX_SESSION_MINUTES) return "minutes-too-long";
  return null;
}

export function balances(
  sessions: SessionInput[],
  redemptions: RedemptionInput[],
): Balances {
  const lucas = side(sessions, "lucas", "boquete", redemptions);
  const gi = side(sessions, "gi", "massagem", redemptions);

  return {
    lucas,
    gi,
    massagem: gi.reward,
    boquete: lucas.reward,
  };
}

export function redeemError(
  current: Balances,
  kind: RewardKind,
  minutes: number,
): DomainError | null {
  if (!Number.isInteger(minutes) || minutes <= 0) return "minutes-invalid";
  if (minutes > current[kind].available) return "not-enough";
  return null;
}

export function undoSessionError(
  sessions: SessionInput[],
  redemptions: RedemptionInput[],
  index: number,
): DomainError | null {
  const next = sessions.filter((_, i) => i !== index);
  const after = balances(next, redemptions);
  if (after.massagem.available < 0 || after.boquete.available < 0) {
    return "undo-would-overdraw";
  }
  return null;
}

function side(
  sessions: SessionInput[],
  owner: Owner,
  kind: RewardKind,
  redemptions: RedemptionInput[],
): Side {
  const totalMinutes = sessions
    .filter((session) => (session.owner ?? "lucas") === owner)
    .reduce((sum, session) => sum + session.minutes, 0);
  const cycles = Math.floor(totalMinutes / CYCLE_MINUTES);
  const bankMinutes = totalMinutes % CYCLE_MINUTES;

  return {
    totalMinutes,
    cycles,
    bankMinutes,
    minutesToNextCycle: CYCLE_MINUTES - bankMinutes,
    reward: bucket(kind, cycles, redemptions),
  };
}

function bucket(
  kind: RewardKind,
  cycles: number,
  redemptions: RedemptionInput[],
): Bucket {
  const earned = cycles * REWARD_PER_CYCLE[kind];
  const spent = redemptions
    .filter((redemption) => redemption.kind === kind)
    .reduce((sum, redemption) => sum + redemption.minutes, 0);

  return { earned, spent, available: earned - spent };
}
