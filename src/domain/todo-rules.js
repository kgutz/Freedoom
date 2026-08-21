import { HABIT_DIFFICULTIES, habitCoinReward, habitReward } from './habit-rules.js';

export function emptyTodoState() {
  return { items: [] };
}

export function normalizeTodoState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyTodoState();
  return {
    items: Array.isArray(value.items)
      ? value.items.filter((item) => item && typeof item === 'object')
      : [],
  };
}

export function normalizeTodoInput(input = {}) {
  return {
    title: String(input.title || '').trim().slice(0, 60),
    notes: String(input.notes || '').trim().slice(0, 180),
    difficulty: HABIT_DIFFICULTIES[input.difficulty] ? input.difficulty : 'easy',
  };
}

export function todoReward(todo) {
  const base = { difficulty: todo?.difficulty, frequency: 'daily', target: 1 };
  return { xp: habitReward(base), coins: habitCoinReward(base) };
}

export function adjustTodoCompletion(todoState, todoId, completed, nowTimestamp = Date.now()) {
  const normalized = normalizeTodoState(todoState);
  const current = normalized.items.find((item) => item.id === todoId && item.active !== false);
  if (!current || Boolean(current.completed) === Boolean(completed)) {
    return { todoState: normalized, changed: false, xpDelta: 0, coinDelta: 0, item: current || null };
  }

  const reward = completed
    ? todoReward(current)
    : {
        xp: Math.max(0, Number(current.xpAwarded) || 0),
        coins: Math.max(0, Number(current.coinsAwarded) || 0),
      };
  const next = {
    ...current,
    completed: Boolean(completed),
    xpAwarded: completed ? reward.xp : 0,
    coinsAwarded: completed ? reward.coins : 0,
    completedAt: completed ? nowTimestamp : null,
    updatedAt: nowTimestamp,
  };
  return {
    todoState: {
      ...normalized,
      items: normalized.items.map((item) => item.id === todoId ? next : item),
    },
    changed: true,
    xpDelta: completed ? reward.xp : -reward.xp,
    coinDelta: completed ? reward.coins : -reward.coins,
    item: next,
  };
}
