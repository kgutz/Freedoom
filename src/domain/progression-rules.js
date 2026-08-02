import { BOSSES, BOSS_SLUGS } from '../data/game-data.js';
import { daysBetween, keyOf, parseKey } from './date-utils.js';
import { classMaxes, levelFromXp } from './progression.js';
import { habitXpTotal } from './habit-rules.js';
import {
  limitForDate,
  limitForWeek,
  weekIndexFor,
  weekRangeFor,
} from './plan-rules.js';
import {
  SMOKE_FREE_STATUS_SUCCESS,
  isSmokeFreeMode,
  journeyEvolutionUnlocked,
  smokeFreeStatusOf,
} from './journey-mode-rules.js';

const EMPTY_DAY = { c: 0, p: 0 };

function dayRecord(days, key) {
  return days[key] || EMPTY_DAY;
}

function calculateXpPass({
  now,
  config,
  days,
  game,
  habits,
  levelHint,
  passiveMultiplier,
}) {
  const start = parseKey(config.startDate);
  const goal = config.pillsGoal || 3;
  const classId = game?.cls;
  const marginXp =
    classId === 'paladin' && levelHint >= 12
      ? 4 + Math.round(passiveMultiplier)
      : 4;
  const recordXp =
    classId === 'sorcerer' && levelHint >= 5
      ? 25 + Math.round(15 * passiveMultiplier)
      : 25;
  const pardons = game?.pardons || [];
  const judgmentDays = game?.judgmentDays || [];
  let xp = (game?.bonusXp || 0) + habitXpTotal(habits);
  let streak = 0;
  let minimumCigarettes = null;
  const smokeFreeMode = isSmokeFreeMode(config);

  for (
    let date = new Date(start);
    daysBetween(now, date) < 0;
    date.setDate(date.getDate() + 1)
  ) {
    const key = keyOf(date);
    const record = dayRecord(days, key);
    const limit = limitForDate({
      startDate: config.startDate,
      startLimit: config.startLimit,
      date,
    });
    const cigarettes = record.c;

    if (smokeFreeMode) {
      if (smokeFreeStatusOf(record) === SMOKE_FREE_STATUS_SUCCESS) {
        let dayXp = 50;
        if (record.p >= goal && config.takesPills !== false) dayXp += 10;
        if (judgmentDays.includes(key)) dayXp *= 2;
        xp += dayXp;
        streak += 1;
        if (streak === 7) xp += 75;
        else if (streak === 14) xp += 150;
        else if (streak === 30) xp += 300;
      } else if (pardons.includes(key)) {
        streak += 1;
      } else {
        streak = 0;
      }
      continue;
    }

    xp += record.sx !== undefined ? record.sx : 2 * (record.s || 0);
    if (cigarettes <= limit) {
      let dayXp = 50 + marginXp * Math.max(0, limit - cigarettes);
      if (record.p >= goal && config.takesPills !== false) dayXp += 10;
      if (cigarettes <= Math.floor(limit / 2)) dayXp += 10;
      if (judgmentDays.includes(key)) dayXp *= 2;
      xp += dayXp;
      streak += 1;
      if (streak === 7) xp += 75;
      else if (streak === 14) xp += 150;
      else if (streak === 30) xp += 300;
    } else if (pardons.includes(key)) {
      streak += 1;
    } else {
      streak = 0;
    }

    if (minimumCigarettes === null) minimumCigarettes = cigarettes;
    else if (cigarettes < minimumCigarettes) {
      minimumCigarettes = cigarettes;
      xp += recordXp;
    }
  }

  const today = dayRecord(days, keyOf(now));
  if (smokeFreeMode) {
    if (smokeFreeStatusOf(today) === SMOKE_FREE_STATUS_SUCCESS) {
      let todayXp = 50;
      if (today.p >= goal && config.takesPills !== false) todayXp += 10;
      if (judgmentDays.includes(keyOf(now))) todayXp *= 2;
      xp += todayXp;
      streak += 1;
    }
  } else {
    xp += today.sx !== undefined ? today.sx : 2 * (today.s || 0);
  }

  const currentWeek = Math.max(0, weekIndexFor(config.startDate, now));
  let bossesDown = 0;
  if (game?.bossCombat) {
    bossesDown =
      Math.max(0, game.bossCombat.legacyBossesDown || 0) +
      Math.max(0, game.bossCombat.defeated || 0);
    xp += bossesDown * 200;
  } else {
    for (let week = 0; week < currentWeek; week += 1) {
      const limit = limitForWeek(config.startLimit, week);
      const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
      let hits = 0;
      for (
        let date = new Date(firstDay);
        date <= lastDay;
        date.setDate(date.getDate() + 1)
      ) {
        const record = dayRecord(days, keyOf(date));
        if (
          smokeFreeMode
            ? smokeFreeStatusOf(record) === SMOKE_FREE_STATUS_SUCCESS
            : record.c <= limit
        ) {
          hits += 1;
        }
      }
      if (hits >= (smokeFreeMode ? 6 : 4)) {
        xp += 200;
        bossesDown += 1;
      }
    }
  }

  return { xp, streak, bossesDown, currentWeek };
}

export function calculateGameStats({
  now,
  config,
  days,
  game,
  habits,
  passiveMultiplier = 1,
}) {
  const firstPass = calculateXpPass({
    now,
    config,
    days,
    game,
    habits,
    levelHint: 1,
    passiveMultiplier,
  });
  const firstLevel = levelFromXp(firstPass.xp);
  const result = calculateXpPass({
    now,
    config,
    days,
    game,
    habits,
    levelHint: firstLevel,
    passiveMultiplier,
  });
  const level = levelFromXp(result.xp);
  const currentThreshold = 35 * (level - 1) * (level - 1);
  const nextThreshold = 35 * level * level;
  const progress = Math.min(
    1,
    (result.xp - currentThreshold) /
      Math.max(1, nextThreshold - currentThreshold),
  );
  const tier = level >= 15 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  const { maxHp, maxMp } = classMaxes(game?.cls, level);
  const evolutionUnlocked = journeyEvolutionUnlocked({
    config,
    bossesDown: result.bossesDown,
  });

  return {
    xp: result.xp,
    lvl: level,
    prog: progress,
    nextTh: nextThreshold,
    streak: result.streak,
    bossesDown: result.bossesDown,
    currW: result.currentWeek,
    tier,
    evolutionUnlocked,
    maxHp,
    maxMp,
  };
}

export function calculateBossState({ now, config, days, bossesDown }) {
  const week = Math.max(0, weekIndexFor(config.startDate, now));
  const limit = limitForWeek(config.startLimit, week);
  const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
  const pips = [];
  let hits = 0;
  let fails = 0;

  for (
    let date = new Date(firstDay);
    date <= lastDay;
    date.setDate(date.getDate() + 1)
  ) {
    const isPast = daysBetween(now, date) < 0;
    const isToday = keyOf(date) === keyOf(now);
    const cigarettes = dayRecord(days, keyOf(date)).c;
    let status = 'pend';
    if (isPast) status = cigarettes <= limit ? 'hit' : 'fail';
    else if (isToday) status = cigarettes > limit ? 'fail' : 'today';
    if (status === 'hit' || status === 'today') hits += 1;
    else if (status === 'fail') fails += 1;
    pips.push(status);
  }

  const bossIndex = Math.min(bossesDown, BOSSES.length - 1);
  return {
    name: BOSSES[bossIndex],
    slug: BOSS_SLUGS[bossIndex],
    bossNum: bossIndex + 1,
    lim: limit,
    pips,
    hits,
    fails,
    won: hits >= 4,
    lost: fails >= 4,
    w: week,
  };
}
