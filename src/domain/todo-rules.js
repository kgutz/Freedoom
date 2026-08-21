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
    target: Math.min(20, Math.max(1, Math.trunc(Number(input.target) || 1))),
  };
}

function todoOrderValue(todo) {
  return Number.isFinite(Number(todo?.order))
    ? Number(todo.order)
    : Number(todo?.createdAt) || 0;
}

export function sortTodos(items = []) {
  return [...items].sort((left, right) =>
    todoOrderValue(left) - todoOrderValue(right)
    || (Number(left?.createdAt) || 0) - (Number(right?.createdAt) || 0));
}

export function nextTodoOrder(todoState) {
  const orders = normalizeTodoState(todoState).items
    .filter((todo) => todo.active !== false)
    .map(todoOrderValue);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export function reorderTodos(todoState, orderedIds = []) {
  const normalized = normalizeTodoState(todoState);
  const activeIds = new Set(normalized.items
    .filter((todo) => todo.active !== false)
    .map((todo) => todo.id));
  const seen = new Set();
  const safeOrder = [];
  orderedIds.forEach((id) => {
    if (activeIds.has(id) && !seen.has(id)) {
      safeOrder.push(id);
      seen.add(id);
    }
  });
  sortTodos(normalized.items.filter((todo) => activeIds.has(todo.id))).forEach((todo) => {
    if (!seen.has(todo.id)) safeOrder.push(todo.id);
  });
  const positions = new Map(safeOrder.map((id, index) => [id, index]));
  return {
    ...normalized,
    items: normalized.items.map((todo) => positions.has(todo.id)
      ? { ...todo, order: positions.get(todo.id), updatedAt: Date.now() }
      : todo),
  };
}

export function todoReward(todo) {
  const base = { difficulty: todo?.difficulty, frequency: 'daily', target: 1 };
  return { xp: habitReward(base), coins: habitCoinReward(base) };
}

function todoTarget(todo) {
  return Math.min(20, Math.max(1, Math.trunc(Number(todo?.target) || 1)));
}

function todoCount(todo) {
  if (Number.isFinite(Number(todo?.count))) {
    return Math.min(todoTarget(todo), Math.max(0, Math.trunc(Number(todo.count))));
  }
  return todo?.completed === true ? todoTarget(todo) : 0;
}

export function adjustTodoProgress(todoState, todoId, delta, nowTimestamp = Date.now()) {
  const normalized = normalizeTodoState(todoState);
  const current = normalized.items.find((item) => item.id === todoId && item.active !== false);
  if (!current) {
    return { todoState: normalized, changed: false, xpDelta: 0, coinDelta: 0, item: null };
  }
  const target = todoTarget(current);
  const previousCount = todoCount(current);
  const nextCount = Math.min(target, Math.max(0, previousCount + Math.trunc(Number(delta) || 0)));
  if (previousCount === nextCount) {
    return { todoState: normalized, changed: false, xpDelta: 0, coinDelta: 0, item: current };
  }
  const completed = nextCount >= target;
  const reward = todoReward(current);
  const stepDelta = nextCount - previousCount;
  const previousXpAwarded = Math.max(0, Number(current.xpAwarded) || 0);
  const previousCoinsAwarded = Math.max(0, Number(current.coinsAwarded) || 0);
  const savedAwards = Array.isArray(current.progressAwards)
    ? current.progressAwards.slice(0, previousCount).map((award) => ({
        xp: Math.max(0, Number(award?.xp) || 0),
        coins: Math.max(0, Number(award?.coins) || 0),
      }))
    : [];
  while (savedAwards.length < previousCount) {
    savedAwards.push({
      xp: previousCount ? previousXpAwarded / previousCount : 0,
      coins: previousCount ? previousCoinsAwarded / previousCount : 0,
    });
  }
  const nextAwards = [...savedAwards];
  let xpDelta = 0;
  let coinDelta = 0;
  if (stepDelta > 0) {
    for (let step = 0; step < stepDelta; step += 1) {
      nextAwards.push({ xp: reward.xp, coins: reward.coins });
      xpDelta += reward.xp;
      coinDelta += reward.coins;
    }
  } else {
    for (let step = 0; step < Math.abs(stepDelta); step += 1) {
      const removed = nextAwards.pop() || { xp: 0, coins: 0 };
      xpDelta -= removed.xp;
      coinDelta -= removed.coins;
    }
  }
  const next = {
    ...current,
    target,
    count: nextCount,
    completed,
    xpAwarded: Math.max(0, previousXpAwarded + xpDelta),
    coinsAwarded: Math.max(0, previousCoinsAwarded + coinDelta),
    progressAwards: nextAwards,
    completedAt: completed ? (current.completedAt || nowTimestamp) : null,
    updatedAt: nowTimestamp,
  };
  return {
    todoState: {
      ...normalized,
      items: normalized.items.map((item) => item.id === todoId ? next : item),
    },
    changed: true,
    xpDelta,
    coinDelta,
    item: next,
  };
}

export function adjustTodoCompletion(todoState, todoId, completed, nowTimestamp = Date.now()) {
  const normalized = normalizeTodoState(todoState);
  const current = normalized.items.find((item) => item.id === todoId && item.active !== false);
  if (!current) return { todoState: normalized, changed: false, xpDelta: 0, coinDelta: 0, item: null };
  const count = todoCount(current);
  const target = todoTarget(current);
  return adjustTodoProgress(normalized, todoId, completed ? target - count : -count, nowTimestamp);
}

export function archiveTodo(todoState, todoId, nowTimestamp = Date.now()) {
  const normalized = normalizeTodoState(todoState);
  const current = normalized.items.find((item) => item.id === todoId && item.active !== false);
  if (!current) return { todoState: normalized, changed: false, item: null };
  const archived = { ...current, active: false, deletedAt: nowTimestamp, updatedAt: nowTimestamp };
  return {
    todoState: {
      ...normalized,
      items: normalized.items.map((item) => item.id === todoId ? archived : item),
    },
    changed: true,
    item: archived,
  };
}
