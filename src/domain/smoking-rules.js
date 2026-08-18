import {
  passiveActivates,
  scalePassiveAmount,
  scalePassiveUpgrade,
} from './intoxication-rules.js';
import {
  DEFAULT_DAY_START_TIME,
  logicalClockMinutes,
  logicalTimeMinutes,
} from './day-boundary-rules.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timeOfDay(date, dayStartTime) {
  return logicalTimeMinutes(date, dayStartTime);
}

function smokeTimeOfDay(timestamp, dayStartTime) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : timeOfDay(date, dayStartTime);
}

export function evaluateSmoke({
  now,
  today,
  record,
  limit,
  wakeMinutes,
  sleepMinutes,
  classId,
  level,
  rootsDay,
  pestActive = false,
  armor = 0,
  shieldCharges = 0,
  passiveMultiplier = 1,
  passiveRandomValue = Math.random(),
  dayStartTime = DEFAULT_DAY_START_TIME,
}) {
  const smoked = record.c || 0;
  const smokedAfter = smoked + 1;
  const nowMinutes = timeOfDay(now, dayStartTime);
  const logicalWakeMinutes = logicalClockMinutes(wakeMinutes, dayStartTime);
  const logicalSleepMinutes = logicalClockMinutes(sleepMinutes, dayStartTime);
  const awakeMinutes = Math.max(
    60,
    logicalSleepMinutes - logicalWakeMinutes,
  );
  const dayFraction = clamp(
    (nowMinutes - logicalWakeMinutes) / awakeMinutes,
    0,
    1,
  );
  const expected = limit * dayFraction;
  let damage;
  let perfect = false;

  if (smoked === 0 && nowMinutes >= logicalWakeMinutes) {
    damage = 0;
  } else if (smoked === 0 && nowMinutes < logicalWakeMinutes) {
    damage = 15;
  } else if (limit <= 0 || smokedAfter > limit) {
    damage = 25;
  } else {
    const lastSmokeMinutes = smokeTimeOfDay(record.t, dayStartTime);
    if (lastSmokeMinutes !== null) {
      const cigarettesLeft = limit - smoked;
      const remainingMinutes = logicalSleepMinutes - lastSmokeMinutes;
      if (remainingMinutes > 0 && cigarettesLeft > 0) {
        const nextSmokeMinutes =
          lastSmokeMinutes +
          Math.max(10, Math.round(remainingMinutes / cigarettesLeft));
        perfect = nowMinutes >= nextSmokeMinutes;
      }
    }

    const ratio =
      expected > 0.3 ? smokedAfter / expected : smokedAfter <= 1 ? 0 : 2;
    if (perfect || ratio <= 1) damage = 0;
    else if (ratio <= 1.5) damage = 8;
    else damage = 15;
  }

  let consumesRoots = false;
  const rootsEligible = false;
  if (rootsEligible) {
    consumesRoots = true;
    if (passiveActivates(passiveMultiplier, passiveRandomValue)) {
      damage = 0;
    }
  }

  if (damage > 0 && pestActive) {
    damage = Math.max(1, Math.round(damage / 2));
  }
  if (damage > 0) {
    damage = Math.max(1, damage - armor);
  }

  let shielded = false;
  if (damage > 0 && shieldCharges > 0) {
    shielded = true;
    damage = 0;
  }

  return {
    dmg: damage,
    perfect,
    shielded,
    consumesRoots,
    consumesShield: shielded,
    healing:0,
  };
}

export function perfectShotRewards({
  perfect,
  classId,
  marksmanActive = false,
  ashCurseActive = false,
  passiveMultiplier = 1,
}) {
  if (!perfect) return { xp: 0, mana: 0 };

  return {
    xp: marksmanActive
      ? 5
      : 2,
    mana: ashCurseActive ? 20 : 10,
  };
}

export function smokeUndoEffects(entry) {
  if (typeof entry === 'number') {
    return {
      damage: entry,
      perfect: false,
      xp: 0,
      mana: 0,
      healing: 0,
      restoreRoots: false,
      restoreShield: false,
    };
  }

  const perfect = Boolean(entry?.p);
  return {
    damage: entry?.d || 0,
    perfect,
    xp: entry?.x || 0,
    mana: entry?.m ?? (perfect ? 10 : 0),
    healing: entry?.h || 0,
    restoreRoots: Boolean(entry?.r),
    restoreShield: Boolean(entry?.sh),
  };
}
