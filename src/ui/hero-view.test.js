import { describe, expect, it } from 'vitest';
import { createHeroModel, spriteImage } from './hero-view.js';

const base = (overrides = {}) => ({
  now: new Date(2026, 6, 26, 12),
  config: { wakeTime: '07:00', startLimit: 20 },
  days: { '2026-07-26': { c: 2, s: 1 } },
  game: { cls: 'paladin', hp: 75, mp: 40, buffs: {} },
  stats: {
    lvl: 5,
    tier: 1,
    maxHp: 100,
    maxMp: 100,
    streak: 3,
    bossesDown: 1,
  },
  boss: { pips: [], bossNum: 2, slug: 'espectro', won: false },
  armor: 1,
  ...overrides,
});

describe('modelo de Héroe', () => {
  it('muestra selección mientras no hay clase', () => {
    expect(createHeroModel(base({ game: { cls: null } }))).toEqual({
      selection: true,
    });
  });

  it('calcula humor, barras y efectos activos', () => {
    const now = new Date(2026, 6, 26, 12);
    const model = createHeroModel(
      base({
        now,
        game: {
          cls: 'paladin',
          hp: 75,
          mp: 40,
          buffs: { shield: 2, certeroUntil: now.getTime() + 120_000 },
        },
      }),
    );

    expect(model).toMatchObject({
      selection: false,
      mood: 'happy',
      hpPercent: 75,
      manaPercent: 40,
      perfectToday: 1,
    });
    expect(model.chips).toEqual(['🛡×2', '🎯 2m']);
  });

  it('mantiene dormido al héroe antes de levantarse', () => {
    const model = createHeroModel(
      base({
        now: new Date(2026, 6, 26, 6, 30),
        days: {},
      }),
    );

    expect(model.mood).toBe('sleep');
  });

  it('reutiliza el sprite feliz como respaldo para estados sin arte', () => {
    expect(spriteImage('paladin', 'worried')).toContain(
      'sprites/paladin_happy.png',
    );
  });
});
