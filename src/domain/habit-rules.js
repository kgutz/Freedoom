import { keyOf } from './date-utils.js';
import { weekIndexFor, weekRangeFor } from './plan-rules.js';

export const HABIT_XP_CAP_RULES = Object.freeze({
  daily: Object.freeze({ base: 25, scaling: 0.8, hard: 100 }),
  weekly: Object.freeze({ base: 35, scaling: 0.7, hard: 120 }),
});

// Alias conservados para integraciones antiguas que interpretaban estos valores
// como el tope base. Los límites efectivos se calculan dinámicamente.
export const HABIT_DAILY_XP_CAP = HABIT_XP_CAP_RULES.daily.base;
export const HABIT_WEEKLY_XP_CAP = HABIT_XP_CAP_RULES.weekly.base;

export const HABIT_COIN_REWARDS = Object.freeze({
  daily: Object.freeze({ easy: 1, medium: 2, hard: 3 }),
  weekly: Object.freeze({ easy: 3, medium: 5, hard: 8 }),
  allDailyCompletedBonus: 3,
});

export const HABIT_DIFFICULTIES = {
  easy: { label: 'Fácil', dailyXp: 3, weeklyXp: 9 },
  medium: { label: 'Media', dailyXp: 6, weeklyXp: 18 },
  hard: { label: 'Difícil', dailyXp: 10, weeklyXp: 30 },
};

export function emptyHabitState() {
  return { items: [], entries: {}, dailyCoinBonuses: {} };
}

export function normalizeHabitState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return emptyHabitState();
  }
  return {
    items: Array.isArray(value.items)
      ? value.items.filter((item) => item && typeof item === 'object')
      : [],
    entries:
      value.entries &&
      typeof value.entries === 'object' &&
      !Array.isArray(value.entries)
        ? value.entries
        : {},
    dailyCoinBonuses:
      value.dailyCoinBonuses &&
      typeof value.dailyCoinBonuses === 'object' &&
      !Array.isArray(value.dailyCoinBonuses)
        ? value.dailyCoinBonuses
        : {},
  };
}

export function normalizeHabitInput(input = {}) {
  const difficulty = HABIT_DIFFICULTIES[input.difficulty]
    ? input.difficulty
    : 'easy';
  const frequency = input.frequency === 'weekly' ? 'weekly' : 'daily';
  return {
    title: String(input.title || '').trim().slice(0, 60),
    notes: String(input.notes || '').trim().slice(0, 180),
    difficulty,
    frequency,
    target: Math.min(20, Math.max(1, Math.trunc(Number(input.target) || 1))),
  };
}

function habitOrderValue(habit){
  return Number.isFinite(Number(habit?.order))
    ? Number(habit.order)
    : Number(habit?.createdAt)||0;
}

export function sortHabits(habits=[]){
  return [...habits].sort((left,right)=>{
    const orderDifference=habitOrderValue(left)-habitOrderValue(right);
    if(orderDifference!==0) return orderDifference;
    return (Number(left?.createdAt)||0)-(Number(right?.createdAt)||0);
  });
}

export function nextHabitOrder(habitState,frequency){
  const normalized=normalizeHabitState(habitState);
  const orders=normalized.items
    .filter(habit=>habit.active!==false&&habit.frequency===frequency)
    .map(habit=>habitOrderValue(habit));
  return orders.length?Math.max(...orders)+1:0;
}

export function reorderHabits(habitState,frequency,orderedIds=[]){
  const normalized=normalizeHabitState(habitState);
  const targetIds=normalized.items
    .filter(habit=>habit.active!==false&&habit.frequency===frequency)
    .map(habit=>habit.id);
  const targetSet=new Set(targetIds);
  const seen=new Set();
  const safeOrder=[];
  orderedIds.forEach(id=>{
    if(targetSet.has(id)&&!seen.has(id)){
      safeOrder.push(id);
      seen.add(id);
    }
  });
  sortHabits(normalized.items.filter(habit=>targetSet.has(habit.id)))
    .forEach(habit=>{
      if(!seen.has(habit.id)) safeOrder.push(habit.id);
    });
  const position=new Map(safeOrder.map((id,index)=>[id,index]));
  return {
    ...normalized,
    items:normalized.items.map(habit=>position.has(habit.id)
      ? {...habit,order:position.get(habit.id),updatedAt:Date.now()}
      : habit),
  };
}

export function habitReward(habit) {
  const difficulty = HABIT_DIFFICULTIES[habit?.difficulty]
    ? habit.difficulty
    : 'easy';
  return habit?.frequency === 'weekly'
    ? HABIT_DIFFICULTIES[difficulty].weeklyXp
    : HABIT_DIFFICULTIES[difficulty].dailyXp;
}

function normalizedFrequency(frequency) {
  return frequency === 'weekly' ? 'weekly' : 'daily';
}

export function calculateHabitXpCap(frequency, potentialXp) {
  const rules = HABIT_XP_CAP_RULES[normalizedFrequency(frequency)];
  const potential = Math.max(0, Number(potentialXp) || 0);
  if (potential <= rules.base) return rules.base;
  return Math.min(
    rules.hard,
    Math.round(rules.base + (potential - rules.base) * rules.scaling),
  );
}

export function habitPotentialXp(habitState, frequency) {
  const normalized = normalizeHabitState(habitState);
  const targetFrequency = normalizedFrequency(frequency);
  return normalized.items.reduce((total, habit) => {
    if (habit?.active === false || normalizedFrequency(habit?.frequency) !== targetFrequency) {
      return total;
    }
    return total + habitReward(habit);
  }, 0);
}

export function habitXpCapForState(habitState, frequency) {
  return calculateHabitXpCap(
    frequency,
    habitPotentialXp(habitState, frequency),
  );
}

export function habitCoinReward(habit) {
  const difficulty = HABIT_DIFFICULTIES[habit?.difficulty]
    ? habit.difficulty
    : 'easy';
  const frequency = habit?.frequency === 'weekly' ? 'weekly' : 'daily';
  return HABIT_COIN_REWARDS[frequency][difficulty];
}

export function habitPeriodKey(habit, date, planStartDate) {
  if (habit?.frequency !== 'weekly') return `d:${keyOf(date)}`;
  const week = Math.max(0, weekIndexFor(planStartDate, date));
  const [firstDay] = weekRangeFor(planStartDate, week);
  return `w:${keyOf(firstDay)}`;
}

export function habitEntryKey(habitId, periodKey) {
  return `${habitId}|${periodKey}`;
}

export function habitEntryFor(habitState, habit, date, planStartDate) {
  const normalized = normalizeHabitState(habitState);
  const periodKey = habitPeriodKey(habit, date, planStartDate);
  return (
    normalized.entries[habitEntryKey(habit.id, periodKey)] || {
      habitId: habit.id,
      periodKey,
      frequency: habit.frequency,
      count: 0,
      xpAwarded: 0,
      coinsAwarded: 0,
    }
  );
}

function xpUsedInPeriod(entries, periodKey, frequency, excludedKey) {
  return Object.entries(entries).reduce((total, [entryKey, entry]) => {
    if (
      entryKey === excludedKey ||
      entry?.periodKey !== periodKey ||
      entry?.frequency !== frequency
    ) {
      return total;
    }
    return total + Math.max(0, Number(entry.xpAwarded) || 0);
  }, 0);
}

export function adjustHabitProgress({
  habitState,
  habit,
  delta,
  date,
  planStartDate,
  rewardMultiplier = 1,
  flatRewardBonus = 0,
}) {
  const normalized = normalizeHabitState(habitState);
  const periodKey = habitPeriodKey(habit, date, planStartDate);
  const entryKey = habitEntryKey(habit.id, periodKey);
  const previous = habitEntryFor(normalized, habit, date, planStartDate);
  const wasCompleted = previous.count >= habit.target;
  const count = Math.min(
    habit.target,
    Math.max(0, previous.count + Math.trunc(Number(delta) || 0)),
  );
  const completed = count >= habit.target;
  const cap = habitXpCapForState(normalized, habit.frequency);
  const used = xpUsedInPeriod(
    normalized.entries,
    periodKey,
    habit.frequency,
    entryKey,
  );
  const xpAwarded = completed
    ? Math.min(
        Math.round(habitReward(habit)*Math.max(1,Number(rewardMultiplier)||1)) +
          Math.max(0, Math.round(Number(flatRewardBonus) || 0)),
        Math.max(0, cap - used),
      )
    : 0;
  const entry = {
    habitId: habit.id,
    periodKey,
    frequency: habit.frequency,
    count,
    xpAwarded,
  };
  return {
    habitState: {
      ...normalized,
      entries: { ...normalized.entries, [entryKey]: entry },
    },
    entry,
    xpDelta: xpAwarded - (Number(previous.xpAwarded) || 0),
    completed,
    wasCompleted,
    becameCompleted: !wasCompleted && completed,
    becameIncomplete: wasCompleted && !completed,
  };
}

function normalizedEconomy(value) {
  const economy = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  return {
    ...economy,
    coins: Math.max(0, Math.trunc(Number(economy.coins) || 0)),
    bossBlood: Math.max(0, Math.trunc(Number(economy.bossBlood) || 0)),
    transactions: Array.isArray(economy.transactions)
      ? economy.transactions.filter((entry) => entry && typeof entry === 'object')
      : [],
  };
}

function transactionAward(economy, transactionId) {
  const transaction = economy.transactions.find((entry) => entry.id === transactionId);
  return Math.max(0, Math.trunc(Number(transaction?.coins) || 0));
}

function setCoinEntitlement({ economy, transactionId, currentAward, targetAward, transaction }) {
  const safeCurrent = Math.max(0, Math.trunc(Number(currentAward) || 0));
  const safeTarget = Math.max(0, Math.trunc(Number(targetAward) || 0));
  const requestedDelta = safeTarget - safeCurrent;
  const coinDelta = requestedDelta < 0
    ? -Math.min(economy.coins, Math.abs(requestedDelta))
    : requestedDelta;
  const awarded = safeCurrent + coinDelta;
  const nextEconomy = {
    ...economy,
    coins: Math.max(0, economy.coins + coinDelta),
  };
  const existing = economy.transactions.find((entry) => entry.id === transactionId);
  if (coinDelta !== 0 || existing) {
    nextEconomy.transactions = [
      ...economy.transactions.filter((entry) => entry.id !== transactionId),
      {
        ...existing,
        ...transaction,
        id: transactionId,
        coins: awarded,
      },
    ].slice(-200);
  }
  return { economy: nextEconomy, awarded, coinDelta };
}

function allDailyHabitsCompleted(habitState, date, planStartDate) {
  const activeDaily = habitState.items.filter((item) =>
    item?.active !== false && item?.frequency !== 'weekly');
  if (!activeDaily.length) return false;
  return activeDaily.every((item) => {
    const entry = habitEntryFor(habitState, item, date, planStartDate);
    return entry.count >= item.target;
  });
}

export function applyHabitCoinRewards({
  habitState,
  economy,
  habit,
  date,
  planStartDate,
  becameCompleted = false,
  becameIncomplete = false,
  nowTimestamp = Date.now(),
}) {
  let normalized = normalizeHabitState(habitState);
  let nextEconomy = normalizedEconomy(economy);
  const periodKey = habitPeriodKey(habit, date, planStartDate);
  const entryKey = habitEntryKey(habit.id, periodKey);
  const entry = habitEntryFor(normalized, habit, date, planStartDate);
  const habitTransactionId = `habit-coin:${entryKey}`;
  const recordedHabitAward = Math.max(
    Math.max(0, Math.trunc(Number(entry.coinsAwarded) || 0)),
    transactionAward(nextEconomy, habitTransactionId),
  );
  const targetHabitAward = becameCompleted
    ? habitCoinReward(habit)
    : becameIncomplete
      ? 0
      : recordedHabitAward;
  const habitResult = setCoinEntitlement({
    economy: nextEconomy,
    transactionId: habitTransactionId,
    currentAward: recordedHabitAward,
    targetAward: targetHabitAward,
    transaction: {
      type: 'habit_coin_reward',
      habitId: habit.id,
      periodKey,
      frequency: habit?.frequency === 'weekly' ? 'weekly' : 'daily',
      at: nowTimestamp,
    },
  });
  nextEconomy = habitResult.economy;
  normalized = {
    ...normalized,
    entries: {
      ...normalized.entries,
      [entryKey]: { ...entry, coinsAwarded: habitResult.awarded },
    },
  };

  let bonusCoinDelta = 0;
  const dailyPeriodKey = `d:${keyOf(date)}`;
  if (habit?.frequency !== 'weekly' && (becameCompleted || becameIncomplete || normalized.dailyCoinBonuses[dailyPeriodKey])) {
    const previousBonus = normalized.dailyCoinBonuses[dailyPeriodKey] || {};
    const bonusTransactionId = `habit-coin-bonus:${dailyPeriodKey}`;
    const recordedBonusAward = Math.max(
      Math.max(0, Math.trunc(Number(previousBonus.coinsAwarded) || 0)),
      transactionAward(nextEconomy, bonusTransactionId),
    );
    const targetBonusAward = allDailyHabitsCompleted(normalized, date, planStartDate)
      ? HABIT_COIN_REWARDS.allDailyCompletedBonus
      : 0;
    const bonusResult = setCoinEntitlement({
      economy: nextEconomy,
      transactionId: bonusTransactionId,
      currentAward: recordedBonusAward,
      targetAward: targetBonusAward,
      transaction: {
        type: 'habit_all_daily_bonus',
        periodKey: dailyPeriodKey,
        at: nowTimestamp,
      },
    });
    nextEconomy = bonusResult.economy;
    bonusCoinDelta = bonusResult.coinDelta;
    normalized = {
      ...normalized,
      dailyCoinBonuses: {
        ...normalized.dailyCoinBonuses,
        [dailyPeriodKey]: {
          periodKey: dailyPeriodKey,
          coinsAwarded: bonusResult.awarded,
        },
      },
    };
  }

  return {
    habitState: normalized,
    economy: nextEconomy,
    habitCoinDelta: habitResult.coinDelta,
    bonusCoinDelta,
    coinDelta: habitResult.coinDelta + bonusCoinDelta,
  };
}

export function habitXpTotal(habitState) {
  const normalized = normalizeHabitState(habitState);
  return Object.values(normalized.entries).reduce(
    (total, entry) => total + Math.max(0, Number(entry?.xpAwarded) || 0),
    0,
  );
}

export function habitXpForCurrentPeriods(
  habitState,
  date,
  planStartDate,
) {
  const normalized = normalizeHabitState(habitState);
  const dailyKey = `d:${keyOf(date)}`;
  const weeklyKey = habitPeriodKey(
    { frequency: 'weekly' },
    date,
    planStartDate,
  );
  return Object.values(normalized.entries).reduce((total, entry) => {
    if (entry?.periodKey !== dailyKey && entry?.periodKey !== weeklyKey) {
      return total;
    }
    return total + Math.max(0, Number(entry.xpAwarded) || 0);
  }, 0);
}
