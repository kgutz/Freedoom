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
  else if (classId === 'knight' && level >= 12) {
    hp = Math.round(maxHp * (0.75 + 0.1 * passiveMultiplier));
  } else {
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
}) {
  const baseInterval =
    classId === 'druid'&&druidFastRegeneration ? 10 - 3 * passiveMultiplier : 10;
  return regenerationActive ? baseInterval / 2 : baseInterval;
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
}) {
  const intervalMs =
    regenerationIntervalMinutes({
      classId,
      regenerationActive,
      passiveMultiplier,
      druidFastRegeneration,
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
  classId,
  level,
  passiveMultiplier = 1,
}) {
  return {
    healing:
      classId === 'druid' && level >= 5
        ? 15 + Math.round(5 * passiveMultiplier)
        : 15,
    mana: 15,
  };
}

export const BEER_DAMAGE = 5;
