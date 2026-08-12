import { describe, expect, it } from 'vitest';
import { adjustHabitProgress } from './habit-rules.js';
import { regenerationIntervalMinutes } from './hero-rules.js';
import { calculateGameStats } from './progression-rules.js';
import { castSpellEffect } from './spell-rules.js';

describe('integración de efectos de reliquias', () => {
  it('Disciplina y Seda suman XP sin superar el cap diario', () => {
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
    expect(second.xpDelta).toBe(12);
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
      relicBonuses: { maxHp: 5, maxMana: 5 },
    });
    expect(stats.xp).toBe(10);
    expect(stats.maxHp).toBe(base.maxHp + 5);
    expect(stats.maxMp).toBe(base.maxMp + 5);
  });
});
