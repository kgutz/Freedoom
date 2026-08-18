import { describe, expect, it } from 'vitest';
import { calculateWeekBossDamage } from './boss-combat-rules.js';
import {
  activateRelicConstancy,
  constancyActivationKey,
  constancyCharge,
  emptyLootState,
  equipRelic,
  normalizeLootState,
  syncRelicConstancy,
  unequipRelic,
} from './loot-rules.js';
import { weeklyBossPenalty } from './hero-rules.js';
import { calculateGameStats } from './progression-rules.js';
import { relicRankEffect } from '../data/loot-data.js';

const SIX_HITS = ['hit', 'hit', 'hit', 'hit', 'hit', 'hit', 'pend'];

function yelmoState(rank = 1) {
  const state = emptyLootState();
  state.inventory.relics.relic_04 = {
    unlocked: true,
    rarity: 'mythic',
    rank,
    affixes: ['vitality', 'fortune'],
    obtainedAt: 10,
    bossIndex: 3,
  };
  state.inventory.equipped = ['relic_04'];
  return state;
}

function sixDates(recordFactory) {
  return Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => {
      const date = new Date(2026, 7, 3 + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return [key, recordFactory(index, date)];
    }),
  );
}

describe('Constancia del Yelmo de la Última Brasa', () => {
  it('suma un punto por día cumplido, se limita a 6 y pendiente no suma', () => {
    expect(constancyCharge(['hit'])).toBe(1);
    expect(constancyCharge(SIX_HITS)).toBe(6);
    expect(constancyCharge([...SIX_HITS, 'hit', 'hit'])).toBe(6);
    expect(constancyCharge(['hit', 'hit', 'pend', 'today'])).toBe(2);
  });

  it('un fallo reinicia la carga y permite comenzar otra racha', () => {
    expect(constancyCharge(['hit', 'hit', 'hit', 'fail'])).toBe(0);
    expect(constancyCharge(['hit', 'hit', 'fail', 'hit', 'hit'])).toBe(2);
  });

  it.each([
    ['reducción', {
      journeyMode: 'reduction', startDate: '2026-08-03', startLimit: 20,
    }, sixDates(() => ({ c: 10 }))],
    ['mantenerse sin fumar', {
      journeyMode: 'smoke_free', startDate: '2026-08-03', startLimit: 20,
    }, sixDates(() => ({ sf: 'success' }))],
    ['consumo controlado', {
      journeyMode: 'controlled', startDate: '2026-08-03', startLimit: 20,
      controlledDays: [5, 6, 0], controlledWeeklyLimit: 5,
    }, sixDates((_index, date) => date.getDay() === 5 || date.getDay() === 6
      ? { c: 1 }
      : { sf: 'success' })],
  ])('usa los días cumplidos existentes en el camino de %s', (_name, config, days) => {
    const week = calculateWeekBossDamage({
      week: 0,
      now: new Date(2026, 7, 9, 12),
      config,
      days,
    });
    expect(week.pips.slice(0, 6)).toEqual(Array(6).fill('hit'));
    expect(constancyCharge(week.pips)).toBe(6);
  });

  it.each([[1, 20], [2, 30], [3, 45]])(
    'Rango %i entrega %i XP completa fuera de los caps de hábitos',
    (rank, expectedXp) => {
      const state = yelmoState(rank);
      state.habits = { weeklyXp: 35, dailyXp: 25 };
      const result = activateRelicConstancy({
        state,
        cycleId: `week-3:boss-3:rank-${rank}`,
        outcomes: SIX_HITS,
        bossWon: true,
        nowTimestamp: 100,
      });
      expect(result.activated).toBe(true);
      expect(result.xp).toBe(expectedXp);
      expect(result.inventory.constancy.charge).toBe(0);
      const fullHabitCap = {
        items: [],
        entries: {
          'daily|d:2026-08-09': {
            habitId: 'daily', periodKey: 'd:2026-08-09', frequency: 'daily',
            count: 1, xpAwarded: 25,
          },
        },
      };
      const base = calculateGameStats({
        now: new Date(2026, 7, 9, 12),
        config: { startDate: '2026-08-03', startLimit: 20 }, days: {},
        game: { cls: 'knight' }, habits: fullHabitCap,
      });
      const rewarded = calculateGameStats({
        now: new Date(2026, 7, 9, 12),
        config: { startDate: '2026-08-03', startLimit: 20 }, days: {},
        game: { cls: 'knight', bonusXp: result.xp }, habits: fullHabitCap,
      });
      expect(rewarded.xp - base.xp).toBe(expectedXp);
    },
  );

  it('no recompensa sin victoria, sin seis cargas o si el Yelmo no está equipado', () => {
    const state = yelmoState(2);
    expect(activateRelicConstancy({
      state, cycleId: 'no-win', outcomes: SIX_HITS, bossWon: false,
    }).xp).toBe(0);
    expect(activateRelicConstancy({
      state, cycleId: 'only-five', outcomes: SIX_HITS.slice(0, 5), bossWon: true,
    }).xp).toBe(0);
    state.inventory.equipped = [];
    expect(activateRelicConstancy({
      state, cycleId: 'not-equipped', outcomes: SIX_HITS, bossWon: true,
    }).xp).toBe(0);
  });

  it('un mismo ciclo no duplica XP tras reload, importación o restauración', () => {
    const cycleId = 'week-3:boss-3';
    const first = activateRelicConstancy({
      state: yelmoState(3), cycleId, outcomes: SIX_HITS, bossWon: true, nowTimestamp: 10,
    });
    const restored = JSON.parse(JSON.stringify(first));
    const repeated = activateRelicConstancy({
      state: restored, cycleId, outcomes: SIX_HITS, bossWon: true, nowTimestamp: 20,
    });
    expect(first.xp).toBe(45);
    expect(repeated.activated).toBe(false);
    expect(repeated.xp).toBe(0);
    expect(Object.keys(repeated.inventory.weeklyActivations)
      .filter((key) => key === constancyActivationKey(cycleId))).toHaveLength(1);
  });

  it('mantiene la Daga de Alquitrán exactamente en 2, 3 y 4 XP', () => {
    expect([1, 2, 3].map((rank) => relicRankEffect('relic_03', rank))).toEqual([2, 3, 4]);
  });

  it('sincroniza y persiste la carga sin entregar recompensas durante renderizados', () => {
    const synced = syncRelicConstancy(yelmoState(), {
      cycleId: 'week-3:boss-3', outcomes: ['hit', 'hit', 'hit', 'pend'],
    });
    const reloaded = normalizeLootState(JSON.parse(JSON.stringify(synced)));
    expect(reloaded.inventory.constancy).toMatchObject({
      cycleId: 'week-3:boss-3', charge: 3, baselineOutcomes: [], awaitingBaseline: false,
    });
    expect(reloaded.inventory.weeklyActivations).toEqual({});
  });

  it('migra partidas antiguas conservando la instancia completa de relic_04', () => {
    const legacy = yelmoState(2);
    delete legacy.inventory.constancy;
    const before = JSON.parse(JSON.stringify(legacy.inventory.relics.relic_04));
    const normalized = normalizeLootState(legacy);
    expect(normalized.inventory.relics.relic_04).toEqual(before);
    expect(normalized.inventory.constancy).toMatchObject({
      cycleId: '', charge: 0, baselineOutcomes: [], awaitingBaseline: false,
    });
  });

  it('solo carga días nuevos mientras una fuente de Constancia permanece equipada', () => {
    const raw = yelmoState();
    raw.inventory.equipped = [];
    let state = syncRelicConstancy(raw, {
      cycleId: 'week-3:boss-3', outcomes: ['hit'], nowTimestamp: 1,
    });
    expect(state.inventory.constancy.charge).toBe(0);

    state = equipRelic(state, 'relic_04');
    state = syncRelicConstancy(state, {
      cycleId: 'week-3:boss-3', outcomes: ['hit', 'hit'], nowTimestamp: 2,
    });
    expect(state.inventory.constancy.charge).toBe(0);
    state = syncRelicConstancy(state, {
      cycleId: 'week-3:boss-3', outcomes: ['hit', 'hit', 'hit'], nowTimestamp: 3,
    });
    expect(state.inventory.constancy.charge).toBe(1);
  });

  it('desequipar con carga exige confirmación; cancelar conserva todo y confirmar reinicia', () => {
    const state = yelmoState();
    state.inventory.constancy = {
      cycleId: 'week-3:boss-3', charge: 4, baselineOutcomes: [], awaitingBaseline: false,
      lastIncreaseAt: 10, lastIncreaseCharge: 4,
    };
    const cancelled = unequipRelic(state, 'relic_04');
    expect(cancelled).toMatchObject({
      ok: false, reason: 'constancy-confirmation-required', charge: 4, maxCharge: 6,
    });
    expect(cancelled.inventory.equipped).toContain('relic_04');
    expect(cancelled.inventory.constancy.charge).toBe(4);

    const confirmed = unequipRelic(state, 'relic_04', { confirmConstancyReset: true });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.inventory.equipped).not.toContain('relic_04');
    expect(confirmed.inventory.constancy.charge).toBe(0);
  });

  it('desequipar con 0/6 es normal y cambiar la segunda reliquia conserva la carga', () => {
    let state = yelmoState();
    const zero = unequipRelic(state, 'relic_04');
    expect(zero.ok).toBe(true);

    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 11, bossIndex: 0,
    };
    state.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 12, bossIndex: 1,
    };
    state.inventory.equipped = ['relic_04', 'relic_01'];
    state.inventory.constancy = {
      cycleId: 'week-3:boss-3', charge: 3, baselineOutcomes: [], awaitingBaseline: false,
      lastIncreaseAt: 10, lastIncreaseCharge: 3,
    };
    const replaced = equipRelic(state, 'relic_02', 1);
    expect(replaced.ok).toBe(true);
    expect(replaced.inventory.equipped).toEqual(['relic_04', 'relic_02']);
    expect(replaced.inventory.constancy.charge).toBe(3);
  });

  it('sustituir el Yelmo cargado exige confirmación y reinicia al aceptar', () => {
    const state = yelmoState();
    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 11, bossIndex: 0,
    };
    state.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 12, bossIndex: 1,
    };
    state.inventory.equipped = ['relic_04', 'relic_02'];
    state.inventory.constancy = {
      cycleId: 'week-3:boss-3', charge: 2, baselineOutcomes: [], awaitingBaseline: false,
      lastIncreaseAt: 10, lastIncreaseCharge: 2,
    };
    const blocked = equipRelic(state, 'relic_01', 0);
    expect(blocked.reason).toBe('constancy-confirmation-required');
    expect(blocked.inventory.equipped).toEqual(['relic_04', 'relic_02']);
    const confirmed = equipRelic(state, 'relic_01', 0, { confirmConstancyReset: true });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.inventory.equipped).toEqual(['relic_01', 'relic_02']);
    expect(confirmed.inventory.constancy.charge).toBe(0);
  });

  it('el Yelmo ya no reduce el castigo semanal', () => {
    expect(weeklyBossPenalty({ hp: 100, maxHp: 100, maxMp: 100 })).toEqual({
      hp: 70,
      mp: 20,
    });
  });
});
