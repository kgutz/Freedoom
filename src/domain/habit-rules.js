import { keyOf } from './date-utils.js';
import { weekIndexFor, weekRangeFor } from './plan-rules.js';

export const HABIT_DAILY_XP_CAP = 25;
export const HABIT_WEEKLY_XP_CAP = 35;

export const HABIT_DIFFICULTIES = {
  easy: { label: 'Fácil', dailyXp: 3, weeklyXp: 9 },
  medium: { label: 'Media', dailyXp: 6, weeklyXp: 18 },
  hard: { label: 'Difícil', dailyXp: 10, weeklyXp: 30 },
};

export function emptyHabitState() {
  return { items: [], entries: {} };
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
  const count = Math.min(
    habit.target,
    Math.max(0, previous.count + Math.trunc(Number(delta) || 0)),
  );
  const completed = count >= habit.target;
  const cap =
    habit.frequency === 'weekly'
      ? HABIT_WEEKLY_XP_CAP
      : HABIT_DAILY_XP_CAP;
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
