import { describe, expect, it } from 'vitest';
import { FUSION_RELIC_DEFINITIONS, fusionDefinition, relicCombatBonuses, relicDefinition, relicRankEffect } from '../data/loot-data.js';
import { emptyLootState, equipRelic, equippedHuntEffects, equippedRelicBonuses, fuseRelics, normalizeLootState } from './loot-rules.js';
import { relicEffectCopy } from '../ui/relic-effect-copy.js';
import { resolveHunt, simulatePveCombat, startHunt } from './pve-combat-rules.js';

const HERO = { maxHp: 100, maxMana: 20, physicalAttack: 20, magicAttack: 20, defense: 0, criticalChance: 0, dodgeChance: 0 };
const ENEMY = { maxHp: 100, physicalAttack: 1, defense: 0, dodgeChance: 0, criticalChance: 0, attackType: 'physical' };

function fight({ attackType = 'physical', effects = {}, rounds = 8, enemy = {}, heroHp = 100, roll = () => 0.5 } = {}) {
  return simulatePveCombat({ hero: HERO, enemy: { ...ENEMY, ...enemy }, heroHp, heroMana: 20, attackType, roll, maxRounds: rounds, relicEffects: effects });
}

function owned(ids, rank = 1) {
  const state = emptyLootState();
  state.economy.coins = 10000;
  state.economy.bossBlood = 100;
  for (const id of ids) state.inventory.relics[id] = { unlocked: true, rank, rarity: 'rare', affixes: [] };
  return state;
}

describe('Puño de Papel: +2 de Defensa y Remate', () => {
  it.each([[1, 4], [2, 5], [3, 6]])('rango %i suma Ataque +%i y Defensa +2 fija', (rank, attack) => {
    expect(relicCombatBonuses('relic_12', rank)).toEqual([{ stat: 'physicalAttack', value: attack }, { stat: 'defense', value: 2 }]);
    const bonuses = equippedRelicBonuses(equipRelic(owned(['relic_12'], rank), 'relic_12'));
    expect(bonuses).toMatchObject({ physicalAttack: attack, defense: 2 });
  });

  it('las tres fusiones del Puño heredan la Defensa +2', () => {
    for (const id of ['fusion_40', 'fusion_50', 'fusion_62']) {
      const definition = fusionDefinition(id);
      const bonuses = relicCombatBonuses(id, 1);
      expect(definition.ingredientIds).toContain('relic_12');
      expect(bonuses.find(bonus => bonus.stat === 'defense')?.value).toBeGreaterThanOrEqual(2);
    }
    expect(relicCombatBonuses('fusion_62', 3).find(bonus => bonus.stat === 'defense')?.value).toBe(2);
    expect(relicCombatBonuses('fusion_40', 1).find(bonus => bonus.stat === 'physicalAttack')?.value).toBe(4);
  });

  it('su efecto es de Cacería, de familia propia, con rangos 10/15/20 y sin oro ni hábitos', () => {
    const definition = relicDefinition('relic_12');
    expect(definition.effectFamily).toBe('finisher');
    expect([1, 2, 3].map(rank => relicRankEffect('relic_12', rank))).toEqual([10, 15, 20]);
    for (const rank of [1, 2, 3]) {
      const text = relicEffectCopy(definition, { rank })[0].description;
      expect(text).toContain(`${10 + (rank - 1) * 5}%`);
      expect(text).toContain('Cacería');
      expect(text).not.toMatch(/oro|hábito/i);
    }
    expect(definition.effectLabel).not.toMatch(/oro|hábito/i);
    expect(FUSION_RELIC_DEFINITIONS.filter(item => item.ingredientIds.includes('relic_12')).map(item => item.effectLabel).join(' ')).toContain('Remate de papel');
  });

  it('solo cuenta equipado y las fusiones con el Puño lo heredan', () => {
    expect(equippedHuntEffects(owned(['relic_12'], 3)).finisherPercent).toBe(0);
    expect(equippedHuntEffects(equipRelic(owned(['relic_12'], 3), 'relic_12')).finisherPercent).toBe(20);
    const state = owned(['relic_12', 'relic_10'], 2);
    const fused = fuseRelics({ state, leftId: 'relic_12', rightId: 'relic_10', operationId: 'puno', randomValue: 0, nowTimestamp: 1 });
    expect(equippedHuntEffects(equipRelic(fused, 'fusion_40')).finisherPercent).toBe(15);
  });

  it('una fusión guardada con los antiguos valores de oro pasa a los porcentajes nuevos sin cambiar de rango', () => {
    const state = owned([]);
    state.inventory.relics.fusion_40 = {
      unlocked: true, rank: 3, rarity: 'legendary', affixes: [],
      inheritedEffects: { relic_12: 12, relic_10: 20 },
      ingredientSnapshots: { relic_12: { rank: 3, rarity: 'rare', affixes: [], effectValue: 12 }, relic_10: { rank: 3, rarity: 'rare', affixes: [], effectValue: 20 } },
    };
    state.inventory.equipped = ['fusion_40'];
    const saved = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(saved.inventory.relics.fusion_40).toMatchObject({ rank: 3, rarity: 'legendary' });
    expect(saved.inventory.relics.fusion_40.inheritedEffects.relic_12).toBe(20);
    expect(saved.inventory.relics.fusion_40.inheritedEffects.relic_10).toBe(20);
    expect(equippedHuntEffects(saved).finisherPercent).toBe(20);
  });

  it('remata cuando el ataque deja al enemigo en el umbral o por debajo, con una victoria única', () => {
    const plain = fight();
    const finisher = fight({ effects: { finisherPercent: 20 } });
    expect(plain.rounds).toBe(5);
    expect(finisher.rounds).toBe(4);
    expect(finisher.won).toBe(true);
    expect(finisher.finisherDamageDealt).toBe(20);
    expect(finisher.enemyHp).toBe(0);
    expect(finisher.roundDetails.map(detail => detail.damageDealt)).toEqual([20, 20, 20, 40]);
    expect(finisher.log.filter(entry => entry.finisherDamage > 0)).toHaveLength(1);
  });

  it('respeta el umbral: 15 % de 100 son 15 y un enemigo con 20 de Vida no se remata', () => {
    const result = fight({ effects: { finisherPercent: 15 } });
    expect(result.finisherDamageDealt).toBe(0);
    expect(result.rounds).toBe(5);
    expect(fight({ effects: { finisherPercent: 10 }, enemy: { maxHp: 50 } }).finisherDamageDealt).toBe(0);
  });

  it('un fallo no remata aunque el enemigo ya esté bajo el umbral', () => {
    const roll = (() => { const sequence = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.1]; let index = 0; return () => (index < sequence.length ? sequence[index++] : 0.9); })();
    const result = fight({ effects: { finisherPercent: 20 }, enemy: { dodgeChance: 0.5 }, roll, rounds: 8 });
    expect(result.log.filter(entry => entry.actor === 'hero')[3]).toMatchObject({ dodged: true, damage: 0 });
    expect(result.won).toBe(true);
    expect(result.finisherDamageDealt).toBeGreaterThan(0);
    expect(result.rounds).toBe(5);
  });

  it('funciona con ataques físicos y mágicos y mata antes de que actúen el eco o la marca', () => {
    for (const attackType of ['physical', 'magic']) {
      const result = fight({ attackType, effects: { finisherPercent: 20, echoPercent: 50, markPercent: 50 } });
      expect(result.won).toBe(true);
      expect(result.enemyHp).toBe(0);
      expect(result.log.at(-1).actor).toBe('hero');
      expect(result.roundDetails.reduce((total, detail) => total + detail.damageDealt, 0)).toBe(100);
    }
  });

  it('el remate no cura: el vampirismo solo cuenta el daño del golpe', () => {
    const result = fight({ effects: { finisherPercent: 20, vampirism: 50 }, heroHp: 10 });
    expect(result.finisherDamageDealt).toBe(20);
    expect(result.vampirismRecovered).toBe(40);
  });

  it('en una Cacería completa cada enemigo tiene su propio remate y el informe lo registra', () => {
    const begun = startHunt({
      hunt: {}, difficultyId: 'easy', level: 30, nowTimestamp: 1000, seed: 5, currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100,
      relicEffects: { finisherPercent: 20 },
    });
    const at = 1000 + 6 * 3600 * 1000;
    const report = resolveHunt({ hunt: JSON.parse(JSON.stringify(begun.hunt)), classId: 'knight', level: 30, nowTimestamp: at }).report;
    const none = resolveHunt({ hunt: startHunt({ hunt: {}, difficultyId: 'easy', level: 30, nowTimestamp: 1000, seed: 5, currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100 }).hunt, classId: 'knight', level: 30, nowTimestamp: at }).report;
    expect(report.won).toBe(true);
    expect(report.encounters.filter(encounter => encounter.finisherDamageDealt > 0).length).toBeGreaterThanOrEqual(1);
    expect(report.encounters.reduce((total, encounter) => total + encounter.rounds, 0))
      .toBeLessThanOrEqual(none.encounters.reduce((total, encounter) => total + encounter.rounds, 0));
  });
});
