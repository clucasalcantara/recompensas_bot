export const CYCLE_MINUTES = 60;
export const MASSAGE_PER_CYCLE = 5;
export const ORAL_PER_CYCLE = 2;
export const MAX_SESSION_MINUTES = 240;

export type RewardKind = "massagem" | "boquete";

export const REWARD_PER_CYCLE: Record<RewardKind, number> = {
  massagem: MASSAGE_PER_CYCLE,
  boquete: ORAL_PER_CYCLE,
};
