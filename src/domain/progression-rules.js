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
  controlledWeeklyLimitOf,
  isControlledMode,
  isControlledSmokingDay,
  isSmokeFreeMode,
  journeyConfigForDate,
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
  relicXp = 0,
}) {
  const start = parseKey(config.startDate);
  const goal = config.pillsGoal || 3;
  const classId = game?.cls;
  const marginXp = 4;
  const recordXp = 25;
  const pardons = game?.pardons || [];
  const judgmentDays = game?.judgmentDays || [];
  const pestXpDays = game?.pestXpDays || [];
  let xp = (game?.bonusXp || 0) + habitXpTotal(habits) +
    Math.max(0, Number(relicXp) || 0);
  let streak = 0;
  let minimumCigarettes = null;
  const controlledWeekWithinLimit=(date,dateConfig)=>{
    const week=Math.max(0,weekIndexFor(config.startDate,date));
    const [first,last]=weekRangeFor(config.startDate,week);
    let used=0;
    for(let cursor=new Date(first);cursor<=last;cursor.setDate(cursor.getDate()+1)){
      if(isControlledSmokingDay(dateConfig,cursor)){
        used+=Math.max(0,dayRecord(days,keyOf(cursor)).c||0);
      }
    }
    return used<=controlledWeeklyLimitOf(dateConfig);
  };
  const controlledDaySuccess=(date,record,dateConfig)=>
    isControlledSmokingDay(dateConfig,date)
      ? controlledWeekWithinLimit(date,dateConfig)
      : smokeFreeStatusOf(record)===SMOKE_FREE_STATUS_SUCCESS;
  const smokeFreeDayXp=(record,key)=>{
    let value=50;
    if(record.p>=goal&&config.takesPills!==false) value+=10;
    return value;
  };

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
    const dateConfig=journeyConfigForDate(config,date);
    const smokeFreeMode=isSmokeFreeMode(dateConfig);
    const controlledMode=isControlledMode(dateConfig);
    const disciplineMode=smokeFreeMode||controlledMode;

    if (disciplineMode) {
      const completed=smokeFreeMode
        ? smokeFreeStatusOf(record)===SMOKE_FREE_STATUS_SUCCESS
        : controlledDaySuccess(date,record,dateConfig);
      if (completed) {
        xp += smokeFreeDayXp(record,key);
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
  const todayConfig=journeyConfigForDate(config,now);
  const smokeFreeMode=isSmokeFreeMode(todayConfig);
  const controlledMode=isControlledMode(todayConfig);
  const disciplineMode=smokeFreeMode||controlledMode;
  if (disciplineMode) {
    const todayCompleted=smokeFreeMode
      ? smokeFreeStatusOf(today)===SMOKE_FREE_STATUS_SUCCESS
      : !isControlledSmokingDay(todayConfig,now)&&
        smokeFreeStatusOf(today)===SMOKE_FREE_STATUS_SUCCESS;
    if (todayCompleted) {
      xp += smokeFreeDayXp(today,keyOf(now));
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
      let weekDiscipline=false;
      let hits = 0;
      for (
        let date = new Date(firstDay);
        date <= lastDay;
        date.setDate(date.getDate() + 1)
      ) {
        const record = dayRecord(days, keyOf(date));
        const dateConfig=journeyConfigForDate(config,date);
        const weekSmokeFree=isSmokeFreeMode(dateConfig);
        const weekControlled=isControlledMode(dateConfig);
        if(weekSmokeFree||weekControlled) weekDiscipline=true;
        if (
          weekSmokeFree||weekControlled
            ? weekSmokeFree
              ? smokeFreeStatusOf(record) === SMOKE_FREE_STATUS_SUCCESS
              : controlledDaySuccess(date,record,dateConfig)
            : record.c <= limit
        ) {
          hits += 1;
        }
      }
      if (hits >= (weekDiscipline ? 6 : 4)) {
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
  relicXp = 0,
  relicBonuses = {},
}) {
  const firstPass = calculateXpPass({
    now,
    config,
    days,
    game,
    habits,
    levelHint: 1,
    passiveMultiplier,
    relicXp,
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
    relicXp,
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
  const baseMaxes = classMaxes(game?.cls, level);
  const maxHp = baseMaxes.maxHp + Math.max(0, Number(relicBonuses.maxHp) || 0);
  const maxMp = baseMaxes.maxMp + Math.max(0, Number(relicBonuses.maxMana) || 0);
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
