import { describe, expect, it } from 'vitest';
import {
  adjustHabitProgress,
  habitXpForCurrentPeriods,
} from './habit-rules.js';
import { regenerationIntervalMinutes } from './hero-rules.js';
import { calculateGameStats } from './progression-rules.js';
import { castSpellEffect } from './spell-rules.js';

describe('integración de efectos de reliquias', () => {
  it('Disciplina y los efectos de reliquia suman XP fuera del cap diario', () => {
    const date = new Date(2026, 7, 12, 12);
    const base = {
      habitState: null,
      habit: { id: 'h1', title: 'Caminar', difficulty: 'hard', frequency: 'daily', target: 1 },
      delta: 1,
      date,
      planStartDate: '2026-08-10',
      flatRewardBonus: 3,
    };
    const first = adjustHabitProgress(base);
    expect(first.xpDelta).toBe(13);
    const second = adjustHabitProgress({
      ...base,
      habitState: first.habitState,
      habit: { ...base.habit, id: 'h2' },
      flatRewardBonus: 20,
    });
    expect(second.xpDelta).toBe(30);
  });

  it('la XP extraordinaria no consume cap ni permite saltárselo después', () => {
    const date = new Date(2026, 7, 12, 12);
    const habits = [
      { id: 'h1', difficulty: 'hard', frequency: 'daily', target: 1 },
      { id: 'h2', difficulty: 'hard', frequency: 'daily', target: 1 },
      { id: 'h3', difficulty: 'hard', frequency: 'daily', target: 1 },
    ];
    let habitState = { items: habits, entries: {} };
    const first = adjustHabitProgress({
      habitState, habit: habits[0], delta: 1, date, planStartDate: '2026-08-10',
      flatRewardBonus: 3,
    });
    habitState = first.habitState;
    const beforeExtra = calculateGameStats({
      now: date, config: { startDate: '2026-08-10', startLimit: 20 }, days: {},
      game: { cls: 'knight' }, habits: habitState,
    });
    const afterExtra = calculateGameStats({
      now: date, config: { startDate: '2026-08-10', startLimit: 20 }, days: {},
      game: { cls: 'knight', bonusXp: 40 }, habits: habitState,
    });
    expect(afterExtra.xp - beforeExtra.xp).toBe(40);
    expect(habitXpForCurrentPeriods(habitState, date, '2026-08-10')).toBe(10);

    const second = adjustHabitProgress({
      habitState, habit: habits[1], delta: 1, date, planStartDate: '2026-08-10',
      flatRewardBonus: 20,
    });
    expect(second.xpDelta).toBe(30);
    expect(habitXpForCurrentPeriods(second.habitState, date, '2026-08-10')).toBe(20);
  });

  it('la XP extraordinaria se entrega completa con el cap semanal lleno', () => {
    const date = new Date(2026, 7, 16, 12);
    const habits = {
      items: [],
      entries: {
        'weekly|w:2026-08-10': {
          habitId: 'weekly', periodKey: 'w:2026-08-10', frequency: 'weekly',
          count: 1, xpAwarded: 35,
        },
      },
    };
    const base = calculateGameStats({
      now: date, config: { startDate: '2026-08-10', startLimit: 20 }, days: {},
      game: { cls: 'knight' }, habits,
    });
    const rewarded = calculateGameStats({
      now: date, config: { startDate: '2026-08-10', startLimit: 20 }, days: {},
      game: { cls: 'knight' }, habits, relicXp: 25,
    });
    expect(rewarded.xp - base.xp).toBe(25);
    expect(habitXpForCurrentPeriods(habits, date, '2026-08-10')).toBe(35);
  });

  it('Regeneración reduce el intervalo de forma aditiva y acotada', () => {
    expect(regenerationIntervalMinutes({
      classId: 'knight', additiveMinutesReduction: 0.5,
    })).toBe(9.5);
    expect(regenerationIntervalMinutes({
      classId: 'knight', additiveMinutesReduction: 99,
    })).toBe(1);
  });

  it('Frasco reduce el coste real del primer hechizo', () => {
    const result = castSpellEffect({
      game: { hp: 50, mp: 20, buffs: {} },
      spell: { id: 'muro', lvl: 1, cost: 20 },
      level: 1,
      maxHp: 100,
      currentWeek: 0,
      dayKey: '2026-08-12',
      manaDiscount: 5,
    });
    expect(result.ok).toBe(true);
    expect(result.spentMana).toBe(15);
    expect(result.game.mp).toBe(5);
  });

  it('Vitalidad, Arcano y XP de Colmillo se calculan como derivados', () => {
    const input = {
      now: new Date(2026, 7, 12, 12),
      config: { startDate: '2026-08-12', startLimit: 20, pillsGoal: 0 },
      days: {},
      game: { cls: 'knight' },
      habits: { items: [], entries: {} },
    };
    const base = calculateGameStats(input);
    const stats = calculateGameStats({
      ...input,
      relicXp: 10,
      relicBonuses: { maxHpPercent: 5, maxManaPercent: 5 },
    });
    expect(stats.xp).toBe(10);
    expect(stats.maxHp).toBe(Math.round(base.maxHp * 1.05));
    expect(stats.maxMp).toBe(Math.round(base.maxMp * 1.05));
  });
});
