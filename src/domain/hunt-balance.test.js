import { describe, expect, it } from 'vitest';
import { HUNT_BALANCE_TUNING } from '../data/hunt-balance-data.js';
import {
  HUNT_ENCOUNTER_RECOVERY, HUNT_REGIONS, HUNT_VICTORY_RECOVERY,
  huntDifficultyForRegion, recoverHuntEncounterHealth, scaledEnemy, startHunt, resolveHunt,
} from './pve-combat-rules.js';

describe('gradual hunt recovery', () => {
  it.each([[0, 0], [1, 16], [20, 35], [50, 65], [60, 70], [70, 70], [85, 85], [100, 100]])(
    '%i HP recovers to %i, without reviving or lowering high health', (hp, expected) => {
      expect(recoverHuntEncounterHealth(hp, 100)).toBe(expected);
    },
  );
  it('rounds one fixed gain and leaves mana and exit recovery unchanged', () => {
    expect(recoverHuntEncounterHealth(10, 123)).toBe(28);
    expect(HUNT_ENCOUNTER_RECOVERY).toEqual({ hpPercent: 0.15, hpCapPercent: 0.7, manaPercent: 0.15, manaCapPercent: 0.6 });
    expect(HUNT_VICTORY_RECOVERY).toEqual({ hpPercent: 0.25, hpCapPercent: 0.8, manaPercent: 0.15, manaCapPercent: 0.6 });
  });
  it('adds relic healing after the base recovery; it can exceed the base cap', () => {
    const start = startHunt({ level: 50, difficultyId: 'easy', currentHp: 50, maxHp: 100,
      relicBonuses: { physicalAttack: 10000 }, relicEffects: { victoryHealth: 13 }, nowTimestamp: 1000, seed: 8 });
    const result = resolveHunt({ hunt: start.hunt, classId: 'knight', level: 50, nowTimestamp: 61000 });
    const report = result.report;
    for (const fight of report.encounters.slice(0, 2)) {
      expect(fight.nextHeroHp).toBe(recoverHuntEncounterHealth(fight.heroHp, report.heroMaxHp) + fight.relicRecovery.hp);
    }
    expect(report.encounters[1].nextHeroHp).toBeGreaterThan(Math.round(report.heroMaxHp * 0.7));
    expect(report.heroHp).toBeLessThanOrEqual(report.heroMaxHp);
  });
  it('preserves damage accumulated in earlier encounters', () => {
    expect(recoverHuntEncounterHealth(20, 100)).toBeLessThan(recoverHuntEncounterHealth(50, 100));
    expect(recoverHuntEncounterHealth(20, 100)).toBeLessThan(70);
  });
});

describe('fixed regional tuning', () => {
  it('keeps the tested Hard hit thresholds without class-dependent rules', () => {
    const bunker = HUNT_REGIONS['dead-hours-bunker'];
    const peaks = HUNT_REGIONS['nuncabasta-peaks'];
    const bunkerEnemies = bunker.enemies.map(e => scaledEnemy(e, huntDifficultyForRegion(bunker.id, 'hard')));
    expect(bunkerEnemies[0].maxHp).toBeLessThanOrEqual(62);
    expect(bunkerEnemies[1].maxHp).toBeLessThanOrEqual(62 * 2);
    expect(bunkerEnemies[2].maxHp).toBeLessThanOrEqual(62 * 5);
    expect(bunkerEnemies[2].maxHp).toBeGreaterThan(125 * 2);
    const soldier = scaledEnemy(peaks.enemies[0], huntDifficultyForRegion(peaks.id, 'hard'));
    expect(soldier.maxHp).toBeGreaterThan(169);
    expect(soldier.maxHp).toBeLessThanOrEqual(86 * 2);
    for (const region of Object.values(HUNT_REGIONS)) {
      expect(scaledEnemy(region.enemies[0], huntDifficultyForRegion(region.id, 'hard')).huntRendPercent).toBe(30);
    }
  });
  const entry = { 'fields-of-mist': [1, 5, 11], 'dead-hours-bunker': [13, 17, 22], 'nuncabasta-peaks': [25, 29, 34] };
  for (const region of Object.values(HUNT_REGIONS)) for (const [i, id] of ['easy', 'medium', 'hard'].entries()) {
    it(`${region.id}/${id}: tunes only enemy combat stats, preserving access/rewards`, () => {
      const difficulty = huntDifficultyForRegion(region.id, id);
      expect(difficulty.minLevel).toBe(entry[region.id][i]);
      expect(difficulty.energyCost).toBe(i + (region.id === 'fields-of-mist' ? 1 : 3));
      expect(difficulty.enemyStatMultipliers).toBe(HUNT_BALANCE_TUNING[region.id][id]);
      for (const enemy of region.enemies) {
        const original = scaledEnemy(enemy, { ...difficulty, enemyStatMultipliers: undefined });
        const current = scaledEnemy(enemy, difficulty);
        const tuning = difficulty.enemyStatMultipliers[enemy.id] || difficulty.enemyStatMultipliers.all;
        expect(current.maxHp).toBe(Math.round(original.maxHp * tuning.hp));
        expect(current.physicalAttack).toBe(Math.round(original.physicalAttack * tuning.attack));
        expect(current.magicAttack).toBe(Math.round(original.magicAttack * tuning.attack));
        expect(current.defense).toBe(original.defense * tuning.defense);
        expect(current.criticalChance).toBe(original.criticalChance);
        expect(current.dodgeChance).toBe(original.dodgeChance);
      }
    });
  }
});
