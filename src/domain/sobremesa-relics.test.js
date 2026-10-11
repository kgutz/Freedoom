import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  BOSS_REWARDS, FUSION_RELIC_DEFINITIONS, MAX_INITIAL_RELICS, RELIC_DEFINITIONS, fusionDefinition,
  relicCombatBonuses, relicDefinition, relicRankEffect,
} from '../data/loot-data.js';
import {
  emptyLootState, equipRelic, equippedHuntEffects, equippedRelicBonuses, fuseRelics, fusionRecipeStatus,
  grantBossRewards, normalizeLootState,
} from './loot-rules.js';
import { relicEffectCopy } from '../ui/relic-effect-copy.js';
import { rollHalloweenHuntCandy } from './halloween-candy-rules.js';
import {
  pveHeroStats, resolveHunt, simulatePveCombat, startHunt,
} from './pve-combat-rules.js';

const HERO = { maxHp: 100, maxMana: 20, physicalAttack: 20, magicAttack: 20, defense: 0, criticalChance: 0, dodgeChance: 0 };
const ENEMY = { maxHp: 1000, physicalAttack: 10, magicAttack: 0, defense: 0, dodgeChance: 0, criticalChance: 0, attackType: 'physical' };

/* Sin esquivas ni críticos: roll fijo. `sequence` fuerza las primeras tiradas y luego repite 0.9. */
function rolls(sequence = []) {
  let index = 0;
  return () => (index < sequence.length ? sequence[index++] : 0.9);
}

function fight({ attackType = 'magic', effects = {}, rounds = 2, hero = {}, enemy = {}, heroHp = 100, heroMana = 10, roll = () => 0.5 } = {}) {
  return simulatePveCombat({
    hero: { ...HERO, ...hero },
    enemy: { ...ENEMY, ...enemy },
    heroHp, heroMana, attackType, roll, maxRounds: rounds, relicEffects: effects,
  });
}

function ownedState(ids, rank = 1) {
  const state = emptyLootState();
  state.economy.coins = 10000;
  state.economy.bossBlood = 100;
  for (const id of ids) state.inventory.relics[id] = { unlocked: true, rank, rarity: 'rare', affixes: [] };
  return state;
}

function makeFusion(id, rank = 1) {
  const definition = fusionDefinition(id);
  const state = ownedState(definition.ingredientIds, rank);
  const result = fuseRelics({ state, leftId: definition.ingredientIds[0], rightId: definition.ingredientIds[1], operationId: `make-${id}`, randomValue: 0, nowTimestamp: 1 });
  expect(result.ok).toBe(true);
  return equipRelic(result, id);
}

function expedition(classId, effects = {}, { difficultyId = 'easy', bonuses = {}, hp = 100, mana = 100 } = {}) {
  const begun = startHunt({
    hunt: {}, regionId: 'fields-of-mist', difficultyId, level: 30, nowTimestamp: 1000, seed: 5,
    currentHp: hp, maxHp: 100, currentMana: mana, maxMana: 100,
    relicEffects: effects, relicBonuses: bonuses, bonusDayKey: '2026-10-11',
  });
  expect(begun.ok).toBe(true);
  return resolveHunt({ hunt: JSON.parse(JSON.stringify(begun.hunt)), classId, level: 30, nowTimestamp: 1000 + 6 * 3600 * 1000 }).report;
}

const SOBREMESA_IDS = Array.from({ length: 12 }, (_, index) => `fusion_${51 + index}`);
const OTHERS = ['relic_01', 'relic_02', 'relic_03', 'relic_04', 'relic_05', 'relic_06', 'relic_07', 'relic_08', 'relic_09', 'relic_10', 'relic_11', 'relic_12'];

describe('Reliquias 13, 14 y 15: catálogo, rangos y atributos', () => {
  it('existen tras el jefe 12, con su arte, su familia propia y rangos 10/15/20 %', () => {
    expect(MAX_INITIAL_RELICS).toBe(15);
    expect(RELIC_DEFINITIONS.map(definition => definition.id).slice(12)).toEqual(['relic_13', 'relic_14', 'relic_15']);
    const expected = { relic_13: ['magic-echo', 12], relic_14: ['physical-mark', 13], relic_15: ['impact-bastion', 14] };
    for (const [id, [family, bossIndex]] of Object.entries(expected)) {
      const definition = relicDefinition(id);
      expect(definition).toMatchObject({ effectFamily: family, bossIndex, rewardId: `boss_reward_${bossIndex + 1}` });
      expect(existsSync(new URL(`../../public/${definition.image}`, import.meta.url))).toBe(true);
      expect([1, 2, 3].map(rank => relicRankEffect(id, rank))).toEqual([10, 15, 20]);
    }
  });

  it.each([[1, 0], [2, 1], [3, 2]])('rango %i: Poder y Constitución del báculo, Ataque y Destreza del brazal, Defensa y Constitución de la hebilla', (rank, offset) => {
    expect(relicCombatBonuses('relic_13', rank)).toEqual([{ stat: 'magicAttack', value: 7 + offset }, { stat: 'constitution', value: 3 + offset }]);
    expect(relicCombatBonuses('relic_14', rank)).toEqual([{ stat: 'physicalAttack', value: 7 + offset }, { stat: 'dexterity', value: 3 + offset }]);
    expect(relicCombatBonuses('relic_15', rank)).toEqual([{ stat: 'defense', value: 7 + offset }, { stat: 'constitution', value: 3 + offset }]);
    const equipped = id => equippedRelicBonuses(equipRelic(ownedState([id], rank), id));
    expect(equipped('relic_13')).toMatchObject({ magicAttack: 7 + offset, constitution: 3 + offset, physicalAttack: 0, defense: 0, dexterity: 0 });
    expect(equipped('relic_14')).toMatchObject({ physicalAttack: 7 + offset, dexterity: 3 + offset, magicAttack: 0, constitution: 0 });
    expect(equipped('relic_15')).toMatchObject({ defense: 7 + offset, constitution: 3 + offset });
  });

  it('solo aportan atributos mientras están equipadas y los retiran al desequipar', () => {
    const state = ownedState(['relic_13'], 3);
    expect(equippedRelicBonuses(state)).toMatchObject({ magicAttack: 0, constitution: 0 });
    expect(equippedRelicBonuses(equipRelic(state, 'relic_13'))).toMatchObject({ magicAttack: 9, constitution: 5 });
  });

  it('Constitución y Destreza son puntos efectivos de Cacería: no entran en el reparto permanente', () => {
    const allocation = { constitution: 10, dexterity: 4 };
    const plain = pveHeroStats({ classId: 'sorcerer', level: 20, allocation });
    const boosted = pveHeroStats({ classId: 'sorcerer', level: 20, allocation, relicBonuses: { constitution: 5, dexterity: 3, magicAttack: 9 } });
    expect(boosted.maxHp).toBe(plain.maxHp + 5 * 6);
    expect(boosted.criticalChance).toBeCloseTo(plain.criticalChance + 3 * 0.004);
    expect(boosted.dodgeChance).toBeCloseTo(plain.dodgeChance + 3 * 0.002);
    expect(boosted.magicAttack).toBe(plain.magicAttack + 9);
    expect(allocation).toEqual({ constitution: 10, dexterity: 4 });
    expect(pveHeroStats({ classId: 'sorcerer', level: 20, allocation, relicBonuses: {} }).maxHp).toBe(plain.maxHp);
  });

  it('equipar y desequipar no concede curaciones: la Vida de entrada se conserva como proporción', () => {
    const ratios = [0, 5].map((constitution) => {
      const begun = startHunt({
        hunt: {}, difficultyId: 'easy', level: 30, nowTimestamp: 1000, seed: 5,
        currentHp: 40, maxHp: 100, currentMana: 100, maxMana: 100, relicBonuses: { constitution },
      });
      const report = resolveHunt({ hunt: begun.hunt, classId: 'sorcerer', level: 30, nowTimestamp: 1000 + 6 * 3600 * 1000 }).report;
      return report.encounters[0].heroHpAtStart / report.heroMaxHp;
    });
    expect(ratios[0]).toBeCloseTo(0.4, 1);
    expect(ratios[1]).toBeCloseTo(0.4, 1);
  });
});

describe('Eco de Sobremesa (relic_13)', () => {
  it.each([[10, 2], [15, 3], [20, 4]])('un eco del %i %% de 20 de daño real hace %i y llega al terminar el turno', (percent, expected) => {
    const result = fight({ effects: { echoPercent: percent }, rounds: 1 });
    expect(result.echoDamageDealt).toBe(expected);
    expect(result.enemyHp).toBe(1000 - 20 - expected);
    const order = result.log.map(entry => entry.actor);
    expect(order).toEqual(['hero', 'enemy', 'echo']);
    expect(result.roundDetails[0].damageDealt).toBe(20 + expected);
  });

  it('solo se prepara con el primer ataque mágico: un ataque físico no lo activa', () => {
    expect(fight({ attackType: 'physical', effects: { echoPercent: 20 }, rounds: 3 }).echoDamageDealt).toBe(0);
    expect(fight({ attackType: 'magic', effects: { echoPercent: 0 }, rounds: 3 }).echoDamageDealt).toBe(0);
  });

  it('es una sola vez por enemigo y el eco no genera otro eco', () => {
    const result = fight({ effects: { echoPercent: 20 }, rounds: 4 });
    expect(result.echoDamageDealt).toBe(4);
    expect(result.log.filter(entry => entry.actor === 'echo')).toHaveLength(1);
  });

  it('un fallo no consume la activación: el eco se prepara con el primer ataque que daña', () => {
    const result = fight({ effects: { echoPercent: 10 }, rounds: 2, enemy: { dodgeChance: 0.5 }, roll: rolls([0.1, 0.9, 0.9]) });
    expect(result.log[0]).toMatchObject({ actor: 'hero', dodged: true, damage: 0 });
    expect(result.echoDamageDealt).toBe(2);
    expect(result.log.findIndex(entry => entry.actor === 'echo')).toBeGreaterThan(3);
    expect(result.enemyHp).toBe(1000 - 20 - 2);
  });

  it('usa el daño real resuelto, limitado a la vida que pierde el enemigo, y no mitiga el eco', () => {
    const critical = fight({ effects: { echoPercent: 10 }, rounds: 1, hero: { criticalChance: 1 } });
    expect(critical.log[0].damage).toBe(32);
    expect(critical.echoDamageDealt).toBe(3);
    const armored = fight({ effects: { echoPercent: 50 }, rounds: 1, enemy: { defense: 100 } });
    expect(armored.log[0].damage).toBe(Math.max(1, 20 - 65));
    expect(armored.echoDamageDealt).toBe(1);
    const limited = fight({ effects: { echoPercent: 50 }, rounds: 1, enemy: { maxHp: 25 } });
    expect(limited.log[0].damage).toBe(20);
    expect(limited.echoDamageDealt).toBe(Math.min(5, 10));
    const tiny = fight({ effects: { echoPercent: 10 }, rounds: 1, hero: { magicAttack: 3 } });
    expect(tiny.echoDamageDealt).toBe(1);
  });

  it('no paga Maná, no crítica, no activa vampirismo y no cura', () => {
    const result = fight({ effects: { echoPercent: 10, vampirism: 10 }, rounds: 1, heroHp: 50, hero: { criticalChance: 1 } });
    expect(result.heroMana).toBe(8);
    expect(result.vampirismRecovered).toBe(3);
    expect(result.heroHp).toBe(50 + 3 - 10);
    expect(result.echoDamageDealt).toBe(3);
  });

  it('si el ataque original mata al enemigo no hay eco ni golpe a un cadáver', () => {
    const result = fight({ effects: { echoPercent: 50 }, rounds: 3, enemy: { maxHp: 15 } });
    expect(result.won).toBe(true);
    expect(result.echoDamageDealt).toBe(0);
    expect(result.damageTaken).toBe(0);
    expect(result.log.some(entry => entry.actor === 'echo')).toBe(false);
  });

  it('si el eco mata al enemigo, la victoria se resuelve una sola vez', () => {
    const result = fight({ effects: { echoPercent: 50 }, rounds: 5, enemy: { maxHp: 25 } });
    expect(result.won).toBe(true);
    expect(result.enemyHp).toBe(0);
    expect(result.rounds).toBe(1);
    expect(result.echoDamageDealt).toBe(5);
  });

  it('un eco pendiente no actúa si el héroe cae ese turno', () => {
    const result = fight({ effects: { echoPercent: 50 }, rounds: 3, heroHp: 5 });
    expect(result.won).toBe(false);
    expect(result.heroHp).toBe(0);
    expect(result.echoDamageDealt).toBe(0);
    expect(result.enemyHp).toBe(980);
  });

  it('en una Cacería completa los contadores son por enemigo y no se reinician al recargar', () => {
    const effects = { echoPercent: 10 };
    const begun = startHunt({ hunt: {}, difficultyId: 'easy', level: 30, nowTimestamp: 1000, seed: 5, currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100, relicEffects: effects });
    const saved = JSON.parse(JSON.stringify(begun.hunt));
    const at = 1000 + 6 * 3600 * 1000;
    const first = resolveHunt({ hunt: saved, classId: 'sorcerer', level: 30, nowTimestamp: at }).report;
    const reloaded = resolveHunt({ hunt: JSON.parse(JSON.stringify(saved)), classId: 'sorcerer', level: 30, nowTimestamp: at }).report;
    expect(reloaded).toEqual(first);
    expect(first.encounters.map(encounter => encounter.echoDamageDealt > 0)).toEqual([true, true, true]);
    expect(first.encounters.every(encounter => encounter.echoDamageDealt <= 4)).toBe(true);
  });
});

describe('Filo del Espejismo (relic_14)', () => {
  it.each([[10, 2], [15, 3], [20, 4]])('marca con el primer golpe y el segundo añade el %i %% (%i) del daño del primero', (percent, extra) => {
    const result = fight({ attackType: 'physical', effects: { markPercent: percent }, rounds: 4 });
    expect(result.markDamageDealt).toBe(extra);
    expect(result.enemyHp).toBe(1000 - 20 * 4 - extra);
    expect(result.roundDetails.map(detail => detail.damageDealt)).toEqual([20, 20 + extra, 20, 20]);
  });

  it('los ataques mágicos ni la preparan ni la consumen', () => {
    const result = fight({ attackType: 'magic', effects: { markPercent: 20 }, rounds: 4 });
    expect(result.markDamageDealt).toBe(0);
    expect(result.enemyHp).toBe(1000 - 20 * 4);
  });

  it('un fallo no consume la marca: se consume con el siguiente ataque que conecta', () => {
    const result = fight({ attackType: 'physical', effects: { markPercent: 10 }, rounds: 3, enemy: { dodgeChance: 0.5 }, roll: rolls([0.9, 0.9, 0.9, 0.9, 0.1, 0.9, 0.9]) });
    expect(result.roundDetails.map(detail => detail.damageDealt)).toEqual([20, 0, 22]);
    expect(result.markDamageDealt).toBe(2);
  });

  it('la base es el primer ataque y no el segundo', () => {
    const result = fight({ attackType: 'physical', effects: { markPercent: 10 }, rounds: 2, hero: { criticalChance: 0.5 }, roll: rolls([0.9, 0.9, 0.9, 0.9, 0.9, 0.1]) });
    expect(result.log[0].damage).toBe(20);
    expect(result.log[2].damage).toBe(32);
    expect(result.markDamageDealt).toBe(2);
  });

  it('el daño adicional no hace crítico, no activa vampirismo y cura solo por el golpe normal', () => {
    const result = fight({ attackType: 'physical', effects: { markPercent: 20, vampirism: 10 }, rounds: 2, heroHp: 10, hero: { criticalChance: 0 } });
    expect(result.markDamageDealt).toBe(4);
    expect(result.vampirismRecovered).toBe(4);
  });

  it('si el enemigo muere antes, la marca desaparece; si el daño extra remata, hay una sola victoria', () => {
    const early = fight({ attackType: 'physical', effects: { markPercent: 50 }, rounds: 5, enemy: { maxHp: 38 } });
    expect(early.won).toBe(true);
    expect(early.markDamageDealt).toBe(0);
    const lethal = fight({ attackType: 'physical', effects: { markPercent: 50 }, rounds: 5, enemy: { maxHp: 41 } });
    expect(lethal.won).toBe(true);
    expect(lethal.markDamageDealt).toBe(1);
    expect(lethal.enemyHp).toBe(0);
    expect(lethal.rounds).toBe(2);
  });

  it('en una Cacería cada enemigo tiene su propia marca', () => {
    const report = expedition('knight', { markPercent: 20 });
    expect(report.encounters.map(encounter => encounter.markDamageDealt > 0)).toEqual([true, true, true]);
  });
});

describe('Bastión del Laberinto (relic_15)', () => {
  it.each([[10, 9], [15, 8], [20, 8]])('con %i %% el tercer golpe de 10 baja a %i, una sola vez', (percent, reduced) => {
    const result = fight({ attackType: 'physical', effects: { bastionPercent: percent }, rounds: 6 });
    expect(result.damageTaken).toBe(10 * 5 + reduced);
    expect(result.bastionPrevented).toBe(10 - reduced);
    expect(result.log.filter(entry => entry.bastionPrevented > 0)).toHaveLength(1);
  });

  it('los golpes esquivados no cuentan para la carga', () => {
    const sequence = [0.9, 0.9, 0.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
    const result = fight({ attackType: 'physical', effects: { bastionPercent: 20 }, rounds: 5, hero: { dodgeChance: 0.5 }, roll: rolls(sequence) });
    expect(result.log.filter(entry => entry.actor === 'enemy').map(entry => entry.damage)).toEqual([0, 10, 0, 10, 8]);
    expect(result.bastionPrevented).toBe(2);
  });

  it('un impacto que otra reducción deja en 0 cuenta como impacto recibido', () => {
    const result = fight({ attackType: 'physical', effects: { bastionPercent: 20, petrification: 100 }, rounds: 3 });
    expect(result.log.filter(entry => entry.actor === 'enemy').map(entry => entry.damage)).toEqual([0, 10, 8]);
    expect(result.bastionPrevented).toBe(2);
  });

  it('combinado con Escamas y otras defensas nunca baja de 1 en un golpe con daño', () => {
    const result = fight({ attackType: 'physical', effects: { bastionPercent: 100, damageReduction: 50 }, rounds: 4 });
    expect(result.log.filter(entry => entry.actor === 'enemy').map(entry => entry.damage)).toEqual([5, 5, 1, 5]);
    const weak = fight({ attackType: 'physical', effects: { bastionPercent: 100 }, rounds: 4, enemy: { physicalAttack: 1 } });
    expect(weak.log.filter(entry => entry.actor === 'enemy').every(entry => entry.damage === 1)).toBe(true);
    expect(weak.bastionPrevented).toBe(0);
  });

  it('la preparación no pasa al siguiente enemigo de la Cacería', () => {
    const report = expedition('knight', { bastionPercent: 20 });
    const per = report.encounters.map(encounter => encounter.bastionPrevented);
    expect(per.filter(value => value > 0).length).toBeGreaterThanOrEqual(2);
    expect(report.encounters[0].rounds).toBeLessThan(report.encounters[1].rounds);
  });
});

describe('Recetas, familias y atributos de las fusiones 51-62', () => {
  const EXPECTED = {
    fusion_51: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], defense: [1, 2, 3] },
    fusion_52: { magicAttack: [8, 10, 12], constitution: [3, 4, 5] },
    fusion_53: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], physicalAttack: [1, 2, 3] },
    fusion_54: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], defense: [2, 3, 4] },
    fusion_55: { magicAttack: [9, 11, 13], constitution: [3, 4, 5] },
    fusion_56: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], physicalAttack: [2, 3, 4] },
    fusion_57: { magicAttack: [10, 12, 14], constitution: [3, 4, 5] },
    fusion_58: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], physicalAttack: [3, 4, 5] },
    fusion_59: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], defense: [3, 4, 5] },
    fusion_60: { magicAttack: [11, 13, 15], constitution: [3, 4, 5] },
    fusion_61: { magicAttack: [12, 14, 16], constitution: [3, 4, 5], physicalAttack: [5, 6, 7], defense: [5, 6, 7] },
    fusion_62: { magicAttack: [7, 8, 9], constitution: [3, 4, 5], physicalAttack: [4, 5, 6] },
  };

  it('hay una receta por reliquia base 01-12, sin duplicar, con arte y numeración libre', () => {
    const recipes = FUSION_RELIC_DEFINITIONS.filter(definition => definition.ingredientIds.includes('relic_13'));
    expect(recipes.map(definition => definition.id)).toEqual(SOBREMESA_IDS);
    expect(recipes.map(definition => definition.recipeId)).toEqual(SOBREMESA_IDS.map(id => id.replace('fusion_', 'fusion_recipe_')));
    expect(recipes.map(definition => definition.ingredientIds.find(id => id !== 'relic_13'))).toEqual(OTHERS);
    expect(new Set(FUSION_RELIC_DEFINITIONS.map(definition => definition.id)).size).toBe(FUSION_RELIC_DEFINITIONS.length);
    expect(new Set(FUSION_RELIC_DEFINITIONS.map(definition => definition.recipeId)).size).toBe(FUSION_RELIC_DEFINITIONS.length);
    for (const definition of recipes) {
      expect(fusionRecipeStatus(...definition.ingredientIds).definition.id).toBe(definition.id);
      expect(fusionRecipeStatus(...[...definition.ingredientIds].reverse()).definition.id).toBe(definition.id);
      expect(existsSync(new URL(`../../public/${definition.image}`, import.meta.url))).toBe(true);
    }
  });

  it('el Djinn y el Minotauro no tienen fusiones todavía y las fusionadas no sirven de ingrediente', () => {
    for (const other of OTHERS) {
      expect(fusionRecipeStatus('relic_14', other).status).toBe('not-designed');
      expect(fusionRecipeStatus('relic_15', other).status).toBe('not-designed');
    }
    expect(fusionRecipeStatus('relic_13', 'fusion_51').definition).toBeNull();
    expect(fusionRecipeStatus('relic_13', 'halloween-mask').definition).toBeNull();
  });

  it.each(SOBREMESA_IDS.flatMap(id => [1, 2, 3].map(rank => [id, rank])))('%s R%i deriva los atributos de ambos ingredientes', (id, rank) => {
    const state = makeFusion(id, rank);
    const bonuses = equippedRelicBonuses(state);
    for (const [stat, values] of Object.entries(EXPECTED[id])) expect(bonuses[stat]).toBe(values[rank - 1]);
    const effects = equippedHuntEffects(state);
    expect(effects.echoPercent).toBe(10 + (rank - 1) * 5);
    const rows = relicEffectCopy(fusionDefinition(id), state.inventory.relics[id]);
    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('relic_13');
  });

  it('las fusiones comparten familia con ambos ingredientes y no se equipan junto a ellos', () => {
    const state = ownedState(['relic_13', 'relic_14', 'relic_15', 'relic_02']);
    const withFusion = makeFusion('fusion_52');
    for (const id of ['relic_13', 'relic_02']) withFusion.inventory.relics[id] = { unlocked: true, rank: 1, rarity: 'rare', affixes: [] };
    expect(equipRelic(withFusion, 'relic_13').reason).toBe('effect-family-conflict');
    expect(equipRelic(withFusion, 'relic_02').reason).toBe('effect-family-conflict');
    let combined = equipRelic(state, 'relic_13');
    combined = equipRelic(combined, 'relic_14');
    expect(combined.inventory.equipped).toEqual(['relic_13', 'relic_14']);
    expect(equipRelic(ownedState(['relic_13', 'relic_15']), 'relic_13').ok).toBe(true);
  });

  it('una fusión equipada hereda el efecto principal de ambos ingredientes', () => {
    const effects = equippedHuntEffects(makeFusion('fusion_57', 2));
    expect(effects.echoPercent).toBe(15);
    expect(effects.vampirism).toBe(5);
    expect(effects.echoVampirism).toBe(2);
    expect(equippedHuntEffects(makeFusion('fusion_59', 3))).toMatchObject({ echoPercent: 20, damageReduction: 12, echoArmor: 3 });
    expect(equippedHuntEffects(makeFusion('fusion_61', 1))).toMatchObject({ echoPercent: 10, hydraXpFirst: 3, echoThirdDamage: 2 });
  });

  it('el bonus de cada fusión explica su valor real, la condición y el alcance', () => {
    for (const rank of [1, 2, 3]) {
      for (const id of SOBREMESA_IDS) {
        const definition = fusionDefinition(id);
        const state = makeFusion(id, rank);
        const copy = relicEffectCopy(definition, state.inventory.relics[id]).at(-1).description;
        expect(copy).toContain(String(definition.synergy.values[rank]));
        expect(copy.length).toBeLessThanOrEqual(220);
      }
    }
    const percentCopy = relicEffectCopy(fusionDefinition('fusion_57'), makeFusion('fusion_57', 2).inventory.relics.fusion_57).at(-1).description;
    expect(percentCopy).toContain('2 puntos porcentuales');
  });
});

describe('Sinergias de las fusiones 51-62', () => {
  it('51 reduce el siguiente golpe tras un eco, una sola vez y sin bajar de 1', () => {
    const result = fight({ effects: { echoPercent: 10, echoShield: 2 }, rounds: 3 });
    expect(result.log.filter(entry => entry.actor === 'enemy').map(entry => entry.damage)).toEqual([10, 8, 10]);
    expect(result.echoShieldPrevented).toBe(2);
    const weak = fight({ effects: { echoPercent: 10, echoShield: 3 }, rounds: 3, enemy: { physicalAttack: 1 } });
    expect(weak.echoShieldPrevented).toBe(0);
    expect(fight({ effects: { echoPercent: 0, echoShield: 2 }, rounds: 3 }).echoShieldPrevented).toBe(0);
  });

  it('52 recupera Maná con el primer ataque mágico que daña, sin exigir que sobreviva el enemigo', () => {
    expect(fight({ effects: { echoPercent: 10, echoFirstHitMana: 3 }, rounds: 1 }).heroMana).toBe(10 - 2 + 3);
    expect(fight({ effects: { echoPercent: 10, echoFirstHitMana: 3 }, rounds: 3 }).heroMana).toBe(10 - 6 + 3);
    expect(fight({ effects: { echoPercent: 10, echoFirstHitMana: 3 }, rounds: 3, enemy: { maxHp: 15 } }).echoFirstHitManaRecovered).toBe(3);
    expect(fight({ attackType: 'physical', effects: { echoPercent: 10, echoFirstHitMana: 3 }, rounds: 1 }).heroMana).toBe(8);
    expect(fight({ effects: { echoPercent: 10, echoFirstHitMana: 3 }, rounds: 1, heroMana: 20 }).heroMana).toBe(20);
  });

  it('53 concede XP fija solo la primera vez que un eco daña en la Cacería, y no cuenta como XP base', () => {
    const report = expedition('sorcerer', { echoPercent: 10, echoFirstXp: 3 });
    expect(report.encounters.map(encounter => encounter.echoXp)).toEqual([3, 0, 0]);
    expect(report.rewards.echoXp).toBe(3);
    const plain = expedition('sorcerer', { echoPercent: 10 });
    expect(report.rewards.xp).toBe(plain.rewards.xp + 3);
    const withoutXp = rollHalloweenHuntCandy({ report: { ...plain, rewards: { ...plain.rewards } }, active: true, random: () => 0 });
    const withXp = rollHalloweenHuntCandy({ report: { ...report, rewards: { ...report.rewards } }, active: true, random: () => 0 });
    expect(JSON.stringify(withXp)).toBe(JSON.stringify(withoutXp));
  });

  it('54 solo aplica contra el minijefe y exige Constancia cargada al iniciar sin consumirla', () => {
    const base = expedition('sorcerer', { echoPercent: 10 });
    const boosted = expedition('sorcerer', { echoPercent: 10, echoMiniDamage: 4 });
    expect(boosted.encounters.map(encounter => encounter.echoDamageDealt - base.encounters[boosted.encounters.indexOf(encounter)].echoDamageDealt)).toEqual([0, 0, 4]);
    const state = makeFusion('fusion_54', 2);
    state.inventory.constancy = { ...state.inventory.constancy, charge: 5 };
    expect(equippedHuntEffects(state).echoMiniDamage).toBe(0);
    state.inventory.constancy = { ...state.inventory.constancy, charge: 6 };
    const before = JSON.stringify(state.inventory.constancy);
    expect(equippedHuntEffects(state).echoMiniDamage).toBe(3);
    expect(JSON.stringify(state.inventory.constancy)).toBe(before);
  });

  it('55 y 56 recuperan Maná y Vida al derrotar a un enemigo ya dañado por el eco, una vez, sin superar máximos', () => {
    const effects = { echoPercent: 10, echoDefeatMana: 3, echoDefeatHealth: 4 };
    const byEcho = fight({ effects: { ...effects, echoPercent: 50 }, rounds: 3, enemy: { maxHp: 25 }, heroHp: 50 });
    expect(byEcho.won).toBe(true);
    expect(byEcho.echoDefeatManaRecovered).toBe(3);
    expect(byEcho.echoDefeatHealthRecovered).toBe(4);
    expect(byEcho.heroMana).toBe(10 - 2 + 3);
    expect(byEcho.heroHp).toBe(50 - 10 + 4);
    const later = fight({ effects, rounds: 6, enemy: { maxHp: 45 }, heroHp: 50 });
    expect(later.won).toBe(true);
    expect(later.echoDefeatManaRecovered).toBe(3);
    expect(later.echoDefeatHealthRecovered).toBe(4);
    const direct = fight({ effects, rounds: 3, enemy: { maxHp: 15 }, heroHp: 50 });
    expect(direct.echoDefeatManaRecovered + direct.echoDefeatHealthRecovered).toBe(0);
    const full = fight({ effects: { ...effects, echoPercent: 50 }, rounds: 3, enemy: { maxHp: 25 }, heroHp: 100, heroMana: 20 });
    expect(full.heroMana).toBeLessThanOrEqual(20);
    expect(full.heroHp).toBeLessThanOrEqual(100);
    expect(fight({ effects, rounds: 3, enemy: { maxHp: 45 }, heroHp: 5 }).echoDefeatHealthRecovered).toBe(0);
  });

  it('57 refuerza el vampirismo solo del ataque que prepara el eco', () => {
    const boosted = fight({ effects: { echoPercent: 10, echoVampirism: 5 }, rounds: 3, heroHp: 50 });
    expect(boosted.echoVampirismUsed).toBe(5);
    expect(boosted.vampirismRecovered).toBe(1);
    expect(fight({ attackType: 'physical', effects: { echoPercent: 10, echoVampirism: 5 }, rounds: 3, heroHp: 50 }).vampirismRecovered).toBe(0);
    expect(fight({ effects: { echoPercent: 0, echoVampirism: 5 }, rounds: 3, heroHp: 50 }).vampirismRecovered).toBe(0);
  });

  it('58 mejora la reducción de Mirada solo si el primer ataque que daña es mágico', () => {
    const effects = { petrification: 10, echoPercent: 10, echoPetrification: 3 };
    expect(fight({ effects, rounds: 1 }).log[1].damage).toBe(8);
    expect(fight({ attackType: 'physical', effects, rounds: 1 }).log[1].damage).toBe(9);
    expect(fight({ effects: { petrification: 10, echoPetrification: 3 }, rounds: 1 }).log[1].damage).toBe(9);
  });

  it('59 suma reducción de Escamas solo en el siguiente golpe tras un eco', () => {
    const result = fight({ effects: { damageReduction: 10, echoPercent: 10, echoArmor: 5 }, rounds: 3 });
    expect(result.log.filter(entry => entry.actor === 'enemy').map(entry => entry.damage)).toEqual([9, 8, 9]);
    expect(result.echoArmorBoostUsed).toBe(5);
  });

  it('60 concede oro al derrotar al minijefe tras dañarlo con un eco, una vez por Cacería', () => {
    const base = expedition('sorcerer', { echoPercent: 10 });
    const gold = expedition('sorcerer', { echoPercent: 10, echoMiniGold: 4 });
    expect(gold.encounters.map(encounter => encounter.echoMiniGold)).toEqual([0, 0, 4]);
    expect(gold.rewards.baseGold).toBe(base.rewards.baseGold + 4);
    const lost = expedition('sorcerer', { echoPercent: 10, echoMiniGold: 4 }, { hp: 1 });
    expect(lost.encounters.every(encounter => encounter.echoMiniGold === 0)).toBe(true);
  });

  it('61 aumenta el eco solo contra el tercer enemigo', () => {
    const base = expedition('sorcerer', { echoPercent: 10 });
    const third = expedition('sorcerer', { echoPercent: 10, echoThirdDamage: 3 });
    expect(third.encounters.map((encounter, index) => encounter.echoDamageDealt - base.encounters[index].echoDamageDealt)).toEqual([0, 0, 3]);
    expect(third.rewards.xp).toBe(base.rewards.xp);
  });

  it('62 aumenta solo el primer eco de la Cacería', () => {
    const base = expedition('sorcerer', { echoPercent: 10 });
    const habits = expedition('sorcerer', { echoPercent: 10, echoHabitsDamage: 2 });
    expect(habits.encounters.map((encounter, index) => encounter.echoDamageDealt - base.encounters[index].echoDamageDealt)).toEqual([2, 0, 0]);
    const state = makeFusion('fusion_62', 3);
    expect(equippedHuntEffects(state).echoHabitsDamage).toBe(4);
  });
});

describe('Recompensas de jefe, guardado y compatibilidad', () => {
  it('los jefes 13-15 entregan su reliquia con la tirada habitual, una sola vez', () => {
    expect(BOSS_REWARDS).toHaveLength(15);
    const first = grantBossRewards({ state: {}, bossesDown: 15, source: 'retroactive', seed: 'sobremesa', nowTimestamp: 1 });
    for (const id of ['relic_13', 'relic_14', 'relic_15']) expect(first.inventory.relics[id].unlocked).toBe(true);
    expect(first.rewards.map(reward => reward.bossIndex)).toEqual(Array.from({ length: 15 }, (_, index) => index));
    const again = grantBossRewards({ state: first, bossesDown: 15, source: 'retroactive', seed: 'otra', nowTimestamp: 2 });
    expect(again.rewards).toHaveLength(0);
    expect(again.economy.coins).toBe(first.economy.coins);
    expect(grantBossRewards({ state: {}, bossesDown: 12, source: 'retroactive', seed: 'x', nowTimestamp: 1 }).inventory.relics.relic_13).toBeUndefined();
  });

  it('una partida que ya reclamó los 12 primeros jefes no repite premios y solo suma los nuevos', () => {
    const old = grantBossRewards({ state: {}, bossesDown: 12, source: 'retroactive', seed: 'viejo', nowTimestamp: 1 });
    const coins = old.economy.coins;
    const next = grantBossRewards({ state: old, bossesDown: 13, source: 'victory', seed: 'nuevo', random: () => 0, nowTimestamp: 2 });
    expect(next.rewards.map(reward => reward.rewardId)).toEqual(['boss_reward_13']);
    expect(next.economy.coins).toBe(coins + BOSS_REWARDS[12].coins);
  });

  it('una fusión guardada conserva rango, rareza y equipo y recupera su herencia al normalizar', () => {
    const state = makeFusion('fusion_55', 3);
    state.inventory.relics.fusion_55.rarity = 'legendary';
    const saved = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(saved.inventory.relics.fusion_55).toMatchObject({ rank: 3, rarity: 'legendary' });
    expect(saved.inventory.relics.fusion_55.inheritedEffects).toEqual({ relic_13: 20, relic_05: 13 });
    expect(saved.inventory.equipped).toEqual(['fusion_55']);
    const stale = JSON.parse(JSON.stringify(state));
    stale.inventory.relics.fusion_55.inheritedEffects = { relic_13: 1, relic_05: 1 };
    expect(normalizeLootState(stale).inventory.relics.fusion_55.inheritedEffects).toEqual({ relic_13: 20, relic_05: 13 });
  });

  it('una Cacería iniciada antes de la actualización (sin claves nuevas) se resuelve igual', () => {
    const begun = startHunt({ hunt: {}, difficultyId: 'easy', level: 30, nowTimestamp: 1000, seed: 5, currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100 });
    const legacy = JSON.parse(JSON.stringify(begun.hunt));
    for (const key of ['echoPercent', 'markPercent', 'bastionPercent', 'echoShield']) delete legacy.active.relicEffects[key];
    delete legacy.active.relicBonuses.constitution;
    delete legacy.active.relicBonuses.dexterity;
    const report = resolveHunt({ hunt: legacy, classId: 'sorcerer', level: 30, nowTimestamp: 1000 + 6 * 3600 * 1000 }).report;
    expect(report.won).toBe(true);
    expect(report.encounters.every(encounter => encounter.echoDamageDealt === 0 && encounter.markDamageDealt === 0 && encounter.bastionPrevented === 0)).toBe(true);
  });
});
