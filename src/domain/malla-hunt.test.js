import { describe, expect, it } from 'vitest';
import { relicRankEffect, relicDefinition, FUSION_RELIC_DEFINITIONS } from '../data/loot-data.js';
import { emptyLootState, normalizeLootState, equippedHuntEffects, equippedRelicBonuses, attemptForge } from './loot-rules.js';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';
import { calculateDailyBossDamage } from './boss-combat-rules.js';
import { weeklyBossPenalty } from './hero-rules.js';

function stateFor(rank, equipped = true) {
  const state = emptyLootState();
  state.inventory.relics.relic_09 = { unlocked: true, rank, rarity: 'rare', affixes: [] };
  state.inventory.equipped = equipped ? ['relic_09'] : [];
  return normalizeLootState(JSON.parse(JSON.stringify(state)));
}
const hero = { maxHp: 1000, maxMana: 0, physicalAttack: 1, defense: 0 };
const enemy = { maxHp: 1000, physicalAttack: 100, defense: 0 };
const fight = (effects, extra = {}) => simulatePveCombat({ hero, enemy, maxRounds: 3, roll: () => 0.99, relicEffects: effects, ...extra });

describe('Malla: Escamas protectoras', () => {
  it.each([[1, 5], [2, 8], [3, 12]])('rango %i: %i%% solo equipada, persistente y sin ataque añadido', (rank, percent) => {
    expect(relicRankEffect('relic_09', rank)).toBe(percent);
    const state = stateFor(rank);
    const effects = equippedHuntEffects(state);
    expect(effects.damageReduction).toBe(percent);
    expect(equippedHuntEffects(stateFor(rank, false)).damageReduction).toBe(0);
    expect(fight(effects).roundDetails.map(r => r.damageTaken)).toEqual(Array(3).fill(100 - percent));
    expect(fight(equippedHuntEffects(stateFor(rank, false))).damageTaken).toBe(300);
    expect(equippedRelicBonuses(state)).toMatchObject({ physicalAttack: 0, magicAttack: 0 });
    expect(equippedRelicBonuses(state).defense).toBeGreaterThan(0);
    expect(normalizeLootState(state)).toEqual(state);
  });
  it.each(['physical', 'magic'])('reduce daño %s y críticos después de defensa y Ojo, no suma porcentajes', attackType => {
    const result = fight({ damageReduction: 12, petrification: 27 }, { enemy: { ...enemy, attackType, magicAttack: 100 } });
    expect(result.roundDetails.map(r => r.damageTaken)).toEqual([64, 88, 88]);
    expect(fight({ damageReduction: 12 }, { enemy: { ...enemy, criticalChance: 1 } }).roundDetails[0].damageTaken).toBe(140);
  });
  it('mantiene mínimo 1, evasiones 0 y los ceros que Ojo ya permitía', () => {
    expect(fight({ damageReduction: 12 }, { enemy: { ...enemy, physicalAttack: 1 } }).roundDetails[0].damageTaken).toBe(1);
    expect(fight({ damageReduction: 12 }, { hero: { ...hero, dodgeChance: 1 } }).damageTaken).toBe(0);
    expect(fight({ damageReduction: 12, petrification: 27 }, { enemy: { ...enemy, physicalAttack: 1 } }).roundDetails.map(r => r.damageTaken)).toEqual([0, 1, 1]);
  });
  it.each([1, 2, 3])('se conserva al guardar y protege los tres encuentros, rango %i', rank => {
    const run = effects => {
      const started = startHunt({ hunt: {}, difficultyId: 'easy', level: 20, seed: 15, nowTimestamp: 1000, relicEffects: effects });
      expect(started.ok).toBe(true);
      return resolveHunt({ hunt: JSON.parse(JSON.stringify(started.hunt)), classId: 'knight', level: 20, allocation: { constitution: 60 }, nowTimestamp: 61000 }).report;
    };
    const base = run({});
    const reduced = run(equippedHuntEffects(stateFor(rank)));
    expect(reduced.encounters).toHaveLength(3);
    reduced.encounters.forEach((encounter, i) => {
      expect(encounter.damageTaken).toBeGreaterThan(0);
      expect(encounter.damageTaken).toBeLessThan(base.encounters[i].damageTaken);
    });
  });
  it.each([1, 2, 3])('no reembolsa Forja ni cambia daño semanal, rango %i', rank => {
    const state = stateFor(rank);
    state.economy.coins = 1000; state.economy.bossBlood = 50;
    state.inventory.relics.relic_01 = { unlocked: true, rank: 1, rarity: 'rare', affixes: [] };
    const result = attemptForge({ state, relicId: 'relic_01', operationId: 'test', randomValue: 0.99 });
    expect(result.coinsRefunded).toBe(0);
    expect(result.economy.coins).toBe(1000 - result.spentCoins);
    const args = { record: { c: 0, p: 3, s: 0 }, limit: 5, settled: true };
    expect(calculateDailyBossDamage({ ...args, relicEffects: equippedHuntEffects(state) })).toEqual(calculateDailyBossDamage(args));
    const penalty = { hp: 100, maxHp: 100, maxMp: 100 };
    expect(weeklyBossPenalty({ ...penalty, relicEffects: equippedHuntEffects(state) })).toEqual(weeklyBossPenalty(penalty));
    expect(weeklyBossPenalty(penalty).hp).toBe(70);
  });
  it('no hereda los antiguos 40% desde recetas ajenas; solo seis recetas legítimas de Malla', () => {
    expect(FUSION_RELIC_DEFINITIONS.filter(r => r.ingredientIds.includes('relic_09'))).toHaveLength(6);
    const state = stateFor(3);
    state.inventory.relics.fusion_01 = { unlocked: true, rank: 3, rarity: 'rare', affixes: [], inheritedEffects: { relic_09: 40 } };
    state.inventory.equipped = ['fusion_01'];
    expect(equippedHuntEffects(state).damageReduction).toBe(0);
    expect(relicDefinition('relic_09').effectFamily).toBe('hunt-damage-reduction');
  });
});
