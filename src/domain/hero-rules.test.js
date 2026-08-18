import { describe, expect, it } from 'vitest';
import {
  BEER_DAMAGE,
  dailyRecovery,
  pillCompletionReward,
  regenerateHealth,
  regenerationIntervalMinutes,
  weeklyBossPenalty,
} from './hero-rules.js';

describe('descanso diario', () => {
  it('rellena vida y maná al cumplir el límite', () => {
    expect(
      dailyRecovery({
        completedDay: true,
        currentMana: 12,
        maxHp: 130,
        maxMp: 115,
        classId: 'paladin',
        level: 7,
      }),
    ).toEqual({ hp: 130, mp: 115 });
  });

  it('aplica 75% tras fallar a todas las clases', () => {
    expect(
      dailyRecovery({
        completedDay: false,
        currentMana: 40,
        maxHp: 120,
        maxMp: 110,
        classId: 'paladin',
        level: 12,
      }),
    ).toEqual({ hp: 90, mp: 40 });
    expect(
      dailyRecovery({
        completedDay: false,
        currentMana: 40,
        maxHp: 120,
        maxMp: 110,
        classId: 'knight',
        level: 12,
      }),
    ).toEqual({ hp: 90, mp: 40 });
  });

  it('Renacer recupera toda la vida tras un día fallido', () => {
    expect(
      dailyRecovery({
        completedDay: false,
        currentMana: 25,
        maxHp: 140,
        maxMp: 120,
        classId: 'druid',
        level: 14,
        rebirthActive: true,
      }),
    ).toEqual({ hp: 140, mp: 25 });
  });

  it('no mezcla las nuevas pasivas con el descanso base', () => {
    expect(
      dailyRecovery({
        completedDay: false,
        currentMana: 40,
        maxHp: 120,
        maxMp: 110,
        classId: 'knight',
        level: 12,
        passiveMultiplier: 0.55,
      }).hp,
    ).toBe(90);
  });
});

describe('regeneración', () => {
  it('usa 10 minutos normalmente y la mitad con hechizo', () => {
    expect(regenerationIntervalMinutes({ classId: 'knight' })).toBe(10);
    expect(regenerationIntervalMinutes({ classId: 'druid' })).toBe(10);
    expect(
      regenerationIntervalMinutes({
        classId: 'druid',
        regenerationActive: true,
      }),
    ).toBe(5);
    expect(
      regenerationIntervalMinutes({
        classId:'druid',
        druidFastRegeneration:false,
      }),
    ).toBe(10);
  });

  it('mantiene la regeneración base separada de Savia Viva', () => {
    expect(
      regenerationIntervalMinutes({
        classId: 'druid',
        passiveMultiplier: 0.55,
      }),
    ).toBe(10);
  });

  it('aplica los ticks transcurridos sin superar la vida máxima', () => {
    expect(
      regenerateHealth({
        hp: 95,
        hpTimestamp: 0,
        nowTimestamp: 70 * 60_000,
        maxHp: 100,
        classId: 'druid',
      }),
    ).toEqual({ hp: 100, hpTimestamp: 70 * 60_000, ticks: 7 });
  });

  it('ignora relojes futuros o periodos incompletos', () => {
    expect(
      regenerateHealth({
        hp: 80,
        hpTimestamp: 1_000,
        nowTimestamp: 500,
        maxHp: 100,
        classId: 'knight',
      }),
    ).toEqual({ hp: 80, hpTimestamp: 1_000, ticks: 0 });
  });
});

describe('otras reglas de salud', () => {
  it('aplica el castigo semanal sin bajar de cero', () => {
    expect(weeklyBossPenalty({ hp: 20, maxHp: 100, maxMp: 120 })).toEqual({
      hp: 0,
      mp: 24,
    });
    expect(
      weeklyBossPenalty({hp:80,maxHp:100,maxMp:120,damageRate:0.2}),
    ).toEqual({hp:60,mp:24});
  });

  it('mantiene la recompensa de pastillas fuera de las pasivas', () => {
    expect(pillCompletionReward({ classId: 'paladin', level: 8 })).toEqual({
      healing: 15,
      mana: 15,
    });
    expect(pillCompletionReward({ classId: 'druid', level: 5 })).toEqual({
      healing: 15,
      mana: 15,
    });
    expect(BEER_DAMAGE).toBe(5);
  });

  it('no aplica Poción Mayor a la curación base de pastillas', () => {
    expect(
      pillCompletionReward({
        classId: 'druid',
        level: 5,
        passiveMultiplier: 0.55,
      }),
    ).toEqual({ healing: 15, mana: 15 });
  });
});
