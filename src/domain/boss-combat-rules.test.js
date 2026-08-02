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
  it('en el camino sin fumar solo daña al confirmar el día', () => {
    expect(
      calculateDailyBossDamage({
        record: { sf: 'success', c: 99, s: 9 },
        limit: 0,
        settled: true,
        journeyMode: 'smoke_free',
      }),
    ).toMatchObject({ completion: 25, margin: 0, perfect: 0, total: 25 });
    expect(
      calculateDailyBossDamage({
        record: { sf: 'smoked' },
        limit: 0,
        settled: true,
        journeyMode: 'smoke_free',
      }),
    ).toMatchObject({ completed: false, total: 0 });
  });
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

  it('ignora las pastillas y añade perfectos limitados y bonus de cero', () => {
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
      pills: 0,
      perfect: 3,
      zero: 15,
      total: 53,
    });
  });

  it('durante el día solo aplica disparos perfectos', () => {
    expect(
      calculateDailyBossDamage({
        record: { c: 5, p: 3, s: 2 },
        limit: 20,
        settled: false,
      }),
    ).toMatchObject({
      completion: 0,
      margin: 0,
      pills: 0,
      perfect: 2,
      zero: 0,
      total: 2,
    });
  });
});

describe('combate semanal', () => {
  it('derrota al jefe con seis confirmaciones explícitas sin fumar', () => {
    const smokeFreeConfig = { ...config, journeyMode: 'smoke_free' };
    const status = calculateBossCombatStatus({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 6, 22, 12),
      config: smokeFreeConfig,
      days: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'success' },
        '2026-07-19': { sf: 'success' },
        '2026-07-20': { sf: 'success' },
        '2026-07-21': { sf: 'success' },
        '2026-07-22': { sf: 'success' },
      },
    });

    expect(status).toMatchObject({ hp: 0, won: true, completedDays: 6 });
  });
  it('necesita seis días exactos para derrotar un jefe de 150 HP', () => {
    const combat = createBossCombat({
      currentWeek: 0,
      legacyBossesDown: 0,
    });
    const status = calculateBossCombatStatus({
      combat,
      now: new Date(2026, 6, 23, 12),
      config,
      days: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 20 },
        '2026-07-19': { c: 20 },
        '2026-07-20': { c: 20 },
        '2026-07-21': { c: 20 },
        '2026-07-22': { c: 20 },
      },
    });

    expect(status.hp).toBe(0);
    expect(status.won).toBe(true);
    expect(status.completedDays).toBe(6);
    expect(status.recentHits[0]).toMatchObject({
      key: '2026-07-22',
      total: 25,
    });
  });

  it('no permite matarlo antes del sexto día aunque reciba daño de sobra', () => {
    const combat = createBossCombat({
      currentWeek: 0,
      legacyBossesDown: 0,
    });
    const status = calculateBossCombatStatus({
      combat,
      now: new Date(2026, 6, 22, 12),
      config,
      days: {
        '2026-07-17': { c: 0, p: 3, s: 3 },
        '2026-07-18': { c: 0, p: 3, s: 3 },
        '2026-07-19': { c: 0, p: 3, s: 3 },
        '2026-07-20': { c: 0, p: 3, s: 3 },
        '2026-07-21': { c: 0, p: 3, s: 3 },
      },
    });

    expect(status.damageThisWeek).toBeGreaterThan(150);
    expect(status.completedDays).toBe(5);
    expect(status.hp).toBe(1);
    expect(status.won).toBe(false);
    expect(status.lockedByDays).toBe(true);
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
      remainingHp: 125,
    });
    expect(first.combat.hpAtWeekStart).toBe(150);
    expect(first.status.hp).toBe(150);
    expect(first.status.bossNum).toBe(3);
  });

  it('registra una victoria una sola vez y permite deshacerla', () => {
    const combat = createBossCombat({
      currentWeek: 0,
      legacyBossesDown: 1,
    });
    const winningDays = {
      '2026-07-17': { c: 20 },
      '2026-07-18': { c: 20 },
      '2026-07-19': { c: 20 },
      '2026-07-20': { c: 20 },
      '2026-07-21': { c: 20 },
      '2026-07-22': { c: 20 },
    };
    const won = reconcileBossCombat({
      combat,
      now: new Date(2026, 6, 23, 12),
      config,
      days: winningDays,
    });
    const stable = reconcileBossCombat({
      combat: won.combat,
      now: new Date(2026, 6, 23, 12),
      config,
      days: winningDays,
    });
    const revoked = reconcileBossCombat({
      combat: stable.combat,
      now: new Date(2026, 6, 23, 12),
      config,
      days: {
        ...winningDays,
        '2026-07-22': { c: 21 },
      },
    });

    expect(won.newlyDefeated).toBe(true);
    expect(won.combat.defeated).toBe(1);
    expect(stable.newlyDefeated).toBe(false);
    expect(stable.combat.defeated).toBe(1);
    expect(revoked.defeatRevoked).toBe(true);
    expect(revoked.combat.defeated).toBe(0);
    expect(revoked.status.hp).toBe(25);
  });

  it('migra proporcionalmente los combates creados con 100 HP', () => {
    const migrated = reconcileBossCombat({
      combat: {
        ...createBossCombat({
          currentWeek: 0,
          legacyBossesDown: 0,
        }),
        version: 1,
        hpAtWeekStart: 60,
      },
      now: new Date(2026, 6, 17, 12),
      config,
      days: {},
    });

    expect(migrated.combat.version).toBe(2);
    expect(migrated.combat.hpAtWeekStart).toBe(90);
  });

  it('termina la campaña al derrotar el último jefe del plan', () => {
    const shortConfig = { ...config, startLimit: 6 };
    const winningDays = {
      '2026-07-17': { c: 6 },
      '2026-07-18': { c: 6 },
      '2026-07-19': { c: 6 },
      '2026-07-20': { c: 6 },
      '2026-07-21': { c: 6 },
      '2026-07-22': { c: 6 },
    };
    const won = reconcileBossCombat({
      combat: createBossCombat({
        currentWeek: 0,
        legacyBossesDown: 5,
        maxBosses: 6,
      }),
      now: new Date(2026, 6, 23, 12),
      config: shortConfig,
      days: winningDays,
    });
    const finished = reconcileBossCombat({
      combat: won.combat,
      now: new Date(2026, 6, 24, 12),
      config: shortConfig,
      days: winningDays,
    });

    expect(won.status.bossNum).toBe(6);
    expect(finished.combat.completed).toBe(true);
    expect(finished.status).toMatchObject({
      bossNum: 6,
      bossesDown: 6,
      won: true,
      hp: 0,
      campaignComplete: true,
    });
  });
});
