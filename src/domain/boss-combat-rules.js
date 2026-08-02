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
  isSmokeFreeMode,
  smokeFreeStatusOf,
} from './journey-mode-rules.js';

export const BOSS_MAX_HP = 150;
export const BOSS_REQUIRED_DAYS = 6;
export const BOSS_DAY_DAMAGE = 25;
export const BOSS_MARGIN_DAMAGE = 2;
export const BOSS_MARGIN_DAMAGE_CAP = 10;
export const BOSS_PERFECT_DAMAGE = 1;
export const BOSS_PERFECT_DAMAGE_CAP = 3;
export const BOSS_ZERO_DAY_DAMAGE = 15;

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
    version: 2,
    startedWeek: currentWeek,
    legacyBossesDown: safeLegacy,
    defeated: 0,
    bossIndex: Math.min(safeLegacy, maxBosses - 1),
    week: currentWeek,
    hpAtWeekStart: BOSS_MAX_HP,
    victoryRecorded: false,
    spellHits: [],
    history: [],
  };
}

export function calculateWeekBossDamage({
  week,
  now,
  config,
  days,
  spellHits = [],
  settleAll = false,
}) {
  const smokeFreeMode = isSmokeFreeMode(config);
  const limit = limitForWeek(config.startLimit, week);
  const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
  const today = keyOf(now);
  const daily = [];
  const pips = [];
  let hits = 0;
  let fails = 0;

  for (
    let date = new Date(firstDay);
    date <= lastDay;
    date.setDate(date.getDate() + 1)
  ) {
    const dayKey = keyOf(date);
    const explicitSmokeFreeResult =
      smokeFreeMode &&
      (smokeFreeStatusOf(recordOf(days, dayKey)) ===
        SMOKE_FREE_STATUS_SUCCESS ||
        smokeFreeStatusOf(recordOf(days, dayKey)) ===
          SMOKE_FREE_STATUS_SMOKED);
    const past = settleAll || daysBetween(now, date) < 0;
    const settled = past || explicitSmokeFreeResult;
    const isToday = dayKey === today && !settleAll;
    const future = !settleAll && dayKey > today;
    const record = recordOf(days, dayKey);
    const damage = calculateDailyBossDamage({
      record,
      limit,
      settled,
      journeyMode: config.journeyMode,
      takesPills: config.takesPills,
      pillsGoal: config.pillsGoal || 3,
    });

    let status = 'pend';
    if (settled) status = damage.completed ? 'hit' : 'fail';
    else if (isToday) {
      status = (record.c || 0) > limit ? 'fail' : 'today';
    }
    if (status === 'hit') hits += 1;
    else if (status === 'fail') fails += 1;

    const actual = future
      ? {
          ...damage,
          pills: 0,
          perfect: 0,
          total: 0,
        }
      : damage;
    daily.push({ key: dayKey, settled, status, ...actual });
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
  });
  const rawHp = campaignComplete
    ? 0
    : Math.max(0, combat.hpAtWeekStart - weekDamage.total);
  const hasRequiredDays =
    campaignComplete || weekDamage.hits >= BOSS_REQUIRED_DAYS;
  const won = campaignComplete || (rawHp <= 0 && hasRequiredDays);
  const lockedByDays =
    !campaignComplete && rawHp <= 0 && !hasRequiredDays;
  const hp = lockedByDays ? 1 : rawHp;
  const identity = bossIdentity(combat.bossIndex, bossCount);
  const today = weekDamage.daily.find((day) => day.key === keyOf(now));
  const projectedToday = today
    ? calculateDailyBossDamage({
        record: isSmokeFreeMode(config)
          ? { ...recordOf(days, today.key), sf: SMOKE_FREE_STATUS_SUCCESS }
          : recordOf(days, today.key),
        limit: weekDamage.limit,
        settled: true,
        journeyMode: config.journeyMode,
        takesPills: config.takesPills,
        pillsGoal: config.pillsGoal || 3,
      })
    : calculateDailyBossDamage({
        record: isSmokeFreeMode(config)
          ? { sf: SMOKE_FREE_STATUS_SUCCESS }
          : EMPTY_DAY,
        limit: weekDamage.limit,
        settled: isSmokeFreeMode(config),
        journeyMode: config.journeyMode,
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
      zero: day.zero,
    }));

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
      zero: 0,
      total: 0,
    },
    lim: weekDamage.limit,
    pips: weekDamage.pips,
    hits: weekDamage.hits,
    fails: weekDamage.fails,
    won,
    lockedByDays,
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
  };
}

export function reconcileBossCombat({
  combat,
  now,
  config,
  days,
  legacyBossesDown = 0,
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
  const weekResults = [];

  while (next.week < currentWeek && !next.completed) {
    const damage = calculateWeekBossDamage({
      week: next.week,
      now,
      config,
      days,
      spellHits: next.spellHits,
      settleAll: true,
    });
    const rawRemainingHp = Math.max(
      0,
      next.hpAtWeekStart - damage.total,
    );
    const won =
      rawRemainingHp <= 0 && damage.hits >= BOSS_REQUIRED_DAYS;
    const remainingHp =
      rawRemainingHp <= 0 && !won ? 1 : rawRemainingHp;

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
      damage: Math.min(next.hpAtWeekStart, damage.total),
      remainingHp,
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
  }

  next.history = next.history.slice(-12);
  next.spellHits = next.spellHits.filter(
    (hit) => hit && hit.week >= next.week,
  );

  let status = calculateBossCombatStatus({
    combat: next,
    now,
    config,
    days,
  });
  let newlyDefeated = false;
  let defeatRevoked = false;

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
  };
}
