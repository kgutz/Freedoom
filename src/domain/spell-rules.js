function cappedHealth(hp, maxHp) {
  return Math.max(0, Math.min(maxHp, hp));
}

export const LEVEL_EIGHT_DAILY_USES = 2;
export const LEVEL_EIGHT_COOLDOWN_MS = 60_000;
export const LEVEL_TWO_COOLDOWN_MS = 3_000;
export const ULTIMATE_HABIT_XP = 10;
export const ULTIMATE_HABIT_GOLD = 4;
export const ULTIMATE_COMPLETION_XP = 10;
export const ULTIMATE_COMPLETION_GOLD = 8;
export const ULTIMATE_WEEKLY_USES = 2;

export function ultimateHabitReward({ completedCount, target = 3 }) {
  const completesChallenge = completedCount >= target;
  return {
    xp: ULTIMATE_HABIT_XP + (completesChallenge ? ULTIMATE_COMPLETION_XP : 0),
    gold: ULTIMATE_HABIT_GOLD + (completesChallenge ? ULTIMATE_COMPLETION_GOLD : 0),
    completesChallenge,
  };
}

export function ultimateSpellAvailability({ game, currentWeek, today }) {
  const progress = game?.powerProgress || {};
  const uses = Math.max(0, Number(progress.ultimateWeekUses?.[currentWeek]) || 0);
  const active = progress.ultimateChallenge;
  return {
    uses,
    exhausted: uses >= ULTIMATE_WEEKLY_USES,
    challengeActive: Boolean(
      active
      && active.week === currentWeek
      && active.day === today
      && !active.rewarded,
    ),
  };
}

function normalizedLevelEightUse(value) {
  if (value === true) return { count: 1, lastUsedAt: 0, lastCompletedAt: 0 };
  if (Number.isFinite(Number(value))) {
    return { count: Math.max(0, Math.trunc(Number(value))), lastUsedAt: 0, lastCompletedAt: 0 };
  }
  return {
    count: Math.max(0, Math.trunc(Number(value?.count) || 0)),
    lastUsedAt: Math.max(0, Number(value?.lastUsedAt) || 0),
    lastCompletedAt: Math.max(0, Number(value?.lastCompletedAt) || 0),
  };
}

export function levelEightSpellAvailability({ game, spellId, today, nowTimestamp = Date.now() }) {
  const progress = game?.powerProgress || {};
  const use = normalizedLevelEightUse(progress.challengeDayUses?.[`${today}:${spellId}`]);
  const active = progress.habitChallenge;
  const activeTarget = active?.autoNextHabitCount || active?.habitIds?.length || 2;
  const challengeActive = active?.spellId === spellId
    && active?.day === today
    && (active?.completedIds?.length || 0) < activeTarget;
  const cooldownUntil = use.lastCompletedAt > 0
    ? use.lastCompletedAt + LEVEL_EIGHT_COOLDOWN_MS
    : 0;
  return {
    count: use.count,
    remainingUses: Math.max(0, LEVEL_EIGHT_DAILY_USES - use.count),
    exhausted: use.count >= LEVEL_EIGHT_DAILY_USES,
    challengeActive,
    cooldownUntil,
    cooldownRemainingMs: Math.max(0, cooldownUntil - nowTimestamp),
  };
}

export function completeLevelEightHabitChallenge({
  progress,
  habitId,
  today,
  completedAt = Date.now(),
}) {
  const current = progress || {};
  const challenge = current.habitChallenge;
  const completedIds = Array.isArray(challenge?.completedIds) ? challenge.completedIds : [];
  const selected = Array.isArray(challenge?.habitIds) && challenge.habitIds.includes(habitId);
  const automatic = Number(challenge?.autoNextHabitCount) > 0;
  const target = Math.max(1, Number(challenge?.autoNextHabitCount) || challenge?.habitIds?.length || 2);
  if (!challenge || challenge.day !== today || (!selected && !automatic) || completedIds.includes(habitId)) {
    return { progress: current, advanced: false, completed: false };
  }

  const nextCompletedIds = [...completedIds, habitId];
  const completed = nextCompletedIds.length >= target;
  const nextProgress = {
    ...current,
    challengeDayUses: { ...(current.challengeDayUses || {}) },
    habitChallenge: { ...challenge, completedIds: nextCompletedIds },
  };
  if (completed) {
    const useKey = `${today}:${challenge.spellId}`;
    const recordedUse = normalizedLevelEightUse(nextProgress.challengeDayUses[useKey]);
    nextProgress.challengeDayUses[useKey] = {
      ...recordedUse,
      count: Math.max(1, recordedUse.count),
      lastCompletedAt: completedAt,
    };
    delete nextProgress.habitChallenge;
  }
  return {
    progress: nextProgress,
    advanced: true,
    completed,
    spellId: challenge.spellId,
    completedCount: nextCompletedIds.length,
    target,
  };
}

export function levelTwoSpellAvailability({ game, spellId, nowTimestamp = Date.now() }) {
  const cooldownUntil = Math.max(
    0,
    Number(game?.powerProgress?.spellCooldowns?.[spellId]) || 0,
  );
  return {
    cooldownUntil,
    cooldownRemainingMs: Math.max(0, cooldownUntil - nowTimestamp),
  };
}

export function castSpellEffect({
  game,
  spell,
  level,
  currentWeek,
  today,
  nowTimestamp,
  maxHp,
  maxMp = 100,
  activeFailureChance = 0,
  passiveMultiplier = 1,
  smokeFreeMode = false,
  randomValue = Math.random(),
  manaDiscount = 0,
  selectedHabitIds = [],
  targetHabitId = null,
}) {
  if (!spell) return { ok: false, reason: 'unknown-spell' };
  if (level < spell.lvl) {
    return { ok: false, reason: 'level', requiredLevel: spell.lvl };
  }
  if (spell.ulti && (spell.modern
    ? ultimateSpellAvailability({ game, currentWeek, today }).exhausted
    : game.ultiW === currentWeek)) {
    return { ok: false, reason: 'ultimate-used' };
  }
  const progress = game.powerProgress || {};
  if (spell.modern && spell.ulti
    && ultimateSpellAvailability({ game, currentWeek, today }).challengeActive) {
    return { ok: false, reason: 'ultimate-active' };
  }
  if (spell.lvl === 8 && !spell.ulti) {
    const availability = levelEightSpellAvailability({ game, spellId: spell.id, today, nowTimestamp });
    if (availability.exhausted) return { ok: false, reason: 'challenge-used' };
    if (availability.challengeActive) return { ok: false, reason: 'challenge-active' };
    if (availability.cooldownRemainingMs > 0) {
      return {
        ok: false,
        reason: 'challenge-cooldown',
        cooldownRemainingMs: availability.cooldownRemainingMs,
        cooldownUntil: availability.cooldownUntil,
      };
    }
  }
  if (spell.lvl === 2 && !spell.ulti) {
    const availability = levelTwoSpellAvailability({ game, spellId: spell.id, nowTimestamp });
    if (availability.cooldownRemainingMs > 0) {
      return {
        ok: false,
        reason: 'spell-cooldown',
        cooldownRemainingMs: availability.cooldownRemainingMs,
        cooldownUntil: availability.cooldownUntil,
      };
    }
  }
  if (spell.habitChallenge && !spell.autoHabitChallenge) {
    const minimum = spell.ulti ? 3 : 2;
    if (selectedHabitIds.length < minimum && (!targetHabitId || spell.ulti)) {
      return { ok: false, reason: 'habits', requiredHabits: minimum };
    }
  }

  const mana = game.mp || 0;
  const effectiveCost = Math.max(
    0,
    spell.cost - Math.max(0, Math.round(Number(manaDiscount) || 0)),
  );
  if (mana < effectiveCost) {
    return {
      ok: false,
      reason: 'mana',
      requiredMana: effectiveCost,
      minimumMana: spell.id === 'alma',
    };
  }

  if (randomValue < activeFailureChance) {
    return {
      ok: false,
      reason: 'intoxicated',
      game: {
        ...game,
        buffs: { ...(game.buffs || {}) },
        mp: mana - effectiveCost,
      },
      spentMana: effectiveCost,
    };
  }

  const nextGame = {
    ...game,
    buffs: { ...(game.buffs || {}) },
  };
  nextGame.powerProgress = {
    ...(game.powerProgress || {}),
    challengeWeekUses: { ...(game.powerProgress?.challengeWeekUses || {}) },
    challengeDayUses: { ...(game.powerProgress?.challengeDayUses || {}) },
    spellCooldowns: { ...(game.powerProgress?.spellCooldowns || {}) },
    ultimateWeekUses: { ...(game.powerProgress?.ultimateWeekUses || {}) },
  };

  if (spell.modern && spell.hpCost) {
    const hpCost = Math.max(1, Math.round(maxHp * spell.hpCost / 100));
    if ((nextGame.hp || 0) <= hpCost) {
      return { ok: false, reason: 'health', requiredHealth: hpCost + 1 };
    }
    nextGame.hp -= hpCost;
  }

  if (spell.modern && spell.ulti) {
    nextGame.mp = mana - effectiveCost;
    nextGame.powerProgress.ultimateWeekUses[currentWeek] =
      (Number(nextGame.powerProgress.ultimateWeekUses[currentWeek]) || 0) + 1;
    nextGame.powerProgress.ultimateChallenge = {
      spellId: spell.id,
      habitIds: [...new Set(selectedHabitIds)].slice(0, 3),
      completedIds: [],
      day: today,
      week: currentWeek,
      startedAt: nowTimestamp,
      rewarded: false,
    };
    return { ok: true, game: nextGame, spentMana: effectiveCost, healing: 0 };
  }

  if (spell.id === 'alma') {
    const spentMana = Math.max(0, mana - Math.max(0, Math.round(manaDiscount)));
    const healing = Math.floor(spentMana / 2);
    const hpBefore = nextGame.hp;
    nextGame.hp = cappedHealth(nextGame.hp + healing, maxHp);
    nextGame.mp = mana - spentMana;
    nextGame.ultiW = currentWeek;
    return {
      ok: true,
      game: nextGame,
      spentMana,
      healing: nextGame.hp - hpBefore,
    };
  }

  nextGame.mp = mana - effectiveCost;
  const result = {
    ok: true,
    game: nextGame,
    spentMana: effectiveCost,
    healing: 0,
  };

  switch (spell.id) {
    case 'ceniza': {
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: spell.autoHabitChallenge ? [] : [...new Set(selectedHabitIds)].slice(0, 2),
          autoNextHabitCount: spell.autoHabitChallenge ? 2 : 0,
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        break;
      }
      result.durationHours =
        level >= 12 ? 2 + passiveMultiplier : 2;
      nextGame.buffs.cenizaUntil =
        nowTimestamp + result.durationHours * 3_600_000;
      break;
    }
    case 'muro':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        break;
      }
      nextGame.buffs.shield = (nextGame.buffs.shield || 0) + 2;
      break;
    case 'grito': {
      const hpBefore = nextGame.hp;
      const amount = spell.modern ? Math.round(maxHp * 0.1) : 20;
      nextGame.hp = cappedHealth(nextGame.hp + amount, maxHp);
      if (spell.modern) nextGame.buffs.knightGuard = { amount: 2, day: today };
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'bastion':
      nextGame.buffs.bastion = true;
      nextGame.ultiW = currentWeek;
      break;
    case 'certero':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        break;
      }
      if(smokeFreeMode){
        nextGame.buffs.habitFocusCharges=(nextGame.buffs.habitFocusCharges||0)+2;
      }else{
        nextGame.buffs.certeroUntil = nowTimestamp + 3_600_000;
      }
      break;
    case 'luz':
      if (spell.modern) {
        const hpBefore = nextGame.hp;
        nextGame.hp = cappedHealth(nextGame.hp + Math.round(maxHp * 0.1), maxHp);
        nextGame.buffs.paladinManaHabit = true;
        result.healing = nextGame.hp - hpBefore;
        break;
      }
    case 'balsamo': {
      const hpBefore = nextGame.hp;
      if (spell.modern) {
        nextGame.hp = cappedHealth(nextGame.hp + Math.round(maxHp * 0.06), maxHp);
        nextGame.buffs.balm = {
          remaining: Math.round(maxHp * 0.09),
          startedAt: nowTimestamp,
          until: nowTimestamp + 30 * 60_000,
        };
      } else nextGame.hp = cappedHealth(nextGame.hp + 15, maxHp);
      result.healing = nextGame.hp - hpBefore;
      break;
    }
    case 'juicio':
      if (spell.modern) {
        nextGame.powerProgress.judgment = {
          habitIds: [...new Set(selectedHabitIds)].slice(0, 3),
          completedIds: [],
          day: today,
          rewarded: false,
        };
        nextGame.ultiW = currentWeek;
        break;
      }
      nextGame.judgmentDays = [...(nextGame.judgmentDays || [])];
      if (!nextGame.judgmentDays.includes(today)) {
        nextGame.judgmentDays.push(today);
      }
      nextGame.ultiW = currentWeek;
      break;
    case 'peste':
      if (spell.modern) {
        const hpBefore = nextGame.hp;
        const amount = Math.round(maxHp * 0.08);
        nextGame.hp = cappedHealth(nextGame.hp + amount, maxHp);
        result.healing = nextGame.hp - hpBefore;
        break;
      }
      if(smokeFreeMode){
        nextGame.pestXpDays=[...(nextGame.pestXpDays||[])];
        if(!nextGame.pestXpDays.includes(today)) nextGame.pestXpDays.push(today);
      }else{
        nextGame.buffs.pesteDay = today;
      }
      break;
    case 'regen':
      if (spell.habitChallenge) {
        nextGame.powerProgress.habitChallenge = {
          spellId: spell.id,
          habitIds: [...new Set(selectedHabitIds)].slice(0, 2),
          completedIds: [],
          day: today,
          week: currentWeek,
        };
        break;
      }
      nextGame.buffs.regenUntil = nowTimestamp + 2 * 3_600_000;
      break;
    case 'renacer':
      if (spell.modern) {
        nextGame.powerProgress.rebirthHabit = {
          habitId: targetHabitId || selectedHabitIds[0],
          progress: 0,
          entryKeys: [],
          startedAt: nowTimestamp,
          expiresAt: nowTimestamp + 7 * 24 * 3_600_000,
          completed: false,
        };
        nextGame.ultiW = currentWeek;
        break;
      }
      nextGame.buffs.renacer = true;
      nextGame.ultiW = currentWeek;
      break;
    default:
      return { ok: false, reason: 'unknown-spell' };
  }

  if (spell.lvl === 8 && !spell.ulti) {
    const key = `${today}:${spell.id}`;
    const previousUse = normalizedLevelEightUse(game.powerProgress?.challengeDayUses?.[key]);
    nextGame.powerProgress.challengeDayUses[key] = {
      count: previousUse.count + 1,
      lastUsedAt: nowTimestamp,
      lastCompletedAt: previousUse.lastCompletedAt,
    };
    result.dailyUses = previousUse.count + 1;
    result.cooldownUntil = nowTimestamp + LEVEL_EIGHT_COOLDOWN_MS;
  }
  if (spell.lvl === 2 && !spell.ulti) {
    result.cooldownUntil = nowTimestamp + LEVEL_TWO_COOLDOWN_MS;
    nextGame.powerProgress.spellCooldowns[spell.id] = result.cooldownUntil;
  }

  return result;
}
