import { describe, expect, it } from 'vitest';
import { relicCombatBonus, relicCombatBonuses } from '../data/loot-data.js';
import {
  BRUMA_ENEMIES,
  fiberChanceForHunt,
  fiberChanceForProgress,
  inkChanceForProgress,
  grantHabitHuntEnergy,
  grantRewardHuntEnergy,
  HUNT_DIFFICULTIES,
  HUNT_FORTUNE_BONUS_PERCENT,
  huntRecoveryRates,
  normalizeHuntState,
  pveHeroStats,
  resolveHunt,
  resolvePveAttack,
  revokeHabitHuntEnergy,
  simulatePveCombat,
  startHunt,
  syncHabitSetHuntEnergy,
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

  it('suma a la cacería el ataque, poder y defensa de las reliquias equipadas', () => {
    const base = pveHeroStats({ classId: 'knight', level: 2, allocation: {} });
    const boosted = pveHeroStats({
      classId: 'knight', level: 2, allocation: {},
      relicBonuses: { physicalAttack: 2, magicAttack: 3, defense: 1 },
    });
    expect(boosted.physicalAttack).toBe(base.physicalAttack + 2);
    expect(boosted.magicAttack).toBe(base.magicAttack + 3);
    expect(boosted.defense).toBe(base.defense + 1);
  });

  it('escala la estadística de reliquia con el jefe y con su rango', () => {
    expect(relicCombatBonus('relic_01', 1)).toEqual({ stat: 'defense', value: 1 });
    expect(relicCombatBonus('relic_04', 1)).toEqual({ stat: 'defense', value: 2 });
    expect(relicCombatBonus('relic_07', 1)).toEqual({ stat: 'magicAttack', value: 3 });
    expect(relicCombatBonus('relic_12', 1)).toEqual({ stat: 'physicalAttack', value: 4 });
    expect(relicCombatBonus('relic_12', 3)).toEqual({ stat: 'physicalAttack', value: 6 });
    expect(relicCombatBonus('fusion_08', 1)).toEqual({ stat: 'magicAttack', value: 3 });
  });

  it('una fusión hereda las estadísticas de Cacería y rangos de ambos ingredientes', () => {
    expect(relicCombatBonuses('fusion_04', 3, {
      relic_03: { rank: 1 },
      relic_05: { rank: 2 },
    })).toEqual([
      { stat: 'physicalAttack', value: 1 },
      { stat: 'magicAttack', value: 3 },
    ]);
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

  it('usa como máximo una poción de Vida y una de Maná por enemigo y registra cada ronda', () => {
    const result = simulatePveCombat({
      hero: {
        maxHp: 100,
        maxMana: 40,
        physicalAttack: 15,
        magicAttack: 15,
        defense: 0,
        criticalChance: 0,
        dodgeChance: 0,
      },
      enemy: {
        maxHp: 45,
        physicalAttack: 5,
        magicAttack: 5,
        defense: 0,
        criticalChance: 0,
        dodgeChance: 0,
        attackType: 'physical',
      },
      heroHp: 25,
      heroMana: 0,
      autoUsePotions: true,
      potions: { owned: { life: 2, mana: 2 } },
      roll: () => 0.99,
    });
    expect(result.won).toBe(true);
    expect(result.potions.owned).toMatchObject({ life: 1, mana: 1 });
    expect(result.potionUses.map((use) => use.type)).toEqual(['mana', 'life']);
    expect(result.roundDetails).toHaveLength(3);
    expect(result.roundDetails[0]).toMatchObject({ round: 1, damageDealt: 15, damageTaken: 5, heroHp: 40 });
    expect(result.damageTaken).toBe(10);
  });

  it('entra con la vida y el maná actuales y recupera parte de ambos al vencer', () => {
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
    expect(result.report.won).toBe(true);
    expect(result.report.encounters[0].heroHpAtStart).toBe(Math.round(result.report.heroMaxHp * 0.5));
    expect(result.report.heroHpBeforeRecovery).toBeLessThanOrEqual(Math.round(result.report.heroMaxHp * 0.8));
    expect(result.report.encounters[0].recoveryAfter.hp).toBeGreaterThan(0);
    expect(result.report.encounters[1].recoveryAfter.hp).toBeGreaterThan(0);
    expect(result.report.encounters[0].nextHeroHp).toBeGreaterThanOrEqual(Math.round(result.report.heroMaxHp * 0.7));
    expect(result.report.encounters[0].nextHeroMana).toBeGreaterThanOrEqual(result.report.encounters[0].heroMana);
    expect(result.report.heroHp).toBeGreaterThan(result.report.heroHpBeforeRecovery);
    expect(result.report.heroMana).toBeGreaterThan(result.report.heroManaBeforeRecovery);
    expect(result.report.heroHp).toBeLessThanOrEqual(Math.round(result.report.heroMaxHp * 0.8));
    expect(result.report.heroMana).toBeLessThanOrEqual(Math.round(result.report.heroMaxMana * 0.6));
    expect(result.report.recovery.hp).toBe(result.report.heroHp - result.report.heroHpBeforeRecovery);
    expect(result.report.recovery.mana).toBe(result.report.heroMana - result.report.heroManaBeforeRecovery);
  });

  it('marca la muerte y no aplica recuperación de salida tras caer después de un enemigo', () => {
    const now = 30_000;
    const started = startHunt({ hunt: null, difficultyId: 'hard', level: 12, nowTimestamp: now, seed: 8 });
    const result = resolveHunt({
      hunt: started.hunt,
      classId: 'sorcerer',
      level: 12,
      allocation: {},
      nowTimestamp: now + HUNT_DIFFICULTIES.hard.durationMinutes * 60_000,
    });
    expect(result.report.won).toBe(false);
    expect(result.report.heroDied).toBe(true);
    expect(result.report.defeatedEnemies).toBe(1);
    expect(result.report.recovery).toEqual({ hp: 0, mana: 0 });
    expect(result.report.heroHp).toBe(0);
    expect(result.report.heroMana).toBe(result.report.heroManaBeforeRecovery);
    expect(result.report.encounters[0].nextHeroHp).toBeGreaterThanOrEqual(Math.round(result.report.heroMaxHp * 0.7));
    expect(result.report.encounters[1].heroHpAtStart).toBe(result.report.encounters[0].nextHeroHp);
  });

  it('marca la muerte y reserva la recuperación completa para el renacer', () => {
    const now = 40_000;
    const started = startHunt({ hunt: null, difficultyId: 'hard', level: 12, nowTimestamp: now, seed: 34 });
    const result = resolveHunt({
      hunt: started.hunt,
      classId: 'sorcerer',
      level: 12,
      allocation: { power: 2 },
      nowTimestamp: now + HUNT_DIFFICULTIES.hard.durationMinutes * 60_000,
    });
    expect(result.report).toMatchObject({ won: false, heroDied: true, defeatedEnemies: 2 });
    expect(result.report.recovery.hp).toBe(0);
    expect(result.report.heroHp).toBe(0);
    expect(result.report.encounters[0].nextHeroHp).toBeGreaterThanOrEqual(Math.round(result.report.heroMaxHp * 0.7));
    expect(result.report.encounters[1].recoveryAfter.hp).toBeGreaterThan(0);
    expect(result.report.encounters[2].heroHpAtStart).toBe(result.report.encounters[1].nextHeroHp);
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
    expect(HUNT_DIFFICULTIES.easy).toMatchObject({ fiberChance: 0, fiberAmount: [0, 0] });
    expect(HUNT_DIFFICULTIES.medium).toMatchObject({ fiberChance: 0.3, fiberAmount: [1, 1] });
    expect(HUNT_DIFFICULTIES.hard).toMatchObject({ fiberChance: 0.7, fiberAmount: [1, 2] });
  });

  it('hace la tirada completa de Fibra al vencer al Líder aunque no caiga el Minijefe', () => {
    const now = new Date(2026, 7, 26, 12).getTime();
    expect(fiberChanceForProgress({ hunt: null, difficultyId: 'hard', defeatedEnemies: 1, nowTimestamp: now })).toBe(0);
    expect(fiberChanceForProgress({ hunt: null, difficultyId: 'easy', defeatedEnemies: 2, nowTimestamp: now })).toBe(0);
    expect(fiberChanceForProgress({ hunt: null, difficultyId: 'medium', defeatedEnemies: 2, nowTimestamp: now })).toBeCloseTo(0.3);
    expect(fiberChanceForProgress({ hunt: null, difficultyId: 'hard', defeatedEnemies: 2, nowTimestamp: now })).toBeCloseTo(0.7);
    expect(fiberChanceForProgress({ hunt: null, difficultyId: 'hard', defeatedEnemies: 3, nowTimestamp: now })).toBeCloseTo(0.7);
  });

  it('entrega Tinta solo desde el Líder en Medio o Difícil y reduce un 5% por drop diario', () => {
    const today = new Date(2026, 7, 26, 12).getTime();
    expect(inkChanceForProgress({ hunt: null, difficultyId: 'easy', defeatedEnemies: 3, nowTimestamp: today })).toBe(0);
    expect(inkChanceForProgress({ hunt: null, difficultyId: 'medium', defeatedEnemies: 1, nowTimestamp: today })).toBe(0);
    expect(inkChanceForProgress({ hunt: null, difficultyId: 'medium', defeatedEnemies: 2, nowTimestamp: today })).toBeCloseTo(0.25);
    expect(inkChanceForProgress({ hunt: null, difficultyId: 'hard', defeatedEnemies: 2, nowTimestamp: today })).toBeCloseTo(0.5);
    const hunt = { energyDay: '2026-08-26', energy: 2, history: [
      { completedAt: today, rewards: { arcaneInks: 1 } },
      { completedAt: today, rewards: { arcaneInks: 1 } },
    ] };
    expect(inkChanceForProgress({ hunt, difficultyId: 'medium', defeatedEnemies: 2, nowTimestamp: today })).toBeCloseTo(0.15);
    expect(inkChanceForProgress({ hunt, difficultyId: 'hard', defeatedEnemies: 2, nowTimestamp: today })).toBeCloseTo(0.4);
  });

  it('recupera vida y maná proporcionalmente a los enemigos vencidos', () => {
    expect(huntRecoveryRates(0)).toEqual({ hpPercent: 0, manaPercent: 0 });
    expect(huntRecoveryRates(1).hpPercent).toBeCloseTo(0.25 / 3);
    expect(huntRecoveryRates(1).manaPercent).toBeCloseTo(0.05);
    expect(huntRecoveryRates(2).hpPercent).toBeCloseTo(0.5 / 3);
    expect(huntRecoveryRates(2).manaPercent).toBeCloseTo(0.1);
    expect(huntRecoveryRates(3)).toEqual({ hpPercent: 0.25, manaPercent: 0.15 });
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
    expect(fiberChanceForHunt({ hunt, difficultyId: 'easy', nowTimestamp: today })).toBe(0);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'medium', nowTimestamp: today })).toBeCloseTo(0.18);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'hard', nowTimestamp: today })).toBeCloseTo(0.58);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'easy', nowTimestamp: new Date(2026, 7, 26, 12).getTime() })).toBe(0);
    expect(fiberChanceForHunt({ hunt, difficultyId: 'medium', nowTimestamp: new Date(2026, 7, 26, 12).getTime() })).toBeCloseTo(0.3);
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

  it('mantiene la energía de un regalo hasta que el jugador la consume', () => {
    const firstDay = new Date(2026, 7, 26, 12).getTime();
    const rewarded = grantRewardHuntEnergy({ hunt: null, amount: 2, nowTimestamp: firstDay });
    expect(rewarded.hunt).toMatchObject({ energy: 7, baseEnergy: 5, rewardEnergyRemaining: 2 });
    const nextDay = normalizeHuntState(rewarded.hunt, new Date(2026, 7, 27, 12).getTime());
    expect(nextDay).toMatchObject({ energy: 7, baseEnergy: 5, rewardEnergyRemaining: 2 });
    const started = startHunt({ hunt: nextDay, difficultyId: 'medium', level: 7, nowTimestamp: new Date(2026, 7, 27, 13).getTime() });
    expect(started.hunt).toMatchObject({ energy: 5, rewardEnergyRemaining: 0 });
  });

  it('premia las listas completas y limita la energía acumulada a diez', () => {
    const daily = syncHabitSetHuntEnergy({
      hunt: null, rewardKey: 'daily:2026-08-27', amount: 1, allCompleted: true,
    });
    expect(daily).toMatchObject({ granted: 1, revoked: 0 });
    expect(daily.hunt.energy).toBe(6);
    const weekly = syncHabitSetHuntEnergy({
      hunt: daily.hunt, rewardKey: 'weekly:2026-W35', amount: 2, allCompleted: true,
    });
    expect(weekly.granted).toBe(2);
    expect(weekly.hunt.energy).toBe(8);
    const capped = grantRewardHuntEnergy({ hunt: weekly.hunt, amount: 9 });
    expect(capped.granted).toBe(2);
    expect(capped.hunt.energy).toBe(10);
  });

  it('retira el premio de lista completa si se deshace antes de gastarlo', () => {
    const rewarded = syncHabitSetHuntEnergy({
      hunt: null, rewardKey: 'daily:2026-08-27', amount: 1, allCompleted: true,
    });
    const revoked = syncHabitSetHuntEnergy({
      hunt: rewarded.hunt, rewardKey: 'daily:2026-08-27', amount: 1, allCompleted: false,
    });
    expect(revoked.revoked).toBe(1);
    expect(revoked.hunt.energy).toBe(5);
    const restored = syncHabitSetHuntEnergy({
      hunt: revoked.hunt, rewardKey: 'daily:2026-08-27', amount: 1, allCompleted: true,
    });
    expect(restored.granted).toBe(1);
    expect(restored.hunt.energy).toBe(6);
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
    expect(normalized).toMatchObject({ energy: 2, baseEnergy: 5, bonusEnergyEarned: 0 });
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

  it('aplica Fortuna al 50% del oro obtenido y respeta el límite restante', () => {
    const now = 50_000;
    const started = startHunt({
      hunt: null,
      difficultyId: 'easy',
      level: 20,
      fortune: { dayKey: '2026-08-28' },
      nowTimestamp: now,
      seed: 8,
    });
    expect(HUNT_FORTUNE_BONUS_PERCENT).toBe(0.5);
    expect(started.hunt.active.fortune).toEqual({ dayKey: '2026-08-28', bonusPercent: 0.5 });
    const result = resolveHunt({
      hunt: started.hunt,
      classId: 'knight',
      level: 20,
      allocation: { strength: 20, defense: 15, constitution: 10 },
      fortuneBonusRemaining: 50,
      nowTimestamp: now + HUNT_DIFFICULTIES.easy.durationMinutes * 60_000,
    });
    const expectedBonus = Math.max(1, Math.round(result.report.rewards.baseGold * 0.5));
    expect(result.report.rewards.fortuneGold).toBe(expectedBonus);
    expect(result.report.rewards.gold).toBe(result.report.rewards.baseGold + expectedBonus);
    expect(result.report.fortune).toMatchObject({
      dayKey: '2026-08-28',
      bonusPercent: 0.5,
      granted: expectedBonus,
      remaining: 50 - expectedBonus,
    });

    const capped = resolveHunt({
      hunt: started.hunt,
      classId: 'knight',
      level: 20,
      allocation: { strength: 20, defense: 15, constitution: 10 },
      fortuneBonusRemaining: 2,
      nowTimestamp: now + HUNT_DIFFICULTIES.easy.durationMinutes * 60_000,
    });
    expect(capped.report.rewards.fortuneGold).toBe(2);
    expect(capped.report.fortune.remaining).toBe(0);
  });
});
