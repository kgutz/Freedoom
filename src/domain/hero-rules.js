function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function dailyRecovery({
  completedDay,
  currentMana,
  maxHp,
  maxMp,
  classId,
  level,
  rebirthActive = false,
  passiveMultiplier = 1,
}) {
  if (completedDay) {
    return { hp: maxHp, mp: maxMp };
  }

  let hp;
  if (rebirthActive) hp = maxHp;
  else {
    hp = Math.round(maxHp * 0.75);
  }

  return { hp, mp: currentMana };
}

export function weeklyBossPenalty({ hp, maxHp, maxMp, damageRate=0.3 }) {
  return {
    hp: clamp(hp - Math.round(maxHp * damageRate), 0, maxHp),
    mp: Math.round(maxMp * 0.2),
  };
}

export function regenerationIntervalMinutes({
  classId,
  regenerationActive = false,
  passiveMultiplier = 1,
  druidFastRegeneration = true,
  additiveMinutesReduction = 0,
}) {
  const baseInterval = 10;
  const reducedInterval = Math.max(
    1,
    baseInterval - Math.max(0, Number(additiveMinutesReduction) || 0),
  );
  return regenerationActive ? reducedInterval / 2 : reducedInterval;
}

export function regenerateHealth({
  hp,
  hpTimestamp,
  nowTimestamp,
  maxHp,
  classId,
  regenerationActive = false,
  passiveMultiplier = 1,
  druidFastRegeneration = true,
  additiveMinutesReduction = 0,
}) {
  const intervalMs =
    regenerationIntervalMinutes({
      classId,
      regenerationActive,
      passiveMultiplier,
      druidFastRegeneration,
      additiveMinutesReduction,
    }) * 60_000;
  const elapsed = Math.max(0, nowTimestamp - hpTimestamp);
  const ticks = Math.floor(elapsed / intervalMs);

  if (ticks <= 0) {
    return { hp, hpTimestamp, ticks: 0 };
  }

  return {
    hp: clamp(hp + ticks, 0, maxHp),
    hpTimestamp: hpTimestamp + ticks * intervalMs,
    ticks,
  };
}

export function pillCompletionReward({
  maxHp,
  maxMp,
}) {
  return {
    healing: Math.max(1, Math.round(Math.max(0, Number(maxHp) || 0) * 0.15)),
    mana: Math.max(1, Math.round(Math.max(0, Number(maxMp) || 0) * 0.15)),
  };
}

export function habitCompletionRecovery({
  maxHp,
  maxMp,
  rewardedCount = 0,
  rewardRate = 0.05,
  dailyCapRate = 0.25,
}) {
  const safeRewardRate = Math.max(0, Number(rewardRate) || 0);
  const safeCapRate = Math.max(0, Number(dailyCapRate) || 0);
  const maxRewards = safeRewardRate > 0 ? Math.floor(safeCapRate / safeRewardRate) : 0;
  if (Math.max(0, Number(rewardedCount) || 0) >= maxRewards) {
    return { healing: 0, mana: 0, capped: true };
  }
  return {
    healing: Math.max(1, Math.round(Math.max(0, Number(maxHp) || 0) * safeRewardRate)),
    mana: Math.max(1, Math.round(Math.max(0, Number(maxMp) || 0) * safeRewardRate)),
    capped: false,
  };
}

export const BEER_DAMAGE = 5;
