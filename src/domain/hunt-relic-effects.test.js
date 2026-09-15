import { describe, expect, it } from 'vitest';
import { FUSION_RELIC_DEFINITIONS, relicRankEffect } from '../data/loot-data.js';
import { simulatePveCombat, startHunt, resolveHunt } from './pve-combat-rules.js';
import { emptyLootState, normalizeLootState, fuseRelics, defuseRelic, equipRelic, equippedHuntEffects, equippedRelicBonuses, chargeFirstHabitVampirism, consumeHuntCharges, activateRelicConstancy, syncRelicConstancy } from './loot-rules.js';
import { collarFirstHabitFusionBonuses, markFusionDaily, markDailyEffectSources, availableDailyEffectSources } from './loot-rules.js';

const hero = { maxHp: 100, maxMana: 100, physicalAttack: 10, magicAttack: 10, defense: 0 };
const enemy = { maxHp: 100, physicalAttack: 10, defense: 0 };
const fight = options => simulatePveCombat({ hero, enemy, heroHp: 50, roll: () => 0.99, ...options });
function fusion(left, rank = 1) {
  const state = emptyLootState();
  state.economy.coins = 10000; state.economy.bossBlood = 100;
  for (const id of [left, 'relic_07']) state.inventory.relics[id] = { unlocked: true, rank, rarity: 'mythic', affixes: ['vitality', 'fortune'] };
  return fuseRelics({ state, leftId: left, rightId: 'relic_07', operationId: 'make', randomValue: 0, nowTimestamp: 1 });
}
function hunt(effects = {}, entry = {}) {
  const started = startHunt({ hunt: {}, difficultyId: 'easy', level: 50, nowTimestamp: 1000, seed: 5, currentHp: 50, maxHp: 100, currentMana: 20, maxMana: 100, relicEffects: effects, relicBonuses: { physicalAttack: 10000 }, ...entry });
  expect(started.ok).toBe(true);
  return resolveHunt({ hunt: JSON.parse(JSON.stringify(started.hunt)), classId: 'knight', level: 50, nowTimestamp: 61000 });
}

describe('Cacería: efectos principales de reliquias', () => {
  it.each(['physical', 'magic'])('cura daño real %s, nunca el sobre-daño', attackType => {
    const result = fight({ hero: { ...hero, physicalAttack: 1000, magicAttack: 1000 }, enemy: { ...enemy, maxHp: 20 }, attackType, relicEffects: { vampirism: 5 } });
    expect(result.heroHp).toBe(51);
    expect(result.vampirismRecovered).toBe(1);
    expect(result.roundDetails[0].damageDealt).toBe(20);
  });
  it('acumula golpes pequeños y conserva centésimas al guardar entre encuentros', () => {
    const first = fight({ enemy: { ...enemy, maxHp: 10 }, relicEffects: { vampirism: 3 } });
    expect(first.vampirismCarry).toBe(30);
    const next = fight({ enemy: { ...enemy, maxHp: 30, physicalAttack: 1 }, relicEffects: { vampirism: 3 }, relicCarry: JSON.parse(JSON.stringify({ vampirism: first.vampirismCarry })) });
    expect(next.vampirismRecovered).toBe(1);
    expect(next.vampirismCarry).toBe(20);
  });
  it('descarta sobrecuración, no cura evasiones y no resucita', () => {
    expect(fight({ heroHp: 99, enemy: { ...enemy, maxHp: 10 }, relicEffects: { vampirism: 100 }, relicCarry: { vampirism: 90 } })).toMatchObject({ heroHp: 100, vampirismCarry: 0 });
    expect(fight({ maxRounds: 1, enemy: { ...enemy, dodgeChance: 1 }, relicEffects: { vampirism: 100 } }).vampirismRecovered).toBe(0);
    expect(fight({ heroHp: 0, relicEffects: { vampirism: 100 } })).toMatchObject({ heroHp: 0, won: false });
  });
  it.each([10, 15, 27])('Mirada reduce solo el primer golpe conectado un %i%%', petrification => {
    const result = fight({ maxRounds: 2, relicEffects: { petrification } });
    expect(result.roundDetails.map(r => r.damageTaken)).toEqual([Math.floor(10 * (100 - petrification) / 100), 10]);
  });
  it('Mirada se activa aunque el primer ataque falle; no se gasta al esquivar al enemigo', () => {
    const rolls = [0, 0, 0.99, 0.99, 0.99, 0.99];
    const result = fight({ hero: { ...hero, dodgeChance: 0.5 }, enemy: { ...enemy, dodgeChance: 0.5 }, maxRounds: 2, roll: () => rolls.shift() ?? 0.99, relicEffects: { petrification: 27 } });
    expect(result.roundDetails.map(r => r.damageTaken)).toEqual([0, 7]);
  });
  it.each([1, 2, 3])('recupera máximos por cada victoria de rango %i y no repite al reclamar', rank => {
    const percent = relicRankEffect('relic_06', rank);
    const result = hunt({ victoryHealth: percent, victoryMana: percent, manaFusion16: true });
    expect(result.report.defeatedEnemies).toBe(3);
    const expected = Math.floor(result.report.heroMaxHp * percent / 100);
    expect(result.report.encounters[0].relicRecovery.hp).toBe(expected);
    expect(result.report.encounters.every(e => e.relicRecovery.mana > 0)).toBe(true);
    expect(result.report.heroHp).toBeLessThanOrEqual(result.report.heroMaxHp);
    expect(result.report.heroMana).toBeLessThanOrEqual(result.report.heroMaxMana);
    expect(result.report.fusion16ManaRecovered).toBe(true);
    expect(resolveHunt({ hunt: result.hunt, nowTimestamp: 999999 }).reason).toBe('no-active-hunt');
  });
  it('suma la recuperación nueva a la propia, sin cambiarla', () => {
    const base = hunt(); const added = hunt({ victoryHealth: 5, victoryMana: 5 });
    const a = added.report.encounters[0], b = base.report.encounters[0];
    expect(a.nextHeroHp - b.nextHeroHp).toBe(a.relicRecovery.hp);
    expect(a.nextHeroMana - b.nextHeroMana).toBe(a.relicRecovery.mana);
  });
  it('no concede premio por enemigo al morir', () => {
    const result = hunt({ victoryHealth: 13, victoryMana: 13 }, { currentHp: 0 });
    expect(result.report.defeatedEnemies).toBe(0);
    expect(result.report.encounters[0].relicRecovery).toEqual({ hp: 0, mana: 0 });
    expect(result.report.heroHp).toBe(0);
  });
  it('la carga de Garra dura un encuentro; la del Yelmo dura los tres', () => {
    const base = hunt({ vampirism: 3 });
    const claw = hunt({ vampirism: 3, encounterBonus: 1 });
    const helm = hunt({ vampirism: 3, huntBonus: 1 });
    const healing = result => result.report.encounters.map(e => e.vampirismRecovered);
    expect(healing(claw)[0]).toBeGreaterThan(healing(base)[0]);
    expect(healing(helm)[1]).toBeGreaterThan(healing(claw)[1]);
  });
});

describe('Recetas, cargas y migraciones', () => {
  it.each([['relic_01', 'fusion_06'], ['relic_02', 'fusion_07']])('conserva el bonus propio de %s sin la XP heredada del Collar', (left, id) => {
    const state = equipRelic(fusion(left, 3), id);
    const bonuses = collarFirstHabitFusionBonuses(state, 'day');
    expect(bonuses).toEqual([[id, id === 'fusion_06' ? 'protected-first-habit-xp' : 'first-habit-mana-xp', 10]]);
    const used = markFusionDaily(state, ...[bonuses[0][0], bonuses[0][1], 'day', 10]);
    expect(collarFirstHabitFusionBonuses(used, 'day')).toEqual([]);
    const spent = markDailyEffectSources(state, left, 'day', availableDailyEffectSources(state, left, 'day'));
    expect(collarFirstHabitFusionBonuses(spent, 'day')).toEqual([]);
  });
  it('no carga Garra con el segundo hábito tras equiparla ni al desfusionar y volver a fabricar', () => {
    const first = chargeFirstHabitVampirism(fusion('relic_03'), 'day');
    const equipped = equipRelic(first, 'fusion_18');
    expect(equippedHuntEffects(chargeFirstHabitVampirism(equipped, 'day')).encounterBonus).toBe(0);
    const charged = chargeFirstHabitVampirism(equipped, 'tomorrow');
    delete charged.inventory.relics.fusion_18;
    expect(normalizeLootState(charged).inventory.huntCharges.fusion_18).toBe(false);
  });
  it.each([['relic_03', 'fusion_18'], ['relic_04', 'fusion_19']])('fusiona y deshace %s conservando rango, atributos y secundarios', (left, id) => {
    const created = fusion(left, 3);
    expect(created.ok).toBe(true);
    const equipped = equipRelic(created, id);
    expect(equipped.inventory.relics[id].affixes).toEqual(['vitality', 'fortune']);
    expect(equippedHuntEffects(equipped).vampirism).toBe(8);
    expect(equippedRelicBonuses(equipped).magicAttack).toBe(5);
    expect(equippedRelicBonuses(equipped)[left === 'relic_03' ? 'physicalAttack' : 'defense']).toBeGreaterThan(0);
    const restored = defuseRelic({ state: JSON.parse(JSON.stringify(equipped)), relicId: id, operationId: 'undo', nowTimestamp: 2 });
    expect(restored.ok).toBe(true);
    expect(restored.inventory.relics.relic_07).toMatchObject({ rank: 3, rarity: 'mythic', affixes: ['vitality', 'fortune'] });
  });
  it('Garra carga una vez al día, conserva la carga guardada y consume solo al salir equipada', () => {
    let state = chargeFirstHabitVampirism(equipRelic(fusion('relic_03'), 'fusion_18'), 'day');
    state = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(equippedHuntEffects(state).encounterBonus).toBe(1);
    state = consumeHuntCharges(state);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state, 'day')).encounterBonus).toBe(0);
    expect(equippedHuntEffects(chargeFirstHabitVampirism(state, 'tomorrow')).encounterBonus).toBe(1);
  });
  it('Constancia mantiene su XP y carga Yelmo una sola vez por ciclo', () => {
    const state = syncRelicConstancy(equipRelic(fusion('relic_04'), 'fusion_19'), { cycleId: 'week', outcomes: [], nowTimestamp: 1 });
    const args = { cycleId: 'week', outcomes: Array(6).fill('hit'), bossWon: true, nowTimestamp: 2 };
    const earned = activateRelicConstancy({ state, ...args });
    expect(earned.xp).toBe(20);
    expect(equippedHuntEffects(earned).huntBonus).toBe(1);
    const repeated = activateRelicConstancy({ state: consumeHuntCharges(earned), ...args });
    expect(repeated.xp).toBe(0);
    expect(equippedHuntEffects(repeated).huntBonus).toBe(0);
  });
  it('normaliza todas las fusiones afectadas sin restar XP histórica', () => {
    const state = emptyLootState();
    state.inventory.dailyActivations['relic_07:old'] = 7;
    for (const recipe of FUSION_RELIC_DEFINITIONS) {
      state.inventory.relics[recipe.id] = { rank: 3, rarity: 'legendary', affixes: ['vitality'], inheritedEffects: Object.fromEntries(recipe.ingredientIds.map(id => [id, 60])) };
    }
    const result = normalizeLootState(state);
    for (const recipe of FUSION_RELIC_DEFINITIONS) for (const id of recipe.ingredientIds.filter(id => ['relic_05', 'relic_06', 'relic_07'].includes(id))) {
      expect(result.inventory.relics[recipe.id].inheritedEffects[id]).toBe(relicRankEffect(id, 3));
    }
    expect(result.inventory.dailyActivations['relic_07:old']).toBe(7);
    expect(normalizeLootState(result)).toEqual(result);
  });
});
