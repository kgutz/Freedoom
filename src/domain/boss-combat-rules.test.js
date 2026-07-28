import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_HP,
  calculateBossCombatStatus,
  calculateDailyBossDamage,
  createBossCombat,
  reconcileBossCombat,
} from './boss-combat-rules.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
  pillsGoal: 3,
  takesPills: true,
};

describe('daño diario al jefe', () => {
  it('hace 25 por cumplir y hasta 10 por margen', () => {
    expect(
      calculateDailyBossDamage({
        record: { c: 20 },
        limit: 20,
        settled: true,
      }),
    ).toMatchObject({ completion: 25, margin: 0, total: 25 });
    expect(
      calculateDailyBossDamage({
        record: { c: 12 },
        limit: 20,
        settled: true,
      }),
    ).toMatchObject({ completion: 25, margin: 10, total: 35 });
  });

  it('añade pastillas, perfectos limitados y bonus de cero', () => {
    expect(
      calculateDailyBossDamage({
        record: { c: 0, p: 3, s: 9 },
        limit: 20,
        settled: true,
        pillsGoal: 3,
      }),
    ).toMatchObject({
      completion: 25,
      margin: 10,
      pills: 5,
      perfect: 3,
      zero: 15,
      total: 58,
    });
  });

  it('durante el día solo aplica pastillas y disparos perfectos', () => {
    expect(
      calculateDailyBossDamage({
        record: { c: 5, p: 3, s: 2 },
        limit: 20,
        settled: false,
      }),
    ).toMatchObject({
      completion: 0,
      margin: 0,
      pills: 5,
      perfect: 2,
      zero: 0,
      total: 7,
    });
  });
});

describe('combate semanal', () => {
  it('cuatro días exactos derrotan un jefe de 100 HP', () => {
    const combat = createBossCombat({
      currentWeek: 0,
      legacyBossesDown: 0,
    });
    const status = calculateBossCombatStatus({
      combat,
      now: new Date(2026, 6, 21, 12),
      config,
      days: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 20 },
        '2026-07-19': { c: 20 },
        '2026-07-20': { c: 20 },
      },
    });

    expect(status.hp).toBe(0);
    expect(status.won).toBe(true);
    expect(status.recentHits[0]).toMatchObject({
      key: '2026-07-20',
      total: 25,
    });
  });

  it('recupera toda la vida si el jefe sobrevive', () => {
    const first = reconcileBossCombat({
      combat: createBossCombat({
        currentWeek: 0,
        legacyBossesDown: 2,
      }),
      now: new Date(2026, 6, 24, 12),
      config,
      days: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 21 },
        '2026-07-19': { c: 21 },
        '2026-07-20': { c: 21 },
        '2026-07-21': { c: 21 },
        '2026-07-22': { c: 21 },
        '2026-07-23': { c: 21 },
      },
    });

    expect(first.weekResults[0]).toMatchObject({
      won: false,
      remainingHp: 75,
    });
    expect(first.combat.hpAtWeekStart).toBe(100);
    expect(first.status.hp).toBe(100);
    expect(first.status.bossNum).toBe(3);
  });

  it('registra una victoria una sola vez y permite deshacerla', () => {
    const combat = createBossCombat({
      currentWeek: 0,
      legacyBossesDown: 1,
    });
    combat.hpAtWeekStart = 2;
    const won = reconcileBossCombat({
      combat,
      now: new Date(2026, 6, 17, 12),
      config,
      days: { '2026-07-17': { c: 1, p: 3, s: 2 } },
    });
    const stable = reconcileBossCombat({
      combat: won.combat,
      now: new Date(2026, 6, 17, 12),
      config,
      days: { '2026-07-17': { c: 1, p: 3, s: 2 } },
    });
    const revoked = reconcileBossCombat({
      combat: stable.combat,
      now: new Date(2026, 6, 17, 12),
      config,
      days: { '2026-07-17': { c: 1, p: 0, s: 0 } },
    });

    expect(won.newlyDefeated).toBe(true);
    expect(won.combat.defeated).toBe(1);
    expect(stable.newlyDefeated).toBe(false);
    expect(stable.combat.defeated).toBe(1);
    expect(revoked.defeatRevoked).toBe(true);
    expect(revoked.combat.defeated).toBe(0);
    expect(revoked.status.hp).toBe(BOSS_MAX_HP - 98);
  });
});
