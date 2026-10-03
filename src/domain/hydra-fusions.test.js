import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
  FUSION_RELIC_DEFINITIONS, HYDRA_COMBAT_BONUS_BY_RANK, fusionDefinition, hydraXpPercents, relicCombatBonuses, relicDefinition, relicRankEffect,
} from '../data/loot-data.js';
import { relicEffectCopy } from '../ui/relic-effect-copy.js';
import {
  emptyLootState, equipRelic, equippedHuntEffects, equippedRelicBonuses, fuseRelics, fusionRecipeStatus, getForgeFusionPreview, normalizeLootState,
} from './loot-rules.js';
import { rollHalloweenHuntCandy } from './halloween-candy-rules.js';
import { resolveHunt, simulatePveCombat, startHunt } from './pve-combat-rules.js';

const NEW_IDS = Array.from({ length: 8 }, (_, index) => `fusion_${43 + index}`);
const OTHER = { fusion_43: 'relic_01', fusion_44: 'relic_02', fusion_45: 'relic_05', fusion_46: 'relic_06', fusion_47: 'relic_07', fusion_48: 'relic_08', fusion_49: 'relic_09', fusion_50: 'relic_12', fusion_39: 'relic_10' };

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

function expedition(effects = {}, { difficultyId = 'easy', level = 50, bonuses = { physicalAttack: 10000 }, currentHp = 50, currentMana = 20 } = {}) {
  const begun = startHunt({ hunt: {}, difficultyId, level, nowTimestamp: 1000, seed: 5,
    currentHp, maxHp: 100, currentMana, maxMana: 100,
    relicEffects: effects, relicBonuses: bonuses, bonusDayKey: '2026-10-03' });
  expect(begun.ok).toBe(true);
  return resolveHunt({ hunt: JSON.parse(JSON.stringify(begun.hunt)), classId: 'knight', level, nowTimestamp: 1000 + 6 * 3600 * 1000 }).report;
}

describe('Hydra: Gargantilla de las Tres Fauces', () => {
  it('es de la familia de experiencia y ya no habla de hábitos', () => {
    const definition = relicDefinition('relic_11');
    expect(definition.effectFamily).toBe('experience');
    expect(definition.effectLabel).toContain('Tres Fauces');
    expect(definition.effectLabel).not.toMatch(/hábito/i);
    for (const rank of [1, 2, 3]) {
      const text = JSON.stringify(relicEffectCopy(definition, { rank }));
      expect(text).toContain('Tres Fauces');
      expect(text).not.toMatch(/hábito/i);
    }
  });

  it.each([[1, [3, 6, 10]], [2, [6, 10, 15]], [3, [10, 15, 20]]])('rango %i da %j % de XP base al 1.º, 2.º y 3.er enemigo', (rank, percents) => {
    expect(hydraXpPercents(relicRankEffect('relic_11', rank))).toEqual(percents);
    const state = equipRelic(ownedState(['relic_11'], rank), 'relic_11');
    const effects = equippedHuntEffects(state);
    expect([effects.hydraXpFirst, effects.hydraXpSecond, effects.hydraXpThird]).toEqual(percents);
  });

  it('solo funciona equipada', () => {
    const effects = equippedHuntEffects(ownedState(['relic_11'], 3));
    expect([effects.hydraXpFirst, effects.hydraXpSecond, effects.hydraXpThird]).toEqual([0, 0, 0]);
  });

  it.each([[1, 5], [2, 6], [3, 7]])('rango %i suma Ataque, Poder y Defensa +%i', (rank, value) => {
    expect(HYDRA_COMBAT_BONUS_BY_RANK[rank]).toBe(value);
    expect(relicCombatBonuses('relic_11', rank)).toEqual([
      { stat: 'physicalAttack', value }, { stat: 'magicAttack', value }, { stat: 'defense', value },
    ]);
    const state = equipRelic(ownedState(['relic_11'], rank), 'relic_11');
    expect(equippedRelicBonuses(state)).toMatchObject({ physicalAttack: value, magicAttack: value, defense: value });
  });

  it('aplica cada porcentaje solo a la XP base de su enemigo y no al total', () => {
    const base = expedition();
    const boosted = expedition({ hydraXpFirst: 10, hydraXpSecond: 15, hydraXpThird: 20 });
    const baseXp = base.encounters.map(encounter => encounter.rewards.xp);
    expect(boosted.encounters.map(encounter => encounter.hydraXpPercent)).toEqual([10, 15, 20]);
    expect(boosted.encounters.map(encounter => encounter.hydraXp)).toEqual(baseXp.map((xp, index) => Math.round(xp * [10, 15, 20][index] / 100)));
    expect(boosted.rewards.hydraXp).toBe(boosted.encounters.reduce((total, encounter) => total + encounter.hydraXp, 0));
    expect(boosted.rewards.xp - base.rewards.xp).toBe(boosted.rewards.hydraXp);
    const wrongTotalBased = Math.round(base.rewards.xp * (10 + 15 + 20) / 100);
    expect(boosted.rewards.hydraXp).not.toBe(wrongTotalBased);
  });

  it('se reinicia en cada Cacería y no concede nada sin el efecto', () => {
    const effects = { hydraXpFirst: 6, hydraXpSecond: 10, hydraXpThird: 15 };
    const first = expedition(effects);
    const second = expedition(effects);
    expect(second.rewards.hydraXp).toBe(first.rewards.hydraXp);
    expect(second.encounters.map(encounter => encounter.hydraXp)).toEqual(first.encounters.map(encounter => encounter.hydraXp));
    expect(expedition().rewards.hydraXp).toBe(0);
  });

  it('solo premia a los enemigos derrotados cuando el héroe pierde', () => {
    const effects = { hydraXpFirst: 10, hydraXpSecond: 15, hydraXpThird: 20 };
    const report = expedition(effects, { difficultyId: 'hard', level: 14, bonuses: {}, currentHp: 5, currentMana: 0 });
    expect(report.encounters.some(encounter => !encounter.won)).toBe(true);
    for (const encounter of report.encounters) {
      if (!encounter.won) expect(encounter.hydraXp).toBe(0);
    }
    expect(report.rewards.hydraXp).toBe(report.encounters.reduce((total, encounter) => total + encounter.hydraXp, 0));
  });

  it('la Chuche de Experiencia no multiplica la XP de Tres Fauces', () => {
    const report = { id: 'hydra-candy', difficultyId: 'hard', halloweenCandy: { experience: true }, encounters: [{ won: true }, { won: true }, { won: true }], rewards: { xp: 120, hydraXp: 20 } };
    const rolled = rollHalloweenHuntCandy({ candy: null, report, active: true, random: () => 0.99 });
    expect(rolled.xpBonus).toBe(Math.round((120 - 20) * 0.5));
  });
});

describe('Compatibilidad de familias', () => {
  it.each(['relic_03', 'relic_04'])('Hydra no se puede fusionar con %s ni en la receta ni al ejecutar', (other) => {
    expect(relicDefinition(other).effectFamily).toBe('experience');
    expect(fusionRecipeStatus('relic_11', other).status).toBe('incompatible');
    expect(fusionRecipeStatus(other, 'relic_11').status).toBe('incompatible');
    const state = ownedState([other, 'relic_11']);
    expect(getForgeFusionPreview(state, other, 'relic_11').ok).toBe(false);
    const result = fuseRelics({ state, leftId: other, rightId: 'relic_11', operationId: `bad-${other}`, randomValue: 0, nowTimestamp: 1 });
    expect(result.ok).toBe(false);
    expect(result.inventory.relics.relic_11).toBeTruthy();
    expect(result.inventory.relics[other]).toBeTruthy();
  });

  it('las ocho fusiones nuevas y la 39 usan una sola receta cada una con la Hydra', () => {
    const withHydra = FUSION_RELIC_DEFINITIONS.filter(definition => definition.ingredientIds.includes('relic_11'));
    expect(withHydra.map(definition => definition.id).sort()).toEqual(['fusion_39', ...NEW_IDS].sort());
    expect(new Set(withHydra.map(definition => definition.ingredientIds.find(id => id !== 'relic_11'))).size).toBe(9);
    for (const definition of withHydra) {
      expect(fusionRecipeStatus(...definition.ingredientIds).definition.id).toBe(definition.id);
      expect(existsSync(new URL(`../../public/${definition.image}`, import.meta.url))).toBe(true);
    }
    expect(FUSION_RELIC_DEFINITIONS.filter(definition => definition.id === 'fusion_39')).toHaveLength(1);
    expect(fusionDefinition('fusion_39')).toMatchObject({ recipeId: 'fusion_recipe_39', ingredientIds: ['relic_11', 'relic_10'] });
  });

  it('no admite fusionadas ni la máscara temporal como ingredientes', () => {
    const state = ownedState(['relic_11', 'fusion_43', 'halloween-mask']);
    expect(fusionRecipeStatus('relic_11', 'fusion_43').definition).toBeNull();
    expect(fusionRecipeStatus('relic_11', 'halloween-mask').definition).toBeNull();
    expect(fuseRelics({ state, leftId: 'relic_11', rightId: 'fusion_43', operationId: 'x', randomValue: 0, nowTimestamp: 1 }).ok).toBe(false);
  });
});

describe('Fusiones de la Hydra', () => {
  it.each([...NEW_IDS, 'fusion_39'].flatMap(id => [1, 2, 3].map(rank => [id, rank])))('%s rango %i hereda Tres Fauces, el otro efecto y los atributos sin duplicarlos', (id, rank) => {
    const state = makeFusion(id, rank);
    const relic = state.inventory.relics[id];
    const definition = fusionDefinition(id);
    expect(relic.rank).toBe(rank);
    expect(relic.inheritedEffects.relic_11).toBe(relicRankEffect('relic_11', rank));
    expect(relic.inheritedEffects[OTHER[id]]).toBe(relicRankEffect(OTHER[id], rank));
    const effects = equippedHuntEffects(state);
    expect([effects.hydraXpFirst, effects.hydraXpSecond, effects.hydraXpThird]).toEqual(hydraXpPercents(relicRankEffect('relic_11', rank)));
    const expected = { physicalAttack: 0, magicAttack: 0, defense: 0 };
    for (const ingredientId of definition.ingredientIds) {
      for (const bonus of relicCombatBonuses(ingredientId, rank)) expected[bonus.stat] += bonus.value;
    }
    expect(equippedRelicBonuses(state)).toMatchObject(expected);
    expect(expected.physicalAttack).toBeGreaterThanOrEqual(HYDRA_COMBAT_BONUS_BY_RANK[rank]);
    const copy = relicEffectCopy(definition, relic);
    expect(copy).toHaveLength(3);
    expect(JSON.stringify(copy)).not.toMatch(/hábito completado|3 hábitos distintos/i);
  });

  it.each([
    ['fusion_39', 'miniFirstHitDamage', [2, 3, 4]],
    ['fusion_43', 'miniFirstHitShield', [1, 2, 3]],
    ['fusion_44', 'firstHitManaEach', [1, 2, 3]],
    ['fusion_45', 'miniVictoryMana', [2, 3, 4]],
    ['fusion_46', 'miniVictoryHealthFlat', [2, 3, 4]],
    ['fusion_47', 'miniVampirism', [1, 2, 3]],
    ['fusion_48', 'miniPetrification', [2, 3, 4]],
    ['fusion_49', 'miniArmor', [1, 2, 3]],
    ['fusion_50', 'firstHitDamageEach', [1, 2, 3]],
  ])('%s aporta %s %j y nada más de su sinergia', (id, key, values) => {
    for (const rank of [1, 2, 3]) {
      const effects = equippedHuntEffects(makeFusion(id, rank));
      expect(effects[key]).toBe(values[rank - 1]);
    }
    const effects = equippedHuntEffects(makeFusion(id, 3));
    expect(effects.maskBloodChance).toBe(0);
    expect(effects.miniVictoryXp).toBe(0);
    expect(effects.miniConstancyHit).toBe(0);
  });

  it('la 39 ya no depende de completar hábitos', () => {
    const effects = equippedHuntEffects(makeFusion('fusion_39', 2));
    expect(effects.miniFirstHitDamage).toBe(3);
    const report = expedition({ miniFirstHitDamage: 3 }, { bonuses: {}, level: 30 });
    expect(report.encounters.map(encounter => encounter.miniOpeningDamageDealt > 0)).toEqual([false, false, true]);
  });

  it('44 recupera maná con el primer ataque dañino de cada enemigo, una vez por enemigo', () => {
    const hero = { maxHp: 100, maxMana: 20, physicalAttack: 10, magicAttack: 10, defense: 0 };
    const enemy = { maxHp: 1000, physicalAttack: 10, defense: 0 };
    const fight = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 10, maxRounds: 4, roll: () => 0.99, relicEffects: { firstHitManaEach: 2 } });
    expect(fight.miniFirstHitManaRecovered).toBe(2);
    const capped = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 20, maxRounds: 4, roll: () => 0.99, relicEffects: { firstHitManaEach: 3 } });
    expect(capped.miniFirstHitManaRecovered).toBeLessThanOrEqual(2);
    const report = expedition({ firstHitManaEach: 3 }, { currentMana: 20, bonuses: {}, level: 30 });
    expect(report.encounters.filter(encounter => encounter.miniFirstHitManaRecovered > 0).length).toBeGreaterThan(1);
    expect(Math.max(...report.encounters.map(encounter => encounter.miniFirstHitManaRecovered))).toBeLessThanOrEqual(3);
  });

  it('50 suma daño extra una sola vez en el primer ataque dañino de cada enemigo', () => {
    const hero = { maxHp: 100, maxMana: 20, physicalAttack: 10, magicAttack: 10, defense: 0 };
    const enemy = { maxHp: 1000, physicalAttack: 10, defense: 0 };
    const base = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 10, maxRounds: 3, roll: () => 0.99 });
    const boosted = simulatePveCombat({ hero, enemy, heroHp: 50, heroMana: 10, maxRounds: 3, roll: () => 0.99, relicEffects: { firstHitDamageEach: 2 } });
    expect(boosted.miniOpeningDamageDealt).toBe(2);
    expect(boosted.enemyHp).toBe(base.enemyHp - 2);
    const report = expedition({ firstHitDamageEach: 1 }, { bonuses: {}, level: 30 });
    expect(report.encounters.map(encounter => encounter.miniOpeningDamageDealt)).toEqual([1, 1, 1]);
  });

  it('45 y 46 se activan una sola vez, con el minijefe derrotado, y respetan los máximos', () => {
    const effects = { miniVictoryMana: 4, miniVictoryHealthFlat: 4 };
    const report = expedition(effects, { difficultyId: 'hard', level: 30, bonuses: { physicalAttack: 40 }, currentHp: 100, currentMana: 100 });
    expect(report.encounters.every(encounter => encounter.won)).toBe(true);
    expect(report.encounters.map(encounter => encounter.miniVictoryManaRecovered)).toEqual([0, 0, 4]);
    expect(report.encounters.map(encounter => encounter.miniVictoryHealthRecovered)).toEqual([0, 0, 4]);
    expect(expedition({}, { difficultyId: 'hard', level: 30, bonuses: { physicalAttack: 40 }, currentHp: 100, currentMana: 100 })
      .encounters.map(encounter => encounter.miniVictoryHealthRecovered)).toEqual([0, 0, 0]);
    const unhurt = expedition(effects, { difficultyId: 'hard', level: 30, bonuses: { physicalAttack: 80 }, currentHp: 100, currentMana: 100 });
    expect(unhurt.encounters[2].miniVictoryHealthRecovered).toBe(0);
    const dead = expedition(effects, { difficultyId: 'hard', level: 14, bonuses: {}, currentHp: 1, currentMana: 0 });
    expect(dead.heroDied).toBe(true);
    expect(dead.encounters.every(encounter => encounter.miniVictoryHealthRecovered === 0 && encounter.miniVictoryManaRecovered === 0)).toBe(true);
  });

  it('43 reduce solo el primer golpe del minijefe que conecta y nunca a cero', () => {
    const none = expedition({});
    const shielded = expedition({ miniFirstHitShield: 3 });
    expect(shielded.encounters[0].miniFirstHitShieldPrevented).toBe(0);
    expect(shielded.encounters[1].miniFirstHitShieldPrevented).toBe(0);
    expect(shielded.encounters[2].miniFirstHitShieldPrevented).toBeLessThanOrEqual(3);
    expect(shielded.encounters[2].damageTaken).toBeGreaterThanOrEqual(0);
    expect(none.encounters[2].miniFirstHitShieldPrevented).toBe(0);
  });
});

describe('Compatibilidad con partidas existentes', () => {
  it('una Gargantilla y una fusión 39 antiguas conservan rango, equipo e inventario con los nuevos valores', () => {
    const state = ownedState(['relic_01', 'relic_10']);
    state.inventory.relics.relic_11 = { unlocked: true, rank: 2, rarity: 'legendary', affixes: ['vitality'] };
    state.inventory.relics.fusion_39 = {
      unlocked: true, rank: 3, rarity: 'rare', affixes: [],
      inheritedEffects: { relic_11: 25, relic_10: 20 },
      ingredientSnapshots: { relic_11: { rank: 3, rarity: 'rare', affixes: [], effectValue: 25 }, relic_10: { rank: 3, rarity: 'rare', affixes: [], effectValue: 20 } },
    };
    state.inventory.equipped = ['fusion_39'];
    const normalized = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(normalized.inventory.relics.relic_11).toMatchObject({ rank: 2, rarity: 'legendary', affixes: ['vitality'] });
    expect(normalized.inventory.relics.relic_01.unlocked).toBe(true);
    expect(normalized.inventory.relics.fusion_39).toMatchObject({ rank: 3 });
    expect(normalized.inventory.relics.fusion_39.inheritedEffects.relic_11).toBe(10);
    expect(normalized.inventory.relics.fusion_39.inheritedEffects.relic_10).toBe(20);
    expect(normalized.inventory.equipped).toEqual(['fusion_39']);
    const effects = equippedHuntEffects(normalized);
    expect([effects.hydraXpFirst, effects.hydraXpSecond, effects.hydraXpThird]).toEqual([10, 15, 20]);
    expect(effects.miniFirstHitDamage).toBe(4);
    const stats = equippedRelicBonuses(normalized);
    expect(stats.physicalAttack).toBeGreaterThanOrEqual(7);
    expect(stats.magicAttack).toBeGreaterThanOrEqual(7);
    expect(stats.defense).toBeGreaterThanOrEqual(7);
  });
});
