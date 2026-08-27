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
  it('mantiene la XP anterior al cambiar de sin fumar a controlado', () => {
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
    const stats = calculateGameStats({
      now: new Date(2026, 6, 25, 12),
      config: transitionedConfig,
      days: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'success' },
        '2026-07-24': { c: 1 },
      },
      game: { cls: 'knight' },
    });

    expect(stats.xp).toBe(150);
    expect(stats.streak).toBe(1);
  });

  it('reduce un 15% la vida máxima al fumar en un día prohibido de Control', () => {
    const controlledConfig = {
      ...config,
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    };
    const smoked = calculateGameStats({
      now: new Date(2026, 7, 3, 12),
      config: controlledConfig,
      days: { '2026-08-03': { sf: 'smoked' } },
      game: { cls: 'knight' },
    });
    const compliant = calculateGameStats({
      now: new Date(2026, 7, 3, 12),
      config: controlledConfig,
      days: { '2026-08-03': { sf: 'success' } },
      game: { cls: 'knight' },
    });

    expect(smoked.maxHpPenaltyPercent).toBe(15);
    expect(smoked.maxHp).toBe(Math.round(compliant.maxHp * 0.85));
    expect(compliant.maxHpPenaltyPercent).toBe(0);
  });

  it('en modo sin fumar solo recompensa confirmaciones explícitas', () => {
    const smokeFreeConfig = { ...config, journeyMode: 'smoke_free' };
    const stats = calculateGameStats({
      now: new Date(2026, 6, 20, 12),
      config: smokeFreeConfig,
      days: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'smoked' },
        '2026-07-19': {},
        '2026-07-20': { sf: 'success' },
      },
      game: { cls: 'knight' },
    });

    expect(stats.xp).toBe(100);
    expect(stats.streak).toBe(1);
  });

  it('aplica las pasivas de XP del Paladín a confirmaciones y cada tercer día',()=>{
    const smokeFreeConfig={...config,journeyMode:'smoke_free'};
    const days={
      '2026-07-17':{sf:'success'},
      '2026-07-18':{sf:'success'},
      '2026-07-19':{sf:'success'},
    };
    const common={
      now:new Date(2026,6,19,12),config:smokeFreeConfig,days,
    };
    const paladin=calculateGameStats({
      ...common,game:{cls:'paladin',bonusXp:5000},
    });
    const knight=calculateGameStats({
      ...common,game:{cls:'knight',bonusXp:5000},
    });

    expect(paladin.xp-knight.xp).toBe(0);
  });

  it('aplica Cosecha Oscura y Peste sin modificar los sellos del jefe',()=>{
    const smokeFreeConfig={...config,journeyMode:'smoke_free'};
    const days={
      '2026-07-17':{sf:'success'},
      '2026-07-18':{sf:'success'},
      '2026-07-19':{sf:'success'},
    };
    const base=calculateGameStats({
      now:new Date(2026,6,19,12),config:smokeFreeConfig,days,
      game:{cls:'knight',bonusXp:1000},
    });
    const sorcerer=calculateGameStats({
      now:new Date(2026,6,19,12),config:smokeFreeConfig,days,
      game:{cls:'sorcerer',bonusXp:1000,pestXpDays:['2026-07-19']},
    });

    expect(sorcerer.xp-base.xp).toBe(0);
    expect(sorcerer.bossesDown).toBe(base.bossesDown);
  });
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

  it('concede 10 XP por completar las pastillas', () => {
    const base = {
      now: new Date(2026, 6, 18, 12),
      config,
      game: { cls: 'paladin' },
    };
    const withoutPills = calculateGameStats({
      ...base,
      days: { '2026-07-17': { c: 20, p: 0 } },
    });
    const withPills = calculateGameStats({
      ...base,
      days: { '2026-07-17': { c: 20, p: 3 } },
    });

    expect(withPills.xp).toBe(withoutPills.xp + 10);
  });

  it('suma al héroe la XP concedida por hábitos', () => {
    const stats = calculateGameStats({
      now: new Date(2026, 6, 17, 12),
      config,
      days: {},
      game: { cls: 'paladin' },
      habits: {
        items: [],
        entries: {
          'walk|d:2026-07-17': {
            habitId: 'walk',
            periodKey: 'd:2026-07-17',
            frequency: 'daily',
            count: 1,
            xpAwarded: 6,
          },
        },
      },
    });

    expect(stats.xp).toBe(6);
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
