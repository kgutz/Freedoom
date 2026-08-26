import { describe, expect, it } from 'vitest';
import {
  BRUMA_ENEMIES,
  fiberChanceForHunt,
  grantHabitHuntEnergy,
  HUNT_DIFFICULTIES,
  normalizeHuntState,
  pveHeroStats,
  resolveHunt,
  resolvePveAttack,
  revokeHabitHuntEnergy,
  simulatePveCombat,
  startHunt,
} from './pve-combat-rules.js';

describe('PvE combat rules', () => {
  it('transforma los atributos en estadísticas exclusivas del PvE', () => {
    const hero = pveHeroStats({ classId: 'knight', level: 2, allocation: { constitution: 3 } });
    expect(hero.maxHp).toBe(142);
    expect(hero.physicalAttack).toBe(20);
    expect(hero.magicAttack).toBe(10);
    expect(hero.criticalChance).toBeCloseTo(0.06);
    expect(hero.dodgeChance).toBeCloseTo(0.01);
  });

  it('aplica defensa y crítico con un mínimo de un punto de daño', () => {
    const rolls = [0.9, 0.01];
    const hit = resolvePveAttack({
      attacker: { physicalAttack: 10, criticalChance: 0.1 },
      defender: { defense: 30, dodgeChance: 0 },
      roll: () => rolls.shift(),
    });
    expect(hit).toEqual({ damage: 1, critical: true, dodged: false });
  });

  it('resuelve un combate completo de forma reproducible', () => {
    const hero = pveHeroStats({ classId: 'knight', level: 8, allocation: { strength: 12, defense: 6, constitution: 3 } });
    const result = simulatePveCombat({ hero, enemy: BRUMA_ENEMIES[0], roll: () => 0.99 });
    expect(result.won).toBe(true);
    expect(result.enemyHp).toBe(0);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.heroMana).toBeLessThan(hero.maxMana);
  });

  it('entra con la vida y el maná actuales y conserva el desgaste en el informe', () => {
    const now = 20_000;
    const started = startHunt({
      hunt: null,
      difficultyId: 'easy',
      level: 20,
      currentHp: 50,
      maxHp: 100,
      currentMana: 20,
      maxMana: 100,
      nowTimestamp: now,
      seed: 8,
    });
    expect(started.hunt.active).toMatchObject({ entryHpRatio: 0.5, entryManaRatio: 0.2 });
    const result = resolveHunt({
      hunt: started.hunt,
      classId: 'knight',
      level: 20,
      allocation: { strength: 20, defense: 15, constitution: 10 },
      nowTimestamp: now + HUNT_DIFFICULTIES.easy.durationMinutes * 60_000,
    });
    expect(result.report.heroHp).toBeLessThanOrEqual(Math.round(result.report.heroMaxHp * 0.5));
    expect(result.report.heroMana).toBeLessThan(Math.round(result.report.heroMaxMana * 0.2));
  });

  it('deriva el estilo de combate de los cinco atributos del enemigo', () => {
    expect(BRUMA_ENEMIES[0].attributes).toEqual({ strength: 3, defense: 3, dexterity: 4, power: 1, constitution: 4 });
    expect(BRUMA_ENEMIES[0].attackType).toBe('physical');
    expect(BRUMA_ENEMIES[1].attackType).toBe('magic');
    expect(BRUMA_ENEMIES[2].maxHp).toBeGreaterThan(BRUMA_ENEMIES[1].maxHp);
  });

  it('incluye un pequeño lore para cada monstruo de la región', () => {
    expect(BRUMA_ENEMIES).toHaveLength(3);
    BRUMA_ENEMIES.forEach((enemy) => expect(enemy.lore.length).toBeGreaterThan(60));
  });

  it('escala la fibra arcana con la dificultad', () => {
    expect(HUNT_DIFFICULTIES.easy).toMatchObject({ fiberChance: 0.25, fiberAmount: [1, 1] });
    expect(HUNT_DIFFICULTIES.medium).toMatchObject({ fiberChance: 0.5, fiberAmount: [1, 1] });
    expect(HUNT_DIFFICULTIES.hard).toMatchObject({ fiberChance: 0.7, fiberAmount: [1, 2] });
  });

  it('reduce seis puntos la probabilidad por cada drop del día y reinicia al día siguiente', () => {
    const today = new Date(2026, 7, 25, 12).getTime();
    const yesterday = new Date(2026, 7, 24, 12).getTime();
    const hunt = {
      energyDay: '2026-08-25',
      energy: 2,
      history: [
        { completedAt: yesterday, rewards: { arcaneFibers: 1 } },
        { completedAt: today, rewards: { arcaneFibers: 1 } },
        { completedAt: today, rewards: { arcaneFibers: 2 } },
      ],
    };
    expect(fiberChanceForHunt({ hunt, difficultyId: 'easy', nowTimestamp: today })).toBeCloseTo(0.13);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'medium', nowTimestamp: today })).toBeCloseTo(0.38);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'hard', nowTimestamp: today })).toBeCloseTo(0.58);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'easy', nowTimestamp: new Date(2026, 7, 26, 12).getTime() })).toBeCloseTo(0.25);
  });

  it('concede hasta dos energías extra con probabilidades de diez y ocho por ciento', () => {
    const first = grantHabitHuntEnergy({ hunt: null, rewardKey: 'habit-1', becameCompleted: true, roll: () => 0.09 });
    expect(first).toMatchObject({ granted: 1, chance: 0.1 });
    expect(first.hunt.energy).toBe(6);
    expect(first.hunt.bonusEnergyRemaining).toBe(1);
    const second = grantHabitHuntEnergy({ hunt: first.hunt, rewardKey: 'habit-2', becameCompleted: true, roll: () => 0.07 });
    expect(second).toMatchObject({ granted: 1, chance: 0.08 });
    expect(second.hunt.energy).toBe(7);
    expect(second.hunt.bonusEnergyRemaining).toBe(2);
    const capped = grantHabitHuntEnergy({ hunt: second.hunt, rewardKey: 'habit-3', becameCompleted: true, roll: () => 0 });
    expect(capped.granted).toBe(0);
    expect(capped.hunt.energy).toBe(7);
  });

  it('consume primero la carga extra sin ampliar permanentemente la energía base', () => {
    const rewarded = grantHabitHuntEnergy({ hunt: null, rewardKey: 'habit-1', becameCompleted: true, roll: () => 0 });
    const started = startHunt({ hunt: rewarded.hunt, difficultyId: 'easy', level: 3, nowTimestamp: Date.now() });
    expect(started.ok).toBe(true);
    expect(started.hunt).toMatchObject({ energy: 5, baseEnergy: 5, bonusEnergyEarned: 1, bonusEnergyRemaining: 0 });
  });

  it('migra una carga extra del formato anterior sin convertirla en capacidad permanente', () => {
    const nowTimestamp = new Date(2026, 7, 26, 12).getTime();
    const migrated = normalizeHuntState({
      energyDay: '2026-08-26',
      energy: 6,
      habitEnergyRolls: [{ key: 'habit-legacy', granted: 1 }],
    }, nowTimestamp);
    expect(migrated).toMatchObject({
      energy: 6,
      baseEnergy: 5,
      bonusEnergyEarned: 1,
      bonusEnergyRemaining: 1,
      bonusEnergyLedgerVersion: 1,
    });
    expect(migrated.habitEnergyRolls[0].status).toBe('available');
  });

  it('repara una carga borrada por la migración anterior cuando el premio sigue registrado', () => {
    const nowTimestamp = new Date(2026, 7, 26, 12).getTime();
    const repaired = normalizeHuntState({
      energyDay: '2026-08-26',
      energy: 5,
      bonusEnergyEarned: 0,
      bonusEnergyRemaining: 0,
      habitEnergyRolls: [{ key: 'habit-repair', granted: 1, status: 'spent' }],
    }, nowTimestamp);
    expect(repaired).toMatchObject({ energy: 6, bonusEnergyEarned: 1, bonusEnergyRemaining: 1 });
    expect(repaired.habitEnergyRolls[0].status).toBe('available');
  });

  it('no devuelve una carga que sí fue gastada con el nuevo registro', () => {
    const nowTimestamp = new Date(2026, 7, 26, 12).getTime();
    const spent = normalizeHuntState({
      energyDay: '2026-08-26',
      energy: 5,
      bonusEnergyEarned: 1,
      bonusEnergyRemaining: 0,
      bonusEnergyLedgerVersion: 1,
      habitEnergyRolls: [{ key: 'habit-spent', granted: 1, status: 'spent' }],
    }, nowTimestamp);
    expect(spent).toMatchObject({ energy: 5, bonusEnergyEarned: 1, bonusEnergyRemaining: 0 });
    expect(spent.habitEnergyRolls[0].status).toBe('spent');
  });

  it('retira la energía extra al deshacer el hábito y la restaura sin repetir el sorteo', () => {
    const rewarded = grantHabitHuntEnergy({ hunt: null, rewardKey: 'habit-1', becameCompleted: true, roll: () => 0 });
    const revoked = revokeHabitHuntEnergy({ hunt: rewarded.hunt, rewardKey: 'habit-1', becameIncomplete: true });
    expect(revoked).toMatchObject({ revoked: 1 });
    expect(revoked.hunt).toMatchObject({ energy: 5, bonusEnergyRemaining: 0 });
    expect(revoked.hunt.habitEnergyRolls[0].status).toBe('revoked');

    const restored = grantHabitHuntEnergy({ hunt: revoked.hunt, rewardKey: 'habit-1', becameCompleted: true, roll: () => 0.99 });
    expect(restored).toMatchObject({ granted: 1 });
    expect(restored.hunt).toMatchObject({ energy: 6, bonusEnergyRemaining: 1 });

    const spent = startHunt({ hunt: restored.hunt, difficultyId: 'easy', level: 3 });
    const cannotRevokeSpent = revokeHabitHuntEnergy({ hunt: spent.hunt, rewardKey: 'habit-1', becameIncomplete: true });
    expect(cannotRevokeSpent).toMatchObject({ revoked: 0 });
    expect(cannotRevokeSpent.hunt.energy).toBe(5);
  });

  it('aplica una duración de uno, tres o cinco minutos según la dificultad', () => {
    expect(HUNT_DIFFICULTIES.easy.durationMinutes).toBe(1);
    expect(HUNT_DIFFICULTIES.medium.durationMinutes).toBe(3);
    expect(HUNT_DIFFICULTIES.hard.durationMinutes).toBe(5);
    const started = startHunt({ hunt: null, difficultyId: 'medium', level: 7, nowTimestamp: 1_000, seed: 17 });
    expect(started.ok).toBe(true);
    expect(started.hunt.energy).toBe(3);
    expect(started.hunt.active.endsAt).toBe(1_000 + 3 * 60_000);
    const pending = resolveHunt({ hunt: started.hunt, classId: 'knight', level: 8, allocation: {}, nowTimestamp: 2_000 });
    expect(pending.reason).toBe('hunt-in-progress');
  });

  it('bloquea cada dificultad hasta alcanzar su nivel mínimo', () => {
    const blocked = startHunt({ hunt: null, difficultyId: 'hard', level: 11, nowTimestamp: 1_000 });
    expect(blocked).toMatchObject({ ok: false, reason: 'level-locked', requiredLevel: 12 });
  });

  it('restaura la energía al cambiar el día y conserva el historial', () => {
    const previous = normalizeHuntState({ energyDay: '2026-01-01', energy: 0, history: [{ id: 'old' }] }, new Date(2026, 0, 2, 12).getTime());
    expect(previous.energy).toBe(5);
    expect(previous.history).toHaveLength(1);
  });

  it('admite una recarga diaria penalizada de dos energías', () => {
    const nextDay = new Date(2026, 0, 2, 12).getTime();
    const normalized = normalizeHuntState({ energyDay: '2026-01-01', energy: 0 }, nextDay, 2);
    expect(normalized).toMatchObject({ energy: 2, baseEnergy: 2, bonusEnergyEarned: 0 });
  });

  it('resuelve el trío fijo y produce un informe persistible', () => {
    const now = 10_000;
    const started = startHunt({ hunt: null, difficultyId: 'easy', level: 20, nowTimestamp: now, seed: 8 });
    const result = resolveHunt({
      hunt: started.hunt,
      classId: 'knight',
      level: 20,
      allocation: { strength: 20, defense: 15, constitution: 10 },
      nowTimestamp: now + HUNT_DIFFICULTIES.easy.durationMinutes * 60_000,
    });
    expect(result.ok).toBe(true);
    expect(result.report.encounters).toHaveLength(3);
    expect(result.report.won).toBe(true);
    expect(result.report.rewards.xp).toBe(5);
    expect(result.report.encounters.map((encounter) => encounter.rewards.xp).reduce((a, b) => a + b, 0)).toBe(5);
    expect(result.report.encounters[0].rewards.arcaneFibers).toBe(0);
    expect(result.report.encounters[1].rewards.arcaneFibers).toBe(0);
    expect(result.hunt.active).toBeNull();
    expect(result.hunt.history).toHaveLength(1);
  });
});
