import { describe, expect, it } from 'vitest';
import {
  adjustHabitProgress,
  habitEntryFor,
  habitPeriodKey,
  habitReward,
  habitXpTotal,
  nextHabitOrder,
  normalizeHabitInput,
  reorderHabits,
  sortHabits,
} from './habit-rules.js';

const date = new Date(2026, 7, 1, 12);
const startDate = '2026-07-17';
const habit = {
  id: 'water',
  title: 'Beber agua',
  difficulty: 'medium',
  frequency: 'daily',
  target: 2,
};

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
});
