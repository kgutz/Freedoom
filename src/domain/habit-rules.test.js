import { describe, expect, it } from 'vitest';
import {
  adjustHabitProgress,
  habitEntryFor,
  habitPeriodKey,
  habitReward,
  habitXpTotal,
  normalizeHabitInput,
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
