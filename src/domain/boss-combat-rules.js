import { BOSSES, BOSS_SLUGS } from '../data/game-data.js';
import { daysBetween, keyOf } from './date-utils.js';
import {
  limitForWeek,
  weekIndexFor,
  weekRangeFor,
} from './plan-rules.js';
import {
  SMOKE_FREE_STATUS_SMOKED,
  SMOKE_FREE_STATUS_SUCCESS,
  bossCountForJourney,
  controlledWeeklyLimitOf,
  isControlledMode,
  isControlledSmokingDay,
  isSmokeFreeMode,
  journeyConfigForDate,
  smokeFreeStatusOf,
} from './journey-mode-rules.js';

export const BOSS_MAX_HP = 150;
export const BOSS_REQUIRED_DAYS = 6;
export const BOSS_DAY_DAMAGE = 25;
export const BOSS_CRITICAL_DAMAGE = 10;
export const BOSS_MARGIN_DAMAGE = 2;
export const BOSS_MARGIN_DAMAGE_CAP = 10;
export const BOSS_PERFECT_DAMAGE = 1;
export const BOSS_PERFECT_DAMAGE_CAP = 3;
export const BOSS_ZERO_DAY_DAMAGE = 15;

export function earlyVictoryId(week, bossIndex) {
  return `boss_reward_${String(Math.max(0, bossIndex) + 1).padStart(2, '0')}:early-victory:week-${Math.max(0, week)}`;
}

const EMPTY_DAY = { c: 0, p: 0, s: 0 };

function recordOf(days, key) {
  return days[key] || EMPTY_DAY;
}

function bossIdentity(index, bossCount = BOSSES.length) {
  const safeIndex = Math.min(
    Math.max(0, index || 0),
    bossCount - 1,
  );
  return {
    bossIndex: safeIndex,
    bossNum: safeIndex + 1,
    name: BOSSES[safeIndex],
    slug: BOSS_SLUGS[safeIndex],
  };
}

export function calculateDailyBossDamage({
  record = EMPTY_DAY,
  limit,
  settled,
  journeyMode,
  takesPills = true,
  pillsGoal = 3,
  controlledAllowedDay = false,
  controlledBudgetExceeded = false,
}) {
  if (journeyMode === 'smoke_free') {
    const status = smokeFreeStatusOf(record);
    const completed = status === SMOKE_FREE_STATUS_SUCCESS;
    const completion = settled && completed ? BOSS_DAY_DAMAGE : 0;
    return {
      completed,
      completion,
      margin: 0,
      pills: 0,
      perfect: 0,
      zero: 0,
      total: completion,
    };
  }
  if (journeyMode === 'controlled') {
    const completed = controlledAllowedDay
      ? !controlledBudgetExceeded
      : smokeFreeStatusOf(record) === SMOKE_FREE_STATUS_SUCCESS;
    const completion = settled && completed ? BOSS_DAY_DAMAGE : 0;
    return {
      completed,
      completion,
      margin: 0,
      pills: 0,
      perfect: 0,
      zero: 0,
      total: completion,
    };
  }
  const cigarettes = Math.max(0, record.c || 0);
  const completed = cigarettes <= limit;
  const perfect = Math.min(
    BOSS_PERFECT_DAMAGE_CAP,
    Math.max(0, record.s || 0) * BOSS_PERFECT_DAMAGE,
  );
  const pills = 0;
  const completion =
    settled && completed ? BOSS_DAY_DAMAGE : 0;
  const margin =
    settled && completed
      ? Math.min(
          BOSS_MARGIN_DAMAGE_CAP,
          Math.max(0, limit - cigarettes) * BOSS_MARGIN_DAMAGE,
        )
      : 0;
  const zero =
    settled && completed && cigarettes === 0
      ? BOSS_ZERO_DAY_DAMAGE
      : 0;

  return {
    completed,
    completion,
    margin,
    pills,
    perfect,
    zero,
    total: completion + margin + pills + perfect + zero,
  };
}

export function createBossCombat({
  currentWeek,
  legacyBossesDown = 0,
  maxBosses = BOSSES.length,
}) {
  const safeLegacy = Math.min(maxBosses, Math.max(0, legacyBossesDown || 0));
  return {
    version: 5,
    startedWeek: currentWeek,
    legacyBossesDown: safeLegacy,
    defeated: 0,
    bossIndex: Math.min(safeLegacy, maxBosses - 1),
    week: currentWeek,
    hpAtWeekStart: BOSS_MAX_HP,
    victoryRecorded: false,
    earlyVictory: null,
    spellHits: [],
    criticalHits: [],
    exchangeLog: [],
    history: [],
  };
}

export function calculateWeekBossDamage({
  week,
  now,
  config,
  days,
  spellHits = [],
  criticalHits = [],
  settleAll = false,
}) {
  const limit = limitForWeek(config.startLimit, week);
  const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
  const today = keyOf(now);
  const daily = [];
  const pips = [];
  let hits = 0;
  let fails = 0;
  let controlledWeekUsed = 0;
  let controlledMode = false;
  let smokeFreeMode = false;
  let controlledWeeklyLimit = controlledWeeklyLimitOf(config);
  for (
    let date = new Date(firstDay);
    date <= lastDay;
    date.setDate(date.getDate() + 1)
  ) {
    const dateConfig = journeyConfigForDate(config, date);
    if (isSmokeFreeMode(dateConfig)) smokeFreeMode = true;
    if (isControlledMode(dateConfig)) {
      controlledMode = true;
      controlledWeeklyLimit = controlledWeeklyLimitOf(dateConfig);
      if (isControlledSmokingDay(dateConfig, date)) {
        controlledWeekUsed += Math.max(0, recordOf(days, keyOf(date)).c || 0);
      }
    }
  }
  const controlledBudgetExceeded =
    controlledMode && controlledWeekUsed > controlledWeeklyLimit;

  for (
    let date = new Date(firstDay);
    date <= lastDay;
    date.setDate(date.getDate() + 1)
  ) {
    const dayKey = keyOf(date);
    const dateConfig = journeyConfigForDate(config, date);
    const daySmokeFreeMode = isSmokeFreeMode(dateConfig);
    const dayControlledMode = isControlledMode(dateConfig);
    const controlledAllowedDay =
      dayControlledMode && isControlledSmokingDay(dateConfig, date);
    const explicitSmokeFreeResult =
      (daySmokeFreeMode || (dayControlledMode && !controlledAllowedDay)) &&
      (smokeFreeStatusOf(recordOf(days, dayKey)) ===
        SMOKE_FREE_STATUS_SUCCESS ||
        smokeFreeStatusOf(recordOf(days, dayKey)) ===
          SMOKE_FREE_STATUS_SMOKED);
    const past = settleAll || daysBetween(now, date) < 0;
    const settled = past || explicitSmokeFreeResult;
    const isToday = dayKey === today && !settleAll;
    const future = !settleAll && dayKey > today;
    const record = recordOf(days, dayKey);
    const baseDamage = calculateDailyBossDamage({
      record,
      limit,
      settled,
      journeyMode: dateConfig.journeyMode,
      takesPills: config.takesPills,
      pillsGoal: config.pillsGoal || 3,
      controlledAllowedDay,
      controlledBudgetExceeded,
    });
    const critical = settled && baseDamage.completed && criticalHits.some((hit) => (
      hit?.week === week && hit?.key === dayKey && hit?.critical === true
    )) ? BOSS_CRITICAL_DAMAGE : 0;
    const damage = { ...baseDamage, critical, total: baseDamage.total + critical };

    let status = 'pend';
    if (settled) status = damage.completed ? 'hit' : 'fail';
    else if (isToday) {
      status = dayControlledMode && controlledBudgetExceeded
        ? 'fail'
        : (record.c || 0) > limit
          ? 'fail'
          : 'today';
    }
    if (status === 'hit') hits += 1;
    else if (status === 'fail') fails += 1;

    const actual = future
      ? {
          ...damage,
          pills: 0,
          perfect: 0,
          critical: 0,
          total: 0,
        }
      : damage;
    daily.push({
      key: dayKey,
      settled,
      status,
      journeyMode: dateConfig.journeyMode,
      controlledAllowedDay,
      ...actual,
    });
    pips.push(status);
  }

  const spellDamage = spellHits
    .filter((hit) => hit && hit.week === week)
    .reduce((total, hit) => total + Math.max(0, hit.damage || 0), 0);
  const dayDamage = daily.reduce((total, day) => total + day.total, 0);

  return {
    week,
    limit,
    daily,
    pips,
    hits,
    fails,
    dayDamage,
    spellDamage,
    total: dayDamage + spellDamage,
    controlledMode,
    smokeFreeMode,
    controlledWeekUsed,
    controlledWeeklyLimit,
    controlledBudgetExceeded,
  };
}

export function calculateBossCombatStatus({
  combat,
  now,
  config,
  days,
}) {
  const bossCount = bossCountForJourney(config, BOSSES.length);
  const campaignComplete = Boolean(combat.completed);
  const weekDamage = calculateWeekBossDamage({
    week: combat.week,
    now,
    config,
    days,
    spellHits: combat.spellHits,
    criticalHits: combat.criticalHits,
  });
  const rawHp = campaignComplete
    ? 0
    : Math.max(0, combat.hpAtWeekStart - weekDamage.total);
  const hasRequiredDays =
    campaignComplete ||
    (weekDamage.hits >= BOSS_REQUIRED_DAYS &&
      !weekDamage.controlledBudgetExceeded);
  const won = campaignComplete || (rawHp <= 0 && hasRequiredDays);
  const lockedByDays =
    !campaignComplete && rawHp <= 0 && !hasRequiredDays;
  const hp = lockedByDays ? 1 : rawHp;
  const identity = bossIdentity(combat.bossIndex, bossCount);
  const today = weekDamage.daily.find((day) => day.key === keyOf(now));
  const todayConfig = journeyConfigForDate(config, now);
  const controlledTodayAllowed = isControlledSmokingDay(todayConfig, now);
  const projectedToday = today
    ? calculateDailyBossDamage({
        record: isSmokeFreeMode(todayConfig) ||
          (isControlledMode(todayConfig) && !controlledTodayAllowed)
          ? { ...recordOf(days, today.key), sf: SMOKE_FREE_STATUS_SUCCESS }
          : recordOf(days, today.key),
        limit: weekDamage.limit,
        settled: true,
        journeyMode: todayConfig.journeyMode,
        takesPills: config.takesPills,
        pillsGoal: config.pillsGoal || 3,
        controlledAllowedDay: controlledTodayAllowed,
        controlledBudgetExceeded: weekDamage.controlledBudgetExceeded,
      })
    : calculateDailyBossDamage({
        record: isSmokeFreeMode(todayConfig)
          ? { sf: SMOKE_FREE_STATUS_SUCCESS }
          : EMPTY_DAY,
        limit: weekDamage.limit,
        settled: isSmokeFreeMode(todayConfig),
        journeyMode: todayConfig.journeyMode,
        controlledAllowedDay: controlledTodayAllowed,
        controlledBudgetExceeded: weekDamage.controlledBudgetExceeded,
      });
  const hpPercent = Math.max(
    0,
    Math.min(100, (hp / BOSS_MAX_HP) * 100),
  );
  const recentHits = weekDamage.daily
    .filter((day) => day.total > 0)
    .slice(-4)
    .reverse()
    .map((day) => ({
      key: day.key,
      total: day.total,
      completion: day.completion,
      margin: day.margin,
      pills: day.pills,
      perfect: day.perfect,
      critical: day.critical,
      zero: day.zero,
    }));
  const combatLog = [];
  for (const day of weekDamage.daily) {
    const baseDamage = Math.max(
      0,
      Number(day.completion || 0) +
        Number(day.margin || 0) +
        Number(day.zero || 0),
    );
    if (baseDamage > 0) {
      combatLog.push({
        id: `day:${combat.week}:${day.key}`,
        key: day.key,
        sortKey: `${day.key}T23:55:00.000`,
        direction: 'outgoing',
        kind: 'day',
        damage: baseDamage,
        journeyMode: day.journeyMode,
        completion: day.completion,
        margin: day.margin,
        zero: day.zero,
      });
    }
    for (let index = 0; index < Math.max(0, Number(day.perfect) || 0); index += 1) {
      combatLog.push({
        id: `perfect:${combat.week}:${day.key}:${index}`,
        key: day.key,
        sortKey: `${day.key}T23:56:${String(index).padStart(2, '0')}.000`,
        direction: 'outgoing',
        kind: 'perfect',
        damage: 1,
      });
    }
    if (day.critical > 0) {
      combatLog.push({
        id: `critical:${combat.week}:${day.key}`,
        key: day.key,
        sortKey: `${day.key}T23:57:00.000`,
        direction: 'outgoing',
        kind: 'critical',
        damage: day.critical,
      });
    }
  }
  for (const hit of combat.spellHits || []) {
    if (!hit || hit.week !== combat.week) continue;
    combatLog.push({
      id: hit.id || `spell:${combat.week}:${hit.key || ''}:${hit.damage || 0}`,
      key: hit.key || '',
      sortKey: hit.at || `${hit.key || '0000-00-00'}T23:58:00.000`,
      direction: 'outgoing',
      kind: 'spell',
      label: hit.label || hit.name || 'Habilidad del héroe',
      damage: Math.max(0, Number(hit.damage) || 0),
    });
  }
  for (const hit of combat.exchangeLog || []) {
    if (
      !hit ||
      hit.week !== combat.week ||
      hit.bossIndex !== combat.bossIndex
    ) continue;
    combatLog.push({
      ...hit,
      direction: 'incoming',
      damage: Math.max(0, Number(hit.damage) || 0),
      sortKey: hit.at || `${hit.key || '0000-00-00'}T12:00:00.000`,
    });
  }
  combatLog.sort((left, right) => String(left.sortKey).localeCompare(String(right.sortKey)));
  const heroDamageLogged = combatLog
    .filter((entry) => entry.direction === 'outgoing')
    .reduce((total, entry) => total + entry.damage, 0);
  const bossDamageLogged = combatLog
    .filter((entry) => entry.direction === 'incoming')
    .reduce((total, entry) => total + entry.damage, 0);

  return {
    ...identity,
    maxHp: BOSS_MAX_HP,
    hp,
    hpPercent,
    damage: BOSS_MAX_HP - hp,
    damageThisWeek: weekDamage.total,
    damageToday: today?.total || 0,
    todayStatus: today?.status || 'pend',
    projectedToday: projectedToday.total,
    breakdownToday: today || {
      completion: 0,
      margin: 0,
      pills: 0,
      perfect: 0,
      critical: 0,
      zero: 0,
      total: 0,
    },
    lim: weekDamage.limit,
    pips: weekDamage.pips,
    hits: weekDamage.hits,
    fails: weekDamage.fails,
    won,
    lockedByDays,
    rawHp,
    earlyVictoryActive: Boolean(
      combat.earlyVictory &&
      combat.earlyVictory.week === combat.week &&
      combat.earlyVictory.bossIndex === combat.bossIndex
    ),
    earlyVictoryNoticePending: Boolean(
      combat.earlyVictory?.noticePending &&
      combat.earlyVictory.week === combat.week &&
      combat.earlyVictory.bossIndex === combat.bossIndex
    ),
    completedDays: campaignComplete
      ? BOSS_REQUIRED_DAYS
      : weekDamage.hits,
    requiredDays: BOSS_REQUIRED_DAYS,
    lost: false,
    w: combat.week,
    bossesDown: Math.min(
      bossCount,
      combat.legacyBossesDown + combat.defeated,
    ),
    campaignComplete,
    history: combat.history || [],
    recentHits,
    combatLog,
    heroDamageLogged,
    bossDamageLogged,
    controlledWeekUsed: weekDamage.controlledWeekUsed,
    controlledWeeklyLimit: weekDamage.controlledWeeklyLimit,
    controlledBudgetExceeded: weekDamage.controlledBudgetExceeded,
  };
}

export function reconcileBossCombat({
  combat,
  now,
  config,
  days,
  legacyBossesDown = 0,
  criticalChance = 0,
  roll = Math.random,
}) {
  const currentWeek = Math.max(
    0,
    weekIndexFor(config.startDate, now),
  );
  const bossCount = bossCountForJourney(config, BOSSES.length);
  const finalBossIndex = bossCount - 1;
  const next = combat
      ? {
        ...combat,
        spellHits: [...(combat.spellHits || [])],
        criticalHits: [...(combat.criticalHits || [])],
        exchangeLog: [...(combat.exchangeLog || [])],
        history: [...(combat.history || [])],
      }
    : createBossCombat({
        currentWeek,
        legacyBossesDown,
        maxBosses: bossCount,
      });
  next.legacyBossesDown = Math.min(
    bossCount,
    Math.max(0, next.legacyBossesDown || 0),
  );
  next.defeated = Math.min(
    Math.max(0, bossCount - next.legacyBossesDown),
    Math.max(0, next.defeated || 0),
  );
  next.bossIndex = Math.min(
    finalBossIndex,
    Math.max(0, next.bossIndex || 0),
  );
  if (next.legacyBossesDown + next.defeated >= bossCount) {
    next.completed = true;
    next.bossIndex = finalBossIndex;
  }
  if ((next.version || 1) < 2) {
    next.hpAtWeekStart = Math.round(
      (Math.max(0, next.hpAtWeekStart || 100) / 100) * BOSS_MAX_HP,
    );
    next.version = 2;
  }
  if ((next.version || 2) < 3) {
    next.earlyVictory = null;
    next.version = 3;
  }
  if ((next.version || 3) < 4) {
    next.criticalHits = [];
    next.version = 4;
  }
  if ((next.version || 4) < 5) {
    next.exchangeLog = [];
    next.version = 5;
  }
  const weekResults = [];

  const registerCriticalHits = (week, settleAll = false) => {
    const baseline = calculateWeekBossDamage({
      week,
      now,
      config,
      days,
      spellHits: next.spellHits,
      criticalHits: [],
      settleAll,
    });
    for (const day of baseline.daily) {
      if (!day.settled || day.status !== 'hit') continue;
      if (next.criticalHits.some((hit) => hit?.week === week && hit?.key === day.key)) continue;
      next.criticalHits.push({
        week,
        key: day.key,
        critical: roll() < Math.max(0, Math.min(0.25, Number(criticalChance) || 0)),
      });
    }
  };

  while (next.week < currentWeek && !next.completed) {
    registerCriticalHits(next.week, true);
    const damage = calculateWeekBossDamage({
      week: next.week,
      now,
      config,
      days,
      spellHits: next.spellHits,
      criticalHits: next.criticalHits,
      settleAll: true,
    });
    const rawRemainingHp = Math.max(
      0,
      next.hpAtWeekStart - damage.total,
    );
    const won =
      rawRemainingHp <= 0 &&
      damage.hits >= BOSS_REQUIRED_DAYS &&
      !damage.controlledBudgetExceeded;
    const remainingHp =
      rawRemainingHp <= 0 && !won ? 1 : rawRemainingHp;
    const earlyVictory =
      won &&
      next.earlyVictory?.week === next.week &&
      next.earlyVictory?.bossIndex === next.bossIndex
        ? { ...next.earlyVictory }
        : null;

    if (won && !next.victoryRecorded) {
      next.defeated = Math.min(
        bossCount - next.legacyBossesDown,
        next.defeated + 1,
      );
    }
    weekResults.push({
      won,
      weekIdx: next.week,
      bossIndex: next.bossIndex,
      pips: [...damage.pips],
      damage: Math.min(next.hpAtWeekStart, damage.total),
      remainingHp,
      earlyVictory,
    });
    next.history.push({
      week: next.week,
      bossIndex: next.bossIndex,
      won,
      damage: Math.min(next.hpAtWeekStart, damage.total),
      remainingHp,
    });

    if (won) {
      if (next.bossIndex >= finalBossIndex) {
        next.completed = true;
        next.hpAtWeekStart = 0;
      } else {
        next.bossIndex += 1;
        next.hpAtWeekStart = BOSS_MAX_HP;
      }
    } else {
      next.hpAtWeekStart = BOSS_MAX_HP;
    }
    next.week += 1;
    next.victoryRecorded = next.completed;
    next.earlyVictory = null;
  }

  next.history = next.history.slice(-12);
  next.spellHits = next.spellHits.filter(
    (hit) => hit && hit.week >= next.week,
  );
  next.criticalHits = next.criticalHits.filter(
    (hit) => hit && hit.week >= next.week,
  );
  next.exchangeLog = next.exchangeLog.filter(
    (hit) => hit && hit.week >= next.week,
  );

  registerCriticalHits(next.week);

  let status = calculateBossCombatStatus({
    combat: next,
    now,
    config,
    days,
  });
  let newlyDefeated = false;
  let defeatRevoked = false;
  let newlyEarlyVictory = false;

  if (
    status.lockedByDays &&
    !(
      next.earlyVictory?.week === next.week &&
      next.earlyVictory?.bossIndex === next.bossIndex
    )
  ) {
    next.earlyVictory = {
      id: earlyVictoryId(next.week, next.bossIndex),
      week: next.week,
      bossIndex: next.bossIndex,
      noticePending: true,
    };
    newlyEarlyVictory = true;
    status = calculateBossCombatStatus({
      combat: next,
      now,
      config,
      days,
    });
  }

  if (status.won && !next.victoryRecorded) {
    next.defeated = Math.min(
      bossCount - next.legacyBossesDown,
      next.defeated + 1,
    );
    next.victoryRecorded = true;
    newlyDefeated = true;
  } else if (!status.won && next.victoryRecorded) {
    next.defeated = Math.max(0, next.defeated - 1);
    next.victoryRecorded = false;
    defeatRevoked = true;
  }

  status = calculateBossCombatStatus({
    combat: next,
    now,
    config,
    days,
  });

  return {
    combat: next,
    status,
    weekResults,
    newlyDefeated,
    defeatRevoked,
    newlyEarlyVictory,
    earlyVictory: resultEarlyVictory(next, status, newlyDefeated),
  };
}

function resultEarlyVictory(combat, status, newlyDefeated) {
  if (!newlyDefeated || !combat.earlyVictory) return null;
  if (
    combat.earlyVictory.week !== status.w ||
    combat.earlyVictory.bossIndex !== status.bossIndex
  ) return null;
  return { ...combat.earlyVictory };
}
