import { describe, expect, it } from 'vitest';
import {
  adjustHabitProgress,
  applyHabitCoinRewards,
  calculateHabitXpCap,
  habitCoinReward,
  habitEntryFor,
  habitPeriodKey,
  habitPotentialXp,
  habitReward,
  habitXpCapForState,
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

  it.each([
    ['daily', 9, 25],
    ['daily', 25, 25],
    ['daily', 26, 26],
    ['weekly', 34, 35],
    ['weekly', 35, 35],
    ['weekly', 36, 36],
  ])('calcula el tope %s con %i XP potenciales', (frequency, potential, expected) => {
    expect(calculateHabitXpCap(frequency, potential)).toBe(expected);
  });

  it('calcula 45 XP de tope para cinco hábitos diarios difíciles', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...habit, id: `hard-${index}`, difficulty: 'hard', target: 1, active: true,
    }));
    const state = { items, entries: {} };
    expect(habitPotentialXp(state, 'daily')).toBe(50);
    expect(habitXpCapForState(state, 'daily')).toBe(45);
  });

  it('aplica los hard caps diario y semanal', () => {
    expect(calculateHabitXpCap('daily', 500)).toBe(100);
    expect(calculateHabitXpCap('weekly', 500)).toBe(120);
  });

  it('suma dificultades activas por frecuencia sin multiplicar por repeticiones', () => {
    const state = {
      items: [
        { ...habit, id: 'daily-easy', difficulty: 'easy', target: 20, active: true },
        { ...habit, id: 'daily-medium', difficulty: 'medium', active: true },
        { ...habit, id: 'daily-hard', difficulty: 'hard', active: true },
        { ...habit, id: 'inactive-hard', difficulty: 'hard', active: false },
        { ...habit, id: 'weekly-easy', difficulty: 'easy', frequency: 'weekly', active: true },
        { ...habit, id: 'weekly-hard', difficulty: 'hard', frequency: 'weekly', active: true },
      ],
      entries: {},
    };
    expect(habitPotentialXp(state, 'daily')).toBe(19);
    expect(habitPotentialXp(state, 'weekly')).toBe(39);
    expect(habitXpCapForState(state, 'daily')).toBe(25);
    expect(habitXpCapForState(state, 'weekly')).toBe(38);
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

  it('concede solo la XP restante bajo el tope dinámico y la retira al deshacer', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...habit, id: `dynamic-${index}`, difficulty: 'hard', target: 1, active: true,
    }));
    let habitState = { items, entries: {} };
    const results = [];
    items.forEach((targetHabit) => {
      const result = adjustHabitProgress({
        habitState, habit: targetHabit, delta: 1, date, planStartDate: startDate,
      });
      habitState = result.habitState;
      results.push(result);
    });
    expect(results.map((result) => result.xpDelta)).toEqual([10, 10, 10, 10, 5]);
    expect(habitXpTotal(habitState)).toBe(45);

    const undone = adjustHabitProgress({
      habitState, habit: items[4], delta: -1, date, planStartDate: startDate,
    });
    expect(undone.xpDelta).toBe(-5);
    expect(habitXpTotal(undone.habitState)).toBe(40);
  });

  it('mantiene la XP histórica al editar, desactivar o eliminar hábitos', () => {
    const original = { ...habit, id: 'historical', difficulty: 'hard', target: 1, active: true };
    const completed = adjustHabitProgress({
      habitState: { items: [original], entries: {} },
      habit: original, delta: 1, date, planStartDate: startDate,
    });
    const edited = {
      ...completed.habitState,
      items: [{ ...original, difficulty: 'easy', active: false }],
    };
    const removed = { ...completed.habitState, items: [] };
    expect(habitXpTotal(edited)).toBe(10);
    expect(habitXpTotal(removed)).toBe(10);
    expect(removed.entries['historical|d:2026-08-01'].xpAwarded).toBe(10);
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

  it('limita bonus de clase y Disciplina con el nuevo tope dinámico', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...habit, id: `boosted-${index}`, difficulty: 'hard', target: 1, active: true,
    }));
    let habitState = { items, entries: {} };
    const deltas = [];
    items.forEach((targetHabit) => {
      const result = adjustHabitProgress({
        habitState,
        habit: targetHabit,
        delta: 1,
        date,
        planStartDate: startDate,
        rewardMultiplier: 1.5,
        flatRewardBonus: 1,
      });
      habitState = result.habitState;
      deltas.push(result.xpDelta);
    });
    expect(deltas).toEqual([16, 16, 13, 0, 0]);
    expect(habitXpTotal(habitState)).toBe(45);
  });

  it('calcula topes dinámicos en partidas antiguas sin guardar campos nuevos', () => {
    const legacy = {
      items: Array.from({ length: 5 }, (_, index) => ({
        ...habit, id: `legacy-${index}`, difficulty: 'hard', active: true,
      })),
      entries: {},
    };
    const normalized = normalizeHabitState(legacy);
    expect(normalized).not.toHaveProperty('xpCap');
    expect(habitXpCapForState(normalized, 'daily')).toBe(45);
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
    ['daily', 'easy', 2],
    ['daily', 'medium', 3],
    ['daily', 'hard', 5],
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
    expect(completed.habitCoinDelta).toBe(3);
    expect(completed.bonusCoinDelta).toBe(3);
    expect(repeated.coinDelta).toBe(0);
    expect(repeated.economy.coins).toBe(6);
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
    expect(completed.economy.coins).toBe(6);
    expect(undone.habitCoinDelta).toBe(-3);
    expect(undone.bonusCoinDelta).toBe(-3);
    expect(undone.economy.coins).toBe(0);
    expect(recompleted.economy.coins).toBe(6);
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
    expect(second.habitCoinDelta).toBe(5);
    expect(second.bonusCoinDelta).toBe(3);
    expect(second.economy.coins).toBe(10);
  });

  it('suma 2 + 3 + 5 y mantiene el bonus diario adicional de 3', () => {
    const habits = [
      { ...habit, id: 'easy', difficulty: 'easy', target: 1 },
      { ...habit, id: 'medium', difficulty: 'medium', target: 1 },
      { ...habit, id: 'hard', difficulty: 'hard', target: 1 },
    ];
    let habitState = { items: habits, entries: {} };
    let currentEconomy = economy();
    let result;
    habits.forEach((targetHabit) => {
      result = progressWithCoins({ habitState, currentEconomy, targetHabit, delta: 1 });
      habitState = result.habitState;
      currentEconomy = result.economy;
    });
    expect(result.habitCoinDelta).toBe(5);
    expect(result.bonusCoinDelta).toBe(3);
    expect(currentEconomy.coins).toBe(13);
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
    expect(undone.economy.coins).toBe(3);
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
    expect(after.coinDelta).toBe(6);
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
    expect(last.progress.xpDelta).toBe(9);
    expect(last.habitCoinDelta).toBe(5);
    expect(habitXpTotal(habitState)).toBe(29);
    expect(currentEconomy.coins).toBe(18);
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
    expect(reloaded.economy.coins).toBe(6);
  });

  it('conserva recompensas históricas persistidas sin recalcularlas con la tabla nueva', () => {
    const targetHabit = { ...habit, id: 'legacy-easy', difficulty: 'easy', target: 1 };
    const periodKey = 'd:2026-08-01';
    const transactionId = `habit-coin:${targetHabit.id}|${periodKey}`;
    const historicalState = {
      items: [targetHabit],
      entries: {
        [`${targetHabit.id}|${periodKey}`]: {
          habitId: targetHabit.id,
          periodKey,
          frequency: 'daily',
          count: 1,
          xpAwarded: 3,
          coinsAwarded: 1,
        },
      },
      dailyCoinBonuses: {},
    };
    const historicalEconomy = economy(1);
    historicalEconomy.transactions.push({ id: transactionId, coins: 1 });
    const result = applyHabitCoinRewards({
      habitState: historicalState,
      economy: historicalEconomy,
      habit: targetHabit,
      date,
      planStartDate: startDate,
      becameCompleted: false,
      becameIncomplete: false,
      nowTimestamp: 200,
    });
    expect(result.coinDelta).toBe(0);
    expect(result.economy.coins).toBe(1);
    expect(result.habitState.entries[`${targetHabit.id}|${periodKey}`].coinsAwarded).toBe(1);
  });
});
