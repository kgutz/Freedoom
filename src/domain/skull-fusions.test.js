import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { FUSION_RELIC_DEFINITIONS, fusionDefinition, relicCombatBonuses, relicRankEffect } from '../data/loot-data.js';
import { relicEffectCopy } from '../ui/relic-effect-copy.js';
import { emptyLootState, equipRelic, equippedHuntEffects, equippedRelicBonuses, equippedRelicEffectSources, fuseRelics, fusionRecipeStatus, normalizeLootState, activateRelicConstancy, consumeHuntCharges, unequipRelic } from './loot-rules.js';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';

const ids = Array.from({ length: 11 }, (_, index) => `fusion_${32 + index}`);

function make(id, rank = 1) {
  const definition = fusionDefinition(id);
  const state = emptyLootState();
  state.economy.coins = 10000;
  state.economy.bossBlood = 100;
  for (const ingredientId of definition.ingredientIds) {
    state.inventory.relics[ingredientId] = { unlocked: true, rank, rarity: 'rare', affixes: [] };
  }
  const result = fuseRelics({ state, leftId: definition.ingredientIds[0], rightId: 'relic_10', operationId: `make-${id}`, randomValue: 0, nowTimestamp: 1 });
  expect(result.ok).toBe(true);
  return equipRelic(result, id);
}

function expedition(effects = {}) {
  const begun = startHunt({ hunt: {}, difficultyId: 'easy', level: 50, nowTimestamp: 1000, seed: 5,
    currentHp: 50, maxHp: 100, currentMana: 20, maxMana: 100,
    relicEffects: effects, relicBonuses: { physicalAttack: 10000 }, bonusDayKey: '2026-09-28' });
  expect(begun.ok).toBe(true);
  return resolveHunt({ hunt: JSON.parse(JSON.stringify(begun.hunt)), classId: 'knight', level: 50, nowTimestamp: 61000 }).report;
}

describe('Fusiones de la Calavera', () => {
  it('hay once recetas con imágenes ligeras y sin combinaciones repetidas', () => {
    const recipes = FUSION_RELIC_DEFINITIONS.filter(definition => ids.includes(definition.id));
    expect(recipes).toHaveLength(11);
    expect(new Set(recipes.map(definition => definition.ingredientIds.find(id => id !== 'relic_10'))).size).toBe(11);
    for (const definition of recipes) {
      expect(fusionRecipeStatus(...definition.ingredientIds).definition.id).toBe(definition.id);
      expect(existsSync(new URL(`../../public/${definition.image}`, import.meta.url))).toBe(true);
    }
  });

  it.each(ids.flatMap(id => [1, 2, 3].map(rank => [id, rank])))('%s rango %i conserva dos efectos y escala su bonus', (id, rank) => {
    const state = make(id, rank);
    const definition = fusionDefinition(id);
    const relic = state.inventory.relics[id];
    expect(relic.rank).toBe(rank);
    expect(relicEffectCopy(definition, relic)).toHaveLength(3);
    expect(definition.synergy.values[rank]).toBeGreaterThan(0);
    for (const ingredientId of definition.ingredientIds) {
      expect(relic.inheritedEffects[ingredientId]).toBe(relicRankEffect(ingredientId, rank));
      expect(relic.ingredientSnapshots[ingredientId].rank).toBe(rank);
    }
    expect(equippedRelicEffectSources(state, 'relic_10')).toMatchObject([{ relicId: id, value: relicRankEffect('relic_10', rank) }]);
    const expectedStats = Object.fromEntries(['physicalAttack', 'magicAttack', 'defense'].map(stat => [stat, 0]));
    for (const ingredientId of definition.ingredientIds) {
      for (const bonus of relicCombatBonuses(ingredientId, rank)) expectedStats[bonus.stat] += bonus.value;
    }
    expect(equippedRelicBonuses(state)).toMatchObject(expectedStats);
    expect(normalizeLootState(JSON.parse(JSON.stringify(state))).inventory.relics[id].rank).toBe(rank);
  });

  it('protección, maná y daño de apertura se aplican una sola vez', () => {
    const hero = { maxHp: 100, maxMana: 20, physicalAttack: 10, magicAttack: 10, defense: 0 };
    const enemy = { maxHp: 1000, physicalAttack: 10, defense: 0 };
    const base = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 10, maxRounds: 3, roll: () => 0.99 });
    const enhanced = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 10, maxRounds: 3, roll: () => 0.99,
      relicEffects: { miniFirstHitShield: 4, miniManaOpenings: 3, miniFirstHitMana: 4, miniThreeHabitsHit: 4 } });
    expect(enhanced.miniFirstHitShieldPrevented).toBeGreaterThan(0);
    expect(enhanced.miniFirstHitShieldPrevented).toBeLessThanOrEqual(4);
    expect(enhanced.miniManaSaved).toBe(3);
    expect(enhanced.miniFirstHitManaRecovered).toBe(4);
    expect(enhanced.miniOpeningDamageDealt).toBeGreaterThan(0);
    expect(enhanced.heroMana).toBeGreaterThan(base.heroMana);
  });

  it('XP y oro extra se limitan al minijefe y entran en el total', () => {
    const base = expedition();
    const result = expedition({ miniVictoryXp: 5, miniAllHabitsGold: 12 });
    expect(result.encounters.map(encounter => encounter.miniVictoryXp)).toEqual([0, 0, 5]);
    expect(result.encounters.map(encounter => encounter.miniAllHabitsGold)).toEqual([0, 0, 12]);
    expect(result.rewards.xp - base.rewards.xp).toBe(5);
    expect(result.rewards.gold - base.rewards.gold).toBe(12);
  });

  it('Constancia prepara una sola carga que se consume al entrar y se pierde al desequipar', () => {
    let state = make('fusion_41');
    state.inventory.constancy = { cycleId: 'cycle', charge: 6, baselineOutcomes: [], awaitingBaseline: false };
    const activated = activateRelicConstancy({ state, cycleId: 'cycle', outcomes: Array(6).fill('hit'), bossWon: true, nowTimestamp: 1 });
    expect(activated.inventory.huntCharges.fusion_41).toBe(true);
    expect(equippedHuntEffects(activated).miniConstancyHit).toBe(3);
    expect(equippedHuntEffects(consumeHuntCharges(activated)).miniConstancyHit).toBe(0);
    expect(unequipRelic(activated, 'fusion_41', { confirmConstancyReset: true }).inventory.huntCharges.fusion_41).toBe(false);
  });
});
