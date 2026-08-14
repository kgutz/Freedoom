import { describe, expect, it } from 'vitest';
import {
  adjustHabitProgress,
  applyHabitCoinRewards,
  habitCoinReward,
  habitEntryFor,
  habitPeriodKey,
  habitReward,
  habitXpTotal,
  nextHabitOrder,
  normalizeHabitState,
  normalizeHabitInput,
  reorderHabits,
  sortHabits,
} from './habit-rules.js';
import { journeyDayDate } from './journey-mode-rules.js';

const date = new Date(2026, 7, 1, 12);
const startDate = '2026-07-17';
const habit = {
  id: 'water',
  title: 'Beber agua',
  difficulty: 'medium',
  frequency: 'daily',
  target: 2,
};

const economy = (coins = 0) => ({ coins, bossBlood: 2, transactions: [] });

function progressWithCoins({
  habitState,
  currentEconomy,
  targetHabit = habit,
  delta,
  currentDate = date,
  rewardMultiplier = 1,
}) {
  const progress = adjustHabitProgress({
    habitState,
    habit: targetHabit,
    delta,
    date: currentDate,
    planStartDate: startDate,
    rewardMultiplier,
  });
  const coins = applyHabitCoinRewards({
    habitState: progress.habitState,
    economy: currentEconomy,
    habit: targetHabit,
    date: currentDate,
    planStartDate: startDate,
    becameCompleted: progress.becameCompleted,
    becameIncomplete: progress.becameIncomplete,
    nowTimestamp: 100,
  });
  return { progress, ...coins };
}

describe('hábitos', () => {
  it('conserva el orden antiguo por fecha y respeta el orden personalizado', () => {
    const ordered = sortHabits([
      { id: 'third', createdAt: 30 },
      { id: 'first', createdAt: 10 },
      { id: 'second', createdAt: 20 },
    ]);
    expect(ordered.map((item) => item.id)).toEqual(['first', 'second', 'third']);

    const custom = sortHabits([
      { id: 'first', order: 2, createdAt: 10 },
      { id: 'second', order: 0, createdAt: 20 },
      { id: 'third', order: 1, createdAt: 30 },
    ]);
    expect(custom.map((item) => item.id)).toEqual(['second', 'third', 'first']);
  });

  it('reordena solo el grupo indicado y calcula la posición del siguiente hábito', () => {
    const state = {
      items: [
        { id: 'water', frequency: 'daily', active: true, createdAt: 1 },
        { id: 'walk', frequency: 'daily', active: true, createdAt: 2 },
        { id: 'gym', frequency: 'weekly', active: true, order: 4, createdAt: 3 },
      ],
      entries: {},
    };
    const reordered = reorderHabits(state, 'daily', ['walk', 'unknown', 'walk', 'water']);
    expect(
      sortHabits(reordered.items.filter((item) => item.frequency === 'daily')).map((item) => item.id),
    ).toEqual(['walk', 'water']);
    expect(reordered.items.find((item) => item.id === 'gym').order).toBe(4);
    expect(nextHabitOrder(reordered, 'daily')).toBe(2);
    expect(nextHabitOrder(reordered, 'weekly')).toBe(5);
  });

  it('normaliza los campos editables y sus límites', () => {
    expect(
      normalizeHabitInput({
        title: '  Caminar  ',
        notes: '  Después de comer ',
        difficulty: 'hard',
        frequency: 'weekly',
        target: 80,
      }),
    ).toEqual({
      title: 'Caminar',
      notes: 'Después de comer',
      difficulty: 'hard',
      frequency: 'weekly',
      target: 20,
    });
  });

  it('entrega XP una sola vez al alcanzar el objetivo y la retira al deshacer', () => {
    const first = adjustHabitProgress({
      habitState: null,
      habit,
      delta: 1,
      date,
      planStartDate: startDate,
    });
    const completed = adjustHabitProgress({
      habitState: first.habitState,
      habit,
      delta: 1,
      date,
      planStartDate: startDate,
    });
    const repeated = adjustHabitProgress({
      habitState: completed.habitState,
      habit,
      delta: 1,
      date,
      planStartDate: startDate,
    });
    const undone = adjustHabitProgress({
      habitState: repeated.habitState,
      habit,
      delta: -1,
      date,
      planStartDate: startDate,
    });

    expect(first.xpDelta).toBe(0);
    expect(completed.xpDelta).toBe(6);
    expect(repeated.xpDelta).toBe(0);
    expect(undone.xpDelta).toBe(-6);
    expect(habitXpTotal(undone.habitState)).toBe(0);
  });

  it('limita la XP diaria total a 25', () => {
    let habitState = null;
    for (let index = 0; index < 3; index += 1) {
      const result = adjustHabitProgress({
        habitState,
        habit: {
          ...habit,
          id: `hard-${index}`,
          difficulty: 'hard',
          target: 1,
        },
        delta: 1,
        date,
        planStartDate: startDate,
      });
      habitState = result.habitState;
    }

    expect(habitXpTotal(habitState)).toBe(25);
  });

  it('permite hasta 35 XP semanales para todas las clases', () => {
    const weeklyHard = {
      ...habit,
      id: 'weekly-hard',
      difficulty: 'hard',
      frequency: 'weekly',
      target: 1,
    };
    const weeklyMedium = {
      ...habit,
      id: 'weekly-medium',
      difficulty: 'medium',
      frequency: 'weekly',
      target: 1,
    };
    const first = adjustHabitProgress({
      habitState: null,
      habit: weeklyHard,
      delta: 1,
      date,
      planStartDate: startDate,
    });
    const second = adjustHabitProgress({
      habitState: first.habitState,
      habit: weeklyMedium,
      delta: 1,
      date,
      planStartDate: startDate,
    });

    expect(first.xpDelta).toBe(30);
    expect(second.xpDelta).toBe(5);
    expect(habitXpTotal(second.habitState)).toBe(35);
  });

  it('aplica Ojo Certero sin superar el tope de XP del periodo',()=>{
    const focused=adjustHabitProgress({
      habitState:null,
      habit:{...habit,target:1},
      delta:1,
      date,
      planStartDate:startDate,
      rewardMultiplier:1.5,
    });
    expect(focused.entry.xpAwarded).toBe(9);

    let habitState=focused.habitState;
    for(let index=0;index<3;index+=1){
      const result=adjustHabitProgress({
        habitState,
        habit:{...habit,id:`focused-${index}`,difficulty:'hard',target:1},
        delta:1,
        date,
        planStartDate:startDate,
        rewardMultiplier:1.5,
      });
      habitState=result.habitState;
    }
    expect(habitXpTotal(habitState)).toBe(25);
  });

  it('reinicia el progreso diario y alinea el semanal con el plan', () => {
    const nextDay = new Date(2026, 7, 2, 12);
    const weekly = { ...habit, frequency: 'weekly' };
    const result = adjustHabitProgress({
      habitState: null,
      habit,
      delta: 1,
      date,
      planStartDate: startDate,
    });

    expect(habitEntryFor(result.habitState, habit, nextDay, startDate).count).toBe(0);
    expect(habitPeriodKey(weekly, date, startDate)).toBe('w:2026-07-31');
    expect(habitReward(weekly)).toBe(18);
  });

  it.each([
    ['daily', 'easy', 1],
    ['daily', 'medium', 2],
    ['daily', 'hard', 3],
    ['weekly', 'easy', 3],
    ['weekly', 'medium', 5],
    ['weekly', 'hard', 8],
  ])('entrega monedas %s de dificultad %s', (frequency, difficulty, expected) => {
    const targetHabit = { ...habit, id: `${frequency}-${difficulty}`, frequency, difficulty, target: 1 };
    const result = progressWithCoins({
      habitState: { items: [targetHabit], entries: {} },
      currentEconomy: economy(),
      targetHabit,
      delta: 1,
    });
    expect(habitCoinReward(targetHabit)).toBe(expected);
    expect(result.habitCoinDelta).toBe(expected);
    expect(result.economy.coins).toBe(expected + (frequency === 'daily' ? 3 : 0));
  });

  it('no entrega monedas antes del objetivo y solo recompensa una vez', () => {
    const initial = { items: [habit], entries: {} };
    const first = progressWithCoins({ habitState: initial, currentEconomy: economy(), delta: 1 });
    const completed = progressWithCoins({
      habitState: first.habitState,
      currentEconomy: first.economy,
      delta: 1,
    });
    const repeated = progressWithCoins({
      habitState: completed.habitState,
      currentEconomy: completed.economy,
      delta: 1,
    });
    expect(first.coinDelta).toBe(0);
    expect(completed.habitCoinDelta).toBe(2);
    expect(completed.bonusCoinDelta).toBe(3);
    expect(repeated.coinDelta).toBe(0);
    expect(repeated.economy.coins).toBe(5);
  });

  it('retira monedas al deshacer y permite recuperarlas sin duplicarlas', () => {
    const targetHabit = { ...habit, target: 1 };
    const completed = progressWithCoins({
      habitState: { items: [targetHabit], entries: {} },
      currentEconomy: economy(), targetHabit, delta: 1,
    });
    const undone = progressWithCoins({
      habitState: completed.habitState,
      currentEconomy: completed.economy, targetHabit, delta: -1,
    });
    const recompleted = progressWithCoins({
      habitState: undone.habitState,
      currentEconomy: undone.economy, targetHabit, delta: 1,
    });
    expect(completed.economy.coins).toBe(5);
    expect(undone.habitCoinDelta).toBe(-2);
    expect(undone.bonusCoinDelta).toBe(-3);
    expect(undone.economy.coins).toBe(0);
    expect(recompleted.economy.coins).toBe(5);
    expect(recompleted.economy.transactions).toHaveLength(2);
  });

  it('nunca deja el saldo negativo al deshacer una recompensa ya gastada', () => {
    const targetHabit = { ...habit, target: 1 };
    const completed = progressWithCoins({
      habitState: { items: [targetHabit], entries: {} },
      currentEconomy: economy(), targetHabit, delta: 1,
    });
    const spentEconomy = { ...completed.economy, coins: 0 };
    const undone = progressWithCoins({
      habitState: completed.habitState,
      currentEconomy: spentEconomy, targetHabit, delta: -1,
    });
    const recompleted = progressWithCoins({
      habitState: undone.habitState,
      currentEconomy: undone.economy, targetHabit, delta: 1,
    });
    expect(undone.economy.coins).toBe(0);
    expect(recompleted.economy.coins).toBe(0);
  });

  it('el bonus exige todos los hábitos diarios e ignora los semanales', () => {
    const dailyEasy = { ...habit, id: 'daily-easy', difficulty: 'easy', target: 1 };
    const dailyHard = { ...habit, id: 'daily-hard', difficulty: 'hard', target: 1 };
    const weekly = { ...habit, id: 'weekly', frequency: 'weekly', target: 3 };
    let habitState = { items: [dailyEasy, dailyHard, weekly], entries: {} };
    let currentEconomy = economy();
    const first = progressWithCoins({ habitState, currentEconomy, targetHabit: dailyEasy, delta: 1 });
    habitState = first.habitState; currentEconomy = first.economy;
    expect(first.bonusCoinDelta).toBe(0);
    const second = progressWithCoins({ habitState, currentEconomy, targetHabit: dailyHard, delta: 1 });
    expect(second.habitCoinDelta).toBe(3);
    expect(second.bonusCoinDelta).toBe(3);
    expect(second.economy.coins).toBe(7);
  });

  it('retira el bonus cuando un hábito diario deja de estar completo', () => {
    const firstHabit = { ...habit, id: 'first', target: 1 };
    const secondHabit = { ...habit, id: 'second', target: 1 };
    let habitState = { items: [firstHabit, secondHabit], entries: {} };
    let currentEconomy = economy();
    const first = progressWithCoins({ habitState, currentEconomy, targetHabit: firstHabit, delta: 1 });
    const second = progressWithCoins({ habitState: first.habitState, currentEconomy: first.economy, targetHabit: secondHabit, delta: 1 });
    const undone = progressWithCoins({ habitState: second.habitState, currentEconomy: second.economy, targetHabit: secondHabit, delta: -1 });
    expect(undone.bonusCoinDelta).toBe(-3);
    expect(undone.economy.coins).toBe(2);
  });

  it('no concede bonus cuando no existen hábitos diarios activos', () => {
    const weekly = { ...habit, id: 'weekly-only', frequency: 'weekly', target: 1 };
    const result = progressWithCoins({
      habitState: { items: [weekly], entries: {} },
      currentEconomy: economy(), targetHabit: weekly, delta: 1,
    });
    expect(result.bonusCoinDelta).toBe(0);
    expect(result.economy.coins).toBe(5);
  });

  it('usa el día lógico de las 04:00 para identificar la recompensa diaria', () => {
    const config = { journeyMode: 'reduction', dayStartTime: '04:00' };
    const beforeBoundary = journeyDayDate(config, new Date(2026, 7, 2, 3, 59));
    const afterBoundary = journeyDayDate(config, new Date(2026, 7, 2, 4, 0));
    const targetHabit = { ...habit, target: 1 };
    const before = progressWithCoins({
      habitState: { items: [targetHabit], entries: {} },
      currentEconomy: economy(), targetHabit, delta: 1, currentDate: beforeBoundary,
    });
    const after = progressWithCoins({
      habitState: before.habitState,
      currentEconomy: before.economy, targetHabit, delta: 1, currentDate: afterBoundary,
    });
    expect(before.progress.entry.periodKey).toBe('d:2026-08-01');
    expect(after.progress.entry.periodKey).toBe('d:2026-08-02');
    expect(after.coinDelta).toBe(5);
  });

  it('entrega monedas aunque el tope de XP diaria ya esté completo', () => {
    const habits = Array.from({ length: 3 }, (_, index) => ({
      ...habit, id: `cap-${index}`, difficulty: 'hard', target: 1,
    }));
    let habitState = { items: habits, entries: {} };
    let currentEconomy = economy();
    let last;
    habits.forEach((targetHabit) => {
      last = progressWithCoins({ habitState, currentEconomy, targetHabit, delta: 1 });
      habitState = last.habitState;
      currentEconomy = last.economy;
    });
    expect(last.progress.xpDelta).toBe(5);
    expect(last.habitCoinDelta).toBe(3);
    expect(habitXpTotal(habitState)).toBe(25);
    expect(currentEconomy.coins).toBe(12);
  });

  it('normaliza partidas anteriores e impide duplicar tras recargar', () => {
    const targetHabit = { ...habit, target: 1 };
    const completed = progressWithCoins({
      habitState: { items: [targetHabit], entries: {} },
      currentEconomy: economy(), targetHabit, delta: 1,
    });
    const reloaded = progressWithCoins({
      habitState: JSON.parse(JSON.stringify(completed.habitState)),
      currentEconomy: JSON.parse(JSON.stringify(completed.economy)),
      targetHabit, delta: 1,
    });
    expect(normalizeHabitState({ items: [], entries: {} }).dailyCoinBonuses).toEqual({});
    expect(reloaded.coinDelta).toBe(0);
    expect(reloaded.economy.coins).toBe(5);
  });
});
