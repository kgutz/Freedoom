import { describe, expect, it } from 'vitest';
import {
  BOSS_MAX_HP,
  calculateBossCombatStatus,
  calculateDailyBossDamage,
  calculateWeekBossDamage,
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
  it('añade diez de daño cuando el golpe diario guardado fue crítico', () => {
    const result = calculateWeekBossDamage({
      week: 0,
      now: new Date(2026, 6, 18, 12),
      config,
      days: { '2026-07-17': { c: 20 } },
      criticalHits: [{ week: 0, key: '2026-07-17', critical: true }],
      settleAll: true,
    });
    expect(result.daily[0]).toMatchObject({ completion: 25, critical: 10, total: 35 });
  });

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

  it('golpea al jefe si termina un día permitido sin fumar', () => {
    expect(
      calculateDailyBossDamage({
        record: { c: 0 },
        limit: 0,
        settled: true,
        journeyMode: 'controlled',
        controlledAllowedDay: true,
        controlledBudgetExceeded: false,
      }),
    ).toMatchObject({ completed: true, completion: 25, total: 25 });

    expect(
      calculateDailyBossDamage({
        record: { c: 0 },
        limit: 0,
        settled: false,
        journeyMode: 'controlled',
        controlledAllowedDay: true,
        controlledBudgetExceeded: false,
      }),
    ).toMatchObject({ completed: true, completion: 0, total: 0 });
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
  it('resuelve la semana anterior con su camino original tras una transición', () => {
    const transitionedConfig = {
      ...config,
      journeyMode: 'controlled',
      journeyOriginMode: 'smoke_free',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
      journeyTransitions: [
        {
          effectiveDate: '2026-07-24',
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 3,
        },
      ],
    };
    const result = reconcileBossCombat({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 6, 24, 12),
      config: transitionedConfig,
      days: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'success' },
        '2026-07-19': { sf: 'success' },
        '2026-07-20': { sf: 'success' },
        '2026-07-21': { sf: 'success' },
        '2026-07-22': { sf: 'success' },
      },
    });

    expect(result.weekResults[0].won).toBe(true);
    expect(result.combat.defeated).toBe(1);
    expect(result.combat.week).toBe(1);
  });

  it('combina confirmaciones y días permitidos en consumo controlado', () => {
    const controlledConfig = {
      ...config,
      startDate: '2026-08-03',
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    };
    const days = {
      '2026-08-03': { sf: 'success' },
      '2026-08-04': { sf: 'success' },
      '2026-08-05': { sf: 'success' },
      '2026-08-06': { sf: 'success' },
      '2026-08-07': { c: 1 },
      '2026-08-08': { c: 1 },
    };
    const status = calculateBossCombatStatus({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 7, 9, 12),
      config: controlledConfig,
      days,
    });

    expect(status).toMatchObject({
      won: true,
      completedDays: 6,
      controlledWeekUsed: 2,
      controlledBudgetExceeded: false,
    });
  });

  it('respeta cada camino cuando el consumo controlado empieza a mitad de semana', () => {
    const mixedConfig = {
      ...config,
      startDate: '2026-08-02',
      journeyMode: 'controlled',
      journeyOriginMode: 'smoke_free',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 5,
      journeyTransitions: [
        {
          effectiveDate: '2026-08-08',
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 5,
        },
      ],
    };
    const result = calculateWeekBossDamage({
      week: 0,
      now: new Date(2026, 7, 8, 20),
      config: mixedConfig,
      days: {
        '2026-08-03': { sf: 'success' },
        '2026-08-04': { sf: 'success' },
        '2026-08-05': { sf: 'success' },
        '2026-08-06': { sf: 'success' },
        '2026-08-07': { sf: 'success' },
        '2026-08-08': { c: 1 },
      },
      settleAll: true,
    });

    expect(result).toMatchObject({
      controlledMode: true,
      smokeFreeMode: true,
      hits: 6,
      controlledWeekUsed: 1,
      controlledBudgetExceeded: false,
    });
  });

  it('bloquea los días permitidos cuando se supera la bolsa semanal', () => {
    const controlledConfig = {
      ...config,
      startDate: '2026-08-03',
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    };
    const status = calculateBossCombatStatus({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 7, 9, 12),
      config: controlledConfig,
      days: {
        '2026-08-03': { sf: 'success' },
        '2026-08-04': { sf: 'success' },
        '2026-08-05': { sf: 'success' },
        '2026-08-06': { sf: 'success' },
        '2026-08-07': { c: 2 },
        '2026-08-08': { c: 2 },
      },
    });

    expect(status.controlledBudgetExceeded).toBe(true);
    expect(status.completedDays).toBe(4);
    expect(status.won).toBe(false);
  });

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

  it('registra y persiste una Victoria Anticipada solo por daño matemático suficiente', () => {
    const combat = createBossCombat({ currentWeek: 0, legacyBossesDown: 0 });
    const earlyDays = {
      '2026-07-17': { c: 0, s: 3 },
      '2026-07-18': { c: 0, s: 3 },
      '2026-07-19': { c: 0, s: 3 },
      '2026-07-20': { c: 0, s: 3 },
      '2026-07-21': { c: 0, s: 3 },
    };
    const first = reconcileBossCombat({
      combat, now: new Date(2026, 6, 22, 12), config, days: earlyDays,
    });
    const recalculated = reconcileBossCombat({
      combat: first.combat, now: new Date(2026, 6, 22, 12), config, days: earlyDays,
    });

    expect(first).toMatchObject({ newlyEarlyVictory: true, newlyDefeated: false });
    expect(first.status).toMatchObject({ hp: 1, won: false, lockedByDays: true });
    expect(first.combat.earlyVictory).toMatchObject({
      id: 'boss_reward_01:early-victory:week-0', week: 0, bossIndex: 0,
    });
    expect(recalculated.newlyEarlyVictory).toBe(false);
    expect(recalculated.combat.earlyVictory).toEqual(first.combat.earlyVictory);
  });

  it('convierte la Victoria Anticipada en elegibilidad al cumplir el sexto día', () => {
    const earlyDays = {
      '2026-07-17': { c: 0, s: 3 },
      '2026-07-18': { c: 0, s: 3 },
      '2026-07-19': { c: 0, s: 3 },
      '2026-07-20': { c: 0, s: 3 },
      '2026-07-21': { c: 0, s: 3 },
    };
    const early = reconcileBossCombat({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 6, 22, 12), config, days: earlyDays,
    });
    const won = reconcileBossCombat({
      combat: early.combat,
      now: new Date(2026, 6, 23, 12),
      config,
      days: { ...earlyDays, '2026-07-22': { c: 20 } },
    });

    expect(won.newlyDefeated).toBe(true);
    expect(won.status).toMatchObject({ won: true, hp: 0, completedDays: 6 });
    expect(won.earlyVictory).toEqual(early.combat.earlyVictory);
  });

  it('no registra Victoria Anticipada por estar a 1 HP sin daño suficiente', () => {
    const combat = { ...createBossCombat({ currentWeek: 0 }), hpAtWeekStart: 1 };
    const result = reconcileBossCombat({
      combat, now: new Date(2026, 6, 17, 12), config, days: {},
    });
    expect(result.status).toMatchObject({ hp: 1, rawHp: 1, lockedByDays: false });
    expect(result.newlyEarlyVictory).toBe(false);
    expect(result.combat.earlyVictory).toBeNull();
  });

  it('descarta la elegibilidad al fallar la semana y no la arrastra al siguiente combate', () => {
    const earlyDays = {
      '2026-07-17': { c: 0, s: 3 },
      '2026-07-18': { c: 0, s: 3 },
      '2026-07-19': { c: 0, s: 3 },
      '2026-07-20': { c: 0, s: 3 },
      '2026-07-21': { c: 0, s: 3 },
    };
    const early = reconcileBossCombat({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 6, 22, 12), config, days: earlyDays,
    });
    const nextWeek = reconcileBossCombat({
      combat: early.combat,
      now: new Date(2026, 6, 24, 12),
      config,
      days: { ...earlyDays, '2026-07-22': { c: 21 }, '2026-07-23': { c: 21 } },
    });

    expect(nextWeek.weekResults[0]).toMatchObject({ won: false, earlyVictory: null });
    expect(nextWeek.combat).toMatchObject({ week: 1, bossIndex: 0, earlyVictory: null });
  });

  it('consume la elegibilidad ganada y empieza el siguiente jefe sin arrastrarla', () => {
    const earlyDays = {
      '2026-07-17': { c: 0, s: 3 }, '2026-07-18': { c: 0, s: 3 },
      '2026-07-19': { c: 0, s: 3 }, '2026-07-20': { c: 0, s: 3 },
      '2026-07-21': { c: 0, s: 3 },
    };
    const early = reconcileBossCombat({
      combat: createBossCombat({ currentWeek: 0 }),
      now: new Date(2026, 6, 22, 12), config, days: earlyDays,
    });
    const won = reconcileBossCombat({
      combat: early.combat, now: new Date(2026, 6, 23, 12), config,
      days: { ...earlyDays, '2026-07-22': { c: 20 } },
    });
    const nextBoss = reconcileBossCombat({
      combat: won.combat, now: new Date(2026, 6, 24, 12), config,
      days: { ...earlyDays, '2026-07-22': { c: 20 } },
    });

    expect(nextBoss.weekResults[0].earlyVictory).toEqual(early.combat.earlyVictory);
    expect(nextBoss.combat).toMatchObject({ week: 1, bossIndex: 1, earlyVictory: null });
    expect(nextBoss.status.earlyVictoryActive).toBe(false);
  });

  it('no concede retroactivamente elegibilidad a una victoria histórica', () => {
    const historical = {
      ...createBossCombat({ currentWeek: 0 }),
      version: 2,
      victoryRecorded: true,
      defeated: 1,
    };
    const result = reconcileBossCombat({
      combat: historical,
      now: new Date(2026, 6, 23, 12),
      config,
      days: {
        '2026-07-17': { c: 20 }, '2026-07-18': { c: 20 },
        '2026-07-19': { c: 20 }, '2026-07-20': { c: 20 },
        '2026-07-21': { c: 20 }, '2026-07-22': { c: 20 },
      },
    });
    expect(result.newlyDefeated).toBe(false);
    expect(result.newlyEarlyVictory).toBe(false);
    expect(result.earlyVictory).toBeNull();
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

    expect(migrated.combat.version).toBe(4);
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
