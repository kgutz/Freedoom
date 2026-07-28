import { describe, expect, it } from 'vitest';
import {
  calculateBossState,
  calculateGameStats,
} from './progression-rules.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
  pillsGoal: 3,
  takesPills: true,
};

describe('progreso completo', () => {
  it('calcula XP, racha y nivel desde los días guardados', () => {
    const stats = calculateGameStats({
      now: new Date(2026, 6, 19, 12),
      config,
      days: {
        '2026-07-17': { c: 20, p: 0 },
        '2026-07-18': { c: 21, p: 0 },
        '2026-07-19': { c: 1, p: 0, s: 2, sx: 6 },
      },
      game: { cls: 'paladin' },
    });

    expect(stats.xp).toBe(56);
    expect(stats.lvl).toBe(2);
    expect(stats.streak).toBe(0);
    expect(stats.currW).toBe(0);
  });

  it('suma el jefe y la recompensa al cerrar una semana ganada', () => {
    const days = {};
    for (let day = 17; day <= 23; day += 1) {
      days[`2026-07-${day}`] = { c: day <= 20 ? 20 : 21, p: 0 };
    }
    const stats = calculateGameStats({
      now: new Date(2026, 6, 24, 12),
      config,
      days,
      game: { cls: 'knight' },
    });

    expect(stats.bossesDown).toBe(1);
    expect(stats.xp).toBeGreaterThanOrEqual(400);
  });

  it('mantiene la racha cuando Último Bastión perdona un día', () => {
    const stats = calculateGameStats({
      now: new Date(2026, 6, 20, 12),
      config,
      days: {
        '2026-07-17': { c: 18, p: 0 },
        '2026-07-18': { c: 25, p: 0 },
        '2026-07-19': { c: 18, p: 0 },
      },
      game: { cls: 'knight', pardons: ['2026-07-18'] },
    });

    expect(stats.streak).toBe(3);
  });

  it('usa las victorias congeladas del nuevo combate sin recalcularlas', () => {
    const stats = calculateGameStats({
      now: new Date(2026, 6, 24, 12),
      config,
      days: {},
      game: {
        cls: 'knight',
        bossCombat: {
          legacyBossesDown: 2,
          defeated: 1,
        },
      },
    });

    expect(stats.bossesDown).toBe(3);
    expect(stats.xp).toBeGreaterThanOrEqual(600);
  });
});

describe('estado del jefe', () => {
  it('marca victoria al asegurar cuatro días cumplidos', () => {
    const state = calculateBossState({
      now: new Date(2026, 6, 20, 12),
      config,
      days: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 19 },
        '2026-07-19': { c: 18 },
        '2026-07-20': { c: 17 },
      },
      bossesDown: 0,
    });

    expect(state.hits).toBe(4);
    expect(state.won).toBe(true);
    expect(state.lost).toBe(false);
    expect(state.pips.slice(0, 4)).toEqual(['hit', 'hit', 'hit', 'today']);
  });

  it('mantiene el jefe actual según las semanas realmente ganadas', () => {
    const state = calculateBossState({
      now: new Date(2026, 6, 17, 12),
      config,
      days: {},
      bossesDown: 2,
    });

    expect(state.bossNum).toBe(3);
    expect(state.slug).toBe('arana');
  });
});
