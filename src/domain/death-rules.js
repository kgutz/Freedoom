import { levelFromXp } from './progression.js';

export const DEATH_XP_LOSS_PERCENT = 10;
export const DEATH_PROTECTED_MAX_LEVEL = 4;

export function deathExperiencePenalty({
  xp = 0,
  level = levelFromXp(xp),
  lossPercent = DEATH_XP_LOSS_PERCENT,
  protectedMaxLevel = DEATH_PROTECTED_MAX_LEVEL,
} = {}) {
  const safeXp = Math.max(0, Math.round(Number(xp) || 0));
  const safeLevel = Math.max(1, Math.round(Number(level) || levelFromXp(safeXp)));
  const protectedLevel = safeLevel <= Math.max(0, Number(protectedMaxLevel) || 0);
  const currentThreshold = 35 * (safeLevel - 1) * (safeLevel - 1);
  const nextThreshold = 35 * safeLevel * safeLevel;
  const levelXp = Math.max(1, nextThreshold - currentThreshold);
  const requestedLoss = protectedLevel
    ? 0
    : Math.max(1, Math.round(levelXp * Math.max(0, Number(lossPercent) || 0) / 100));
  const previousLevelThreshold = safeLevel > 1
    ? 35 * (safeLevel - 2) * (safeLevel - 2)
    : 0;
  const xpAfter = Math.max(previousLevelThreshold, safeXp - requestedLoss);
  const xpLost = Math.max(0, safeXp - xpAfter);

  return {
    xpBefore: safeXp,
    xpAfter,
    xpLost,
    levelBefore: safeLevel,
    levelAfter: levelFromXp(xpAfter),
    levelXp,
    lossPercent: Math.max(0, Number(lossPercent) || 0),
    protected: protectedLevel,
  };
}
