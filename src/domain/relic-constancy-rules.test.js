import { describe, expect, it } from 'vitest';
import { calculateWeekBossDamage } from './boss-combat-rules.js';
import {
  activateRelicConstancy,
  constancyActivationKey,
  constancyCharge,
  emptyLootState,
  normalizeLootState,
  syncRelicConstancy,
} from './loot-rules.js';
import { weeklyBossPenalty } from './hero-rules.js';

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

  it.each([[1, 15], [2, 25], [3, 40]])(
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
    expect(first.xp).toBe(40);
    expect(repeated.activated).toBe(false);
    expect(repeated.xp).toBe(0);
    expect(Object.keys(repeated.inventory.weeklyActivations)
      .filter((key) => key === constancyActivationKey(cycleId))).toHaveLength(1);
  });

  it('sincroniza y persiste la carga sin entregar recompensas durante renderizados', () => {
    const synced = syncRelicConstancy(yelmoState(), {
      cycleId: 'week-3:boss-3', outcomes: ['hit', 'hit', 'hit', 'pend'],
    });
    const reloaded = normalizeLootState(JSON.parse(JSON.stringify(synced)));
    expect(reloaded.inventory.constancy).toEqual({ cycleId: 'week-3:boss-3', charge: 3 });
    expect(reloaded.inventory.weeklyActivations).toEqual({});
  });

  it('migra partidas antiguas conservando la instancia completa de relic_04', () => {
    const legacy = yelmoState(2);
    delete legacy.inventory.constancy;
    const before = JSON.parse(JSON.stringify(legacy.inventory.relics.relic_04));
    const normalized = normalizeLootState(legacy);
    expect(normalized.inventory.relics.relic_04).toEqual(before);
    expect(normalized.inventory.constancy).toEqual({ cycleId: '', charge: 0 });
  });

  it('el Yelmo ya no reduce el castigo semanal', () => {
    expect(weeklyBossPenalty({ hp: 100, maxHp: 100, maxMp: 100 })).toEqual({
      hp: 70,
      mp: 20,
    });
  });
});
