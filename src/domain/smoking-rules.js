function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function timeOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function smokeTimeOfDay(timestamp) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : timeOfDay(date);
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
}) {
  const smoked = record.c || 0;
  const smokedAfter = smoked + 1;
  const nowMinutes = timeOfDay(now);
  const awakeMinutes = Math.max(60, sleepMinutes - wakeMinutes);
  const dayFraction = clamp(
    (nowMinutes - wakeMinutes) / awakeMinutes,
    0,
    1,
  );
  const expected = limit * dayFraction;
  let damage;
  let perfect = false;

  if (smoked === 0 && nowMinutes >= wakeMinutes) {
    damage = 0;
  } else if (smoked === 0 && nowMinutes < wakeMinutes) {
    damage = 15;
  } else if (limit <= 0 || smokedAfter > limit) {
    damage = classId === 'knight' && level >= 5 ? 18 : 25;
  } else {
    const lastSmokeMinutes = smokeTimeOfDay(record.t);
    if (lastSmokeMinutes !== null) {
      const cigarettesLeft = limit - smoked;
      const remainingMinutes = sleepMinutes - lastSmokeMinutes;
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
  if (
    damage > 0 &&
    classId === 'druid' &&
    level >= 12 &&
    rootsDay !== today
  ) {
    consumesRoots = true;
    damage = 0;
  }

  if (damage > 0 && classId === 'sorcerer') {
    damage = Math.max(1, damage - 2);
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
    healing: perfect && classId === 'paladin' && level >= 5 ? 3 : 0,
  };
}

export function perfectShotRewards({
  perfect,
  classId,
  marksmanActive = false,
  ashCurseActive = false,
}) {
  if (!perfect) return { xp: 0, mana: 0 };

  return {
    xp: marksmanActive ? 8 : classId === 'paladin' ? 4 : 2,
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
