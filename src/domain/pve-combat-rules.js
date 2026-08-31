import { attributeSheet } from './attribute-rules.js';
import { normalizePotionState } from './potion-rules.js';

export const DAILY_HUNT_ENERGY = 10;
export const DAILY_HUNT_BONUS_ENERGY_CAP = 2;
export const MAX_HUNT_ENERGY = 15;
export const HUNT_ENERGY_CAPACITY_VERSION = 3;
const HUNT_ENERGY_CAPACITY_UPGRADE_GIFT = 5;
const HUNT_ENERGY_ROLLOVER_REPAIR_GIFT = 2;
export const HUNT_VICTORY_RECOVERY = Object.freeze({
  hpPercent: 0.25,
  manaPercent: 0.15,
  hpCapPercent: 0.8,
  manaCapPercent: 0.6,
});
export const HUNT_ENCOUNTER_RECOVERY = Object.freeze({
  hpTargetPercent: 0.7,
  manaPercent: 0.15,
  manaCapPercent: 0.6,
});
export const HUNT_AUTO_POTION_RULES = Object.freeze({
  lifeThresholdPercent: 0.3,
  manaThresholdPercent: 0.25,
  lifeRestore: 20,
  manaRestore: 25,
  maxLifePerEncounter: 1,
  maxManaPerEncounter: 1,
});
export const HUNT_FORTUNE_BONUS_PERCENT = 0.5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const BRUMA_ENEMY_TEMPLATES = [
  { id: 'blighted-harvester', role: 'Soldado', name: 'Brote Engañoso', art: 'hunt/fields-of-mist/blighted-harvester.webp', lore: 'Parece una planta joven e inofensiva, pero sus hojas dentadas se alimentan de la voluntad de quien se acerca. Es la primera mentira que susurra el cultivo.', attributes: { strength: 3, defense: 3, dexterity: 4, power: 1, constitution: 4 } },
  { id: 'spore-overseer', role: 'Líder', name: 'Segador de la Bruma', art: 'hunt/fields-of-mist/spore-overseer.webp', lore: 'Creció respirando los vapores tóxicos del campo hasta adoptar una silueta casi humana. Sus esporas nublan el juicio y guían a los brotes menores.', attributes: { strength: 3, defense: 6, dexterity: 7, power: 5, constitution: 8 } },
  { id: 'mist-mother', role: 'Minijefe', name: 'Madre del Cultivo', art: 'hunt/fields-of-mist/mist-mother.webp', lore: 'Sus raíces recorren toda la plantación y alimentan la bruma fluorescente. Cada criatura del campo es una extensión de su hambre antigua.', attributes: { strength: 6, defense: 9, dexterity: 10, power: 7, constitution: 13 } },
];
const BUNKER_ENEMY_TEMPLATES = [
  { id: 'the-consumed', role: 'Soldado', name: 'El Consumido', art: 'hunt/dead-hours-bunker/the-consumed.webp', lore: 'Entró para descansar solo un momento y entregó días enteros al humo. Ahora sus miembros obedecen a los hilos verdes que le atraviesan la nuca, mientras el último resto de voluntad se apaga detrás de sus ojos.', attributes: { strength: 7, defense: 8, dexterity: 8, power: 5, constitution: 9 } },
  { id: 'embedded-guardian', role: 'Líder', name: 'El Guardián Empotrado', art: 'hunt/dead-hours-bunker/embedded-guardian.webp', lore: 'El búnker lo convirtió en muro, conducto y centinela. El metal crece dentro de su carne y cada tubería alimenta una fuerza que no le pertenece; incluso su brazo blindado se alza porque otro tira de él.', attributes: { strength: 9, defense: 11, dexterity: 11, power: 8, constitution: 14 } },
  { id: 'dead-hours-puppeteer', role: 'Minijefe', name: 'El Titiritero', art: 'hunt/dead-hours-bunker/dead-hours-puppeteer.webp', lore: 'Es la voluntad que respira detrás de las paredes. Se alimenta del tiempo desperdiciado y mueve a sus víctimas mediante filamentos de humo, paciente y consciente, mientras los relojes del búnker permanecen detenidos.', attributes: { strength: 11, defense: 14, dexterity: 14, power: 13, constitution: 19 } },
];

function enemyStatsFromAttributes(definition, attributes = definition.attributes) {
  const attackType = attributes.power > attributes.strength ? 'magic' : 'physical';
  return {
    ...definition,
    attributes: { ...attributes },
    maxHp: 20 + attributes.constitution * 6,
    physicalAttack: Math.round(3 + attributes.strength * 1.5),
    magicAttack: Math.round(3 + attributes.power * 1.5),
    defense: attributes.defense,
    criticalChance: clamp(0.025 + attributes.dexterity * 0.003, 0, 0.18),
    dodgeChance: clamp(attributes.dexterity * 0.0015, 0, 0.1),
    attackType,
  };
}

export const BRUMA_ENEMIES = Object.freeze(BRUMA_ENEMY_TEMPLATES.map((enemy) => Object.freeze(enemyStatsFromAttributes(enemy))));
export const BUNKER_ENEMIES = Object.freeze(BUNKER_ENEMY_TEMPLATES.map((enemy) => Object.freeze(enemyStatsFromAttributes(enemy))));
export const HUNT_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: 'easy', name: 'Fácil', multiplier: 1.25, minLevel: 3, energyCost: 1, durationMinutes: 1, xp: 5, gold: [5, 9], fiberChance: 0, fiberAmount: [0, 0], inkChance: 0, inkAmount: [0, 0] }),
  medium: Object.freeze({ id: 'medium', name: 'Medio', multiplier: 1.75, minLevel: 7, energyCost: 2, durationMinutes: 3, xp: 12, gold: [11, 18], fiberChance: 0.3, fiberAmount: [1, 1], inkChance: 0.25, inkAmount: [1, 1] }),
  hard: Object.freeze({ id: 'hard', name: 'Difícil', multiplier: 2.4, minLevel: 12, energyCost: 3, durationMinutes: 5, xp: 22, gold: [20, 32], fiberChance: 0.7, fiberAmount: [1, 2], inkChance: 0.5, inkAmount: [1, 1] }),
});
export const HUNT_REGIONS = Object.freeze({
  'fields-of-mist': Object.freeze({
    id: 'fields-of-mist',
    name: 'Campos de la Bruma',
    description: 'Cultivos corrompidos alimentan una niebla que doblega la voluntad. Envía a tu héroe a purificarlos.',
    art: 'hunt/fields-of-mist/region.webp',
    enemies: BRUMA_ENEMIES,
    difficultyMinLevels: Object.freeze({ easy: 3, medium: 7, hard: 12 }),
    rewardMultiplier: 1,
    bossBloodChance: 0.1,
    victoryMessage: 'La bruma retrocede',
  }),
  'dead-hours-bunker': Object.freeze({
    id: 'dead-hours-bunker',
    name: 'Búnker de las Horas Muertas',
    description: 'Un humo encantado devora la voluntad y el tiempo de quienes entran. Rompe los hilos antes de que el búnker reclame otra víctima.',
    art: 'hunt/dead-hours-bunker/region.webp',
    enemies: BUNKER_ENEMIES,
    difficultyMinLevels: Object.freeze({ easy: 15, medium: 20, hard: 25 }),
    rewardMultiplier: 1.6,
    dropOverrides: Object.freeze({
      medium: Object.freeze({ fiberChance: 0.4, fiberAmount: Object.freeze([1, 2]), inkChance: 0.3, inkAmount: Object.freeze([1, 1]) }),
      hard: Object.freeze({ fiberChance: 0.75, fiberAmount: Object.freeze([2, 3]), inkChance: 0.55, inkAmount: Object.freeze([1, 2]) }),
    }),
    bossBloodChance: 0.15,
    victoryMessage: 'Los hilos del Titiritero se quiebran',
  }),
});
export const HUNT_ENEMIES = Object.freeze(Object.values(HUNT_REGIONS).flatMap((region) => region.enemies));

export function huntRegion(regionId = 'fields-of-mist') {
  return HUNT_REGIONS[regionId] || null;
}

export function huntDifficultyMinLevel(regionId, difficultyId) {
  const region = huntRegion(regionId);
  const difficulty = HUNT_DIFFICULTIES[difficultyId];
  if (!region || !difficulty) return 0;
  return safeInteger(region.difficultyMinLevels?.[difficultyId] ?? difficulty.minLevel);
}

export function huntDropRules(regionId = 'fields-of-mist', difficultyId) {
  const region = huntRegion(regionId);
  const difficulty = HUNT_DIFFICULTIES[difficultyId];
  if (!region || !difficulty) return null;
  const override = region.dropOverrides?.[difficultyId] || {};
  return {
    fiberChance: Number(override.fiberChance ?? difficulty.fiberChance) || 0,
    fiberAmount: [...(override.fiberAmount || difficulty.fiberAmount || [0, 0])],
    inkChance: Number(override.inkChance ?? difficulty.inkChance) || 0,
    inkAmount: [...(override.inkAmount || difficulty.inkAmount || [0, 0])],
  };
}

const safeInteger = (value) => Math.max(0, Math.floor(Number(value) || 0));

export function localHuntDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeHuntState(hunt, nowTimestamp = Date.now(), dailyBaseEnergy = DAILY_HUNT_ENERGY) {
  const energyDay = localHuntDayKey(nowTimestamp);
  const sameDay = hunt?.energyDay === energyDay;
  const storedRewardEnergyRemaining = clamp(
    safeInteger(hunt?.rewardEnergyRemaining),
    0,
    MAX_HUNT_ENERGY - DAILY_HUNT_ENERGY,
  );
  const dailyRefillEnergy = clamp(
    safeInteger(dailyBaseEnergy) || DAILY_HUNT_ENERGY,
    1,
    DAILY_HUNT_ENERGY,
  );
  const baseEnergy = DAILY_HUNT_ENERGY;
  const previousBaseEnergy = clamp(safeInteger(hunt?.baseEnergy) || baseEnergy, 1, baseEnergy);
  const previousStoredEnergy = safeInteger(hunt?.energy);
  const declaredPreviousHabitBonus = hunt?.bonusEnergyRemaining == null
    ? Math.max(0, previousStoredEnergy - previousBaseEnergy - storedRewardEnergyRemaining)
    : safeInteger(hunt.bonusEnergyRemaining);
  const spendablePreviousHabitBonus = Math.max(
    0,
    previousStoredEnergy - storedRewardEnergyRemaining,
  );
  const carriedHabitBonus = sameDay
    ? 0
    : Math.min(
      declaredPreviousHabitBonus,
      spendablePreviousHabitBonus,
      DAILY_HUNT_BONUS_ENERGY_CAP,
    );
  const capacityUpgradeEnergy = sameDay
    && safeInteger(hunt?.energyCapacityVersion) < HUNT_ENERGY_CAPACITY_VERSION
    ? Math.max(0, dailyRefillEnergy - HUNT_ENERGY_CAPACITY_UPGRADE_GIFT)
    : 0;
  const rolloverRepairEnergy = sameDay
    && safeInteger(hunt?.energyCapacityVersion) === HUNT_ENERGY_CAPACITY_VERSION - 1
    && dailyRefillEnergy === DAILY_HUNT_ENERGY
    ? Math.min(
      HUNT_ENERGY_ROLLOVER_REPAIR_GIFT,
      Math.max(0, MAX_HUNT_ENERGY - previousStoredEnergy - capacityUpgradeEnergy),
    )
    : 0;
  const rewardEnergyRemaining = clamp(
    storedRewardEnergyRemaining + carriedHabitBonus + rolloverRepairEnergy,
    0,
    MAX_HUNT_ENERGY - DAILY_HUNT_ENERGY,
  );
  const storedBaseEnergy = sameDay
    ? clamp(safeInteger(hunt?.baseEnergy) || baseEnergy, 1, baseEnergy)
    : baseEnergy;
  const storedEnergy = sameDay
    ? safeInteger(hunt?.energy)
    : dailyRefillEnergy + rewardEnergyRemaining;
  const rawHabitEnergyRolls = sameDay && Array.isArray(hunt?.habitEnergyRolls)
    ? hunt.habitEnergyRolls.slice(-60)
    : [];
  const storedBonusEnergyEarned = sameDay
    ? clamp(safeInteger(hunt?.bonusEnergyEarned), 0, DAILY_HUNT_BONUS_ENERGY_CAP)
    : 0;
  const legacyBonusFromEnergy = sameDay
    ? Math.max(0, storedEnergy - storedBaseEnergy - rewardEnergyRemaining)
    : 0;
  const legacyGrantedBonuses = rawHabitEnergyRolls.filter((entry) => entry?.granted).length;
  const bonusEnergyEarned = sameDay
    ? clamp(
      Math.max(storedBonusEnergyEarned, legacyBonusFromEnergy, legacyGrantedBonuses),
      0,
      DAILY_HUNT_BONUS_ENERGY_CAP,
    )
    : 0;
  const recoverableGrantedBonuses = rawHabitEnergyRolls
    .filter((entry) => entry?.granted && entry?.status !== 'revoked').length;
  const missingRecordedBonuses = Math.max(0, bonusEnergyEarned - storedBonusEnergyEarned);
  const recoverableMissingBonuses = Math.min(missingRecordedBonuses, recoverableGrantedBonuses);
  const storedBonusEnergyRemaining = sameDay
    ? (hunt?.bonusEnergyRemaining == null
      ? legacyBonusFromEnergy
      : safeInteger(hunt.bonusEnergyRemaining))
    : 0;
  const statusAvailableBonuses = rawHabitEnergyRolls
    .filter((entry) => entry?.granted && entry?.status === 'available').length;
  const representedAvailableBonuses = Math.max(
    storedBonusEnergyRemaining,
    legacyBonusFromEnergy,
    statusAvailableBonuses,
  );
  const bonusEnergyRemaining = sameDay
    ? clamp(
      Math.max(representedAvailableBonuses, recoverableMissingBonuses),
      0,
      bonusEnergyEarned,
    )
    : 0;
  const recoveredAvailableBonuses = Math.max(0, bonusEnergyRemaining - representedAvailableBonuses);
  const normalizedEnergy = sameDay
    ? clamp(storedEnergy + recoveredAvailableBonuses + capacityUpgradeEnergy + rolloverRepairEnergy, 0, MAX_HUNT_ENERGY)
    : clamp(dailyRefillEnergy + rewardEnergyRemaining, 0, MAX_HUNT_ENERGY);
  const activeGrantedRolls = rawHabitEnergyRolls.filter((entry) => entry?.granted && entry?.status !== 'revoked');
  const availableEntries = new Set([
    ...activeGrantedRolls.filter((entry) => entry?.status === 'available'),
    ...activeGrantedRolls.filter((entry) => !['available', 'spent'].includes(entry?.status)),
    ...activeGrantedRolls.filter((entry) => entry?.status === 'spent'),
  ].slice(0, bonusEnergyRemaining));
  const habitEnergyRolls = rawHabitEnergyRolls.map((entry) => {
    if (!entry?.granted) return { ...entry, status: 'missed' };
    if (entry?.status === 'revoked') return { ...entry };
    return { ...entry, status: availableEntries.has(entry) ? 'available' : 'spent' };
  });
  const completionEnergyRewards = Array.isArray(hunt?.completionEnergyRewards)
    ? hunt.completionEnergyRewards.filter((entry) => entry?.key).slice(-120).map((entry) => ({
      ...entry,
      granted: safeInteger(entry.granted),
      remaining: safeInteger(entry.remaining),
    }))
    : [];
  return {
    energyDay,
    baseEnergy,
    bonusEnergyEarned,
    bonusEnergyRemaining,
    rewardEnergyRemaining,
    energyCapacityVersion: HUNT_ENERGY_CAPACITY_VERSION,
    bonusEnergyLedgerVersion: 1,
    habitEnergyRolls,
    completionEnergyRewards,
    energy: normalizedEnergy,
    active: hunt?.active && typeof hunt.active === 'object' ? hunt.active : null,
    lastReport: hunt?.lastReport && typeof hunt.lastReport === 'object' ? hunt.lastReport : null,
    history: Array.isArray(hunt?.history) ? hunt.history.slice(-20) : [],
  };
}

export function grantRewardHuntEnergy({ hunt, amount = 0, nowTimestamp = Date.now() }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  const granted = Math.min(safeInteger(amount), Math.max(0, MAX_HUNT_ENERGY - normalized.energy));
  if (!granted) return { granted: 0, hunt: normalized };
  return {
    granted,
    hunt: {
      ...normalized,
      energy: normalized.energy + granted,
      rewardEnergyRemaining: normalized.rewardEnergyRemaining + granted,
    },
  };
}

export function syncHabitSetHuntEnergy({
  hunt,
  rewardKey,
  amount = 0,
  allCompleted = false,
  nowTimestamp = Date.now(),
}) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  if (!rewardKey) return { granted: 0, revoked: 0, hunt: normalized };
  const previous = normalized.completionEnergyRewards.find((entry) => entry.key === rewardKey);
  if (allCompleted) {
    if (previous?.status === 'revoked' && safeInteger(previous.spent) === 0) {
      const granted = Math.min(
        safeInteger(previous.granted),
        Math.max(0, MAX_HUNT_ENERGY - normalized.energy),
      );
      return {
        granted,
        revoked: 0,
        hunt: {
          ...normalized,
          energy: normalized.energy + granted,
          rewardEnergyRemaining: normalized.rewardEnergyRemaining + granted,
          completionEnergyRewards: normalized.completionEnergyRewards.map((entry) => (
            entry.key === rewardKey
              ? { ...entry, remaining: granted, status: granted ? 'available' : 'capped' }
              : entry
          )),
        },
      };
    }
    if (previous) return { granted: 0, revoked: 0, hunt: normalized };
    const requested = safeInteger(amount);
    const granted = Math.min(requested, Math.max(0, MAX_HUNT_ENERGY - normalized.energy));
    return {
      granted,
      revoked: 0,
      hunt: {
        ...normalized,
        energy: normalized.energy + granted,
        rewardEnergyRemaining: normalized.rewardEnergyRemaining + granted,
        completionEnergyRewards: [...normalized.completionEnergyRewards, {
          key: rewardKey,
          requested,
          granted,
          remaining: granted,
          status: granted ? 'available' : 'capped',
        }].slice(-120),
      },
    };
  }
  if (!previous || previous.status !== 'available' || previous.remaining < 1) {
    return { granted: 0, revoked: 0, hunt: normalized };
  }
  const revoked = Math.min(previous.remaining, normalized.rewardEnergyRemaining, normalized.energy);
  return {
    granted: 0,
    revoked,
    hunt: {
      ...normalized,
      energy: normalized.energy - revoked,
      rewardEnergyRemaining: normalized.rewardEnergyRemaining - revoked,
      completionEnergyRewards: normalized.completionEnergyRewards.map((entry) => (
        entry.key === rewardKey
          ? { ...entry, spent: Math.max(0, entry.granted - entry.remaining), remaining: 0, status: 'revoked' }
          : entry
      )),
    },
  };
}

export function grantHabitHuntEnergy({ hunt, rewardKey, becameCompleted, nowTimestamp = Date.now(), roll = Math.random }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  if (!becameCompleted || !rewardKey) {
    return { granted: 0, chance: 0, hunt: normalized };
  }
  const previous = normalized.habitEnergyRolls.find((entry) => entry?.key === rewardKey);
  if (previous) {
    if (previous.granted && previous.status === 'revoked') {
      const granted = normalized.energy < MAX_HUNT_ENERGY ? 1 : 0;
      return {
        granted,
        chance: previous.chance || 0,
        hunt: {
          ...normalized,
          bonusEnergyRemaining: normalized.bonusEnergyRemaining + granted,
          energy: normalized.energy + granted,
          habitEnergyRolls: normalized.habitEnergyRolls.map((entry) => (
            entry?.key === rewardKey ? { ...entry, status: granted ? 'available' : 'revoked' } : entry
          )),
        },
      };
    }
    return { granted: 0, chance: previous.chance || 0, hunt: normalized };
  }
  if (normalized.bonusEnergyEarned >= DAILY_HUNT_BONUS_ENERGY_CAP) {
    return { granted: 0, chance: 0, hunt: normalized };
  }
  const chance = normalized.bonusEnergyEarned === 0 ? 0.1 : 0.08;
  const granted = roll() < chance && normalized.energy < MAX_HUNT_ENERGY ? 1 : 0;
  return {
    granted,
    chance,
    hunt: {
      ...normalized,
      bonusEnergyEarned: normalized.bonusEnergyEarned + granted,
      bonusEnergyRemaining: normalized.bonusEnergyRemaining + granted,
      energy: normalized.energy + granted,
      habitEnergyRolls: [...normalized.habitEnergyRolls, {
        key: rewardKey,
        granted,
        chance,
        status: granted ? 'available' : 'missed',
      }].slice(-60),
    },
  };
}

export function revokeHabitHuntEnergy({ hunt, rewardKey, becameIncomplete, nowTimestamp = Date.now() }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  if (!becameIncomplete || !rewardKey) return { revoked: 0, hunt: normalized };
  const previous = normalized.habitEnergyRolls.find((entry) => entry?.key === rewardKey);
  if (!previous?.granted || previous.status !== 'available' || normalized.bonusEnergyRemaining < 1) {
    return { revoked: 0, hunt: normalized };
  }
  return {
    revoked: 1,
    hunt: {
      ...normalized,
      energy: Math.max(0, normalized.energy - 1),
      bonusEnergyRemaining: normalized.bonusEnergyRemaining - 1,
      habitEnergyRolls: normalized.habitEnergyRolls.map((entry) => (
        entry?.key === rewardKey ? { ...entry, status: 'revoked' } : entry
      )),
    },
  };
}

export function fiberChanceForHunt({ hunt, difficultyId, regionId = 'fields-of-mist', nowTimestamp = Date.now() }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  const dropRules = huntDropRules(regionId, difficultyId);
  if (!dropRules || dropRules.fiberChance <= 0) return 0;
  const dropsToday = normalized.history.filter((report) => (
    Number(report?.rewards?.arcaneFibers) > 0
    && localHuntDayKey(report.completedAt) === normalized.energyDay
  )).length;
  return Math.max(0.01, dropRules.fiberChance - dropsToday * 0.06);
}

export function fiberChanceForProgress({
  hunt,
  difficultyId,
  regionId = 'fields-of-mist',
  defeatedEnemies = 0,
  nowTimestamp = Date.now(),
}) {
  if (safeInteger(defeatedEnemies) < 2) return 0;
  return fiberChanceForHunt({ hunt, difficultyId, regionId, nowTimestamp });
}

export function inkChanceForProgress({ hunt, difficultyId, regionId = 'fields-of-mist', defeatedEnemies = 0, nowTimestamp = Date.now() }) {
  if (safeInteger(defeatedEnemies) < 2) return 0;
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  const baseChance = huntDropRules(regionId, difficultyId)?.inkChance || 0;
  if (baseChance <= 0) return 0;
  const dropsToday = normalized.history.filter((report) => (
    Number(report?.rewards?.arcaneInks) > 0
    && localHuntDayKey(report.completedAt) === normalized.energyDay
  )).length;
  return Math.max(0.05, baseChance - dropsToday * 0.05);
}

export function huntRecoveryRates(defeatedEnemies = 0, totalEnemies = BRUMA_ENEMIES.length) {
  const total = Math.max(1, safeInteger(totalEnemies));
  const progress = clamp(safeInteger(defeatedEnemies), 0, total) / total;
  return {
    hpPercent: HUNT_VICTORY_RECOVERY.hpPercent * progress,
    manaPercent: HUNT_VICTORY_RECOVERY.manaPercent * progress,
  };
}

export function pveHeroStats({ classId, level, allocation, relicBonuses = {} }) {
  const a = attributeSheet({ classId, level, allocation }).attributes;
  return {
    attributes: a,
    maxHp: 70 + a.constitution * 6,
    maxMana: 35 + a.power * 5,
    physicalAttack: 4 + a.strength * 2 + safeInteger(relicBonuses.physicalAttack),
    magicAttack: 4 + a.power * 2 + safeInteger(relicBonuses.magicAttack),
    defense: a.defense + safeInteger(relicBonuses.defense),
    criticalChance: clamp(0.04 + a.dexterity * 0.004, 0.04, 0.25),
    dodgeChance: clamp(a.dexterity * 0.002, 0, 0.12),
  };
}

export function resolvePveAttack({ attacker, defender, attackType = 'physical', attackMultiplier = 1, roll = Math.random }) {
  if (roll() < (defender.dodgeChance || 0)) return { damage: 0, critical: false, dodged: true };
  const attack = attackType === 'magic' ? (attacker.magicAttack ?? attacker.attack ?? 1) : (attacker.physicalAttack ?? attacker.attack ?? 1);
  const critical = roll() < (attacker.criticalChance || 0);
  const damage = Math.max(1, Math.round(attack * Math.max(0, Number(attackMultiplier) || 0) * (critical ? 1.6 : 1) - (defender.defense || 0) * 0.65));
  return { damage, critical, dodged: false };
}

export function simulatePveCombat({
  hero,
  enemy,
  heroHp: startingHeroHp,
  heroMana: startingHeroMana,
  attackType = 'physical',
  roll = Math.random,
  maxRounds = 30,
  autoUsePotions = false,
  potions: suppliedPotions,
}) {
  let heroHp = Math.max(0, Number.isFinite(startingHeroHp) ? startingHeroHp : hero.maxHp);
  let heroMana = Math.max(0, Number.isFinite(startingHeroMana) ? startingHeroMana : hero.maxMana);
  let enemyHp = Math.max(1, enemy.maxHp);
  const potions = normalizePotionState(suppliedPotions);
  const potionUses = [];
  const roundDetails = [];
  let lifePotionsUsed = 0;
  let manaPotionsUsed = 0;
  const log = [];
  for (let round = 1; round <= maxRounds && heroHp > 0 && enemyHp > 0; round += 1) {
    const roundPotionUses = [];
    if (
      autoUsePotions
      && manaPotionsUsed < HUNT_AUTO_POTION_RULES.maxManaPerEncounter
      && potions.owned.mana > 0
      && heroMana < hero.maxMana
      && heroMana <= hero.maxMana * HUNT_AUTO_POTION_RULES.manaThresholdPercent
    ) {
      const restored = Math.min(HUNT_AUTO_POTION_RULES.manaRestore, hero.maxMana - heroMana);
      heroMana += restored;
      potions.owned.mana -= 1;
      manaPotionsUsed += 1;
      const use = { round, type: 'mana', restored };
      potionUses.push(use);
      roundPotionUses.push(use);
      log.push({ round, actor: 'potion', potionId: 'mana', restored, remainingMana: heroMana, remainingHp: heroHp });
    }
    const manaSpent = Math.min(2, heroMana);
    const heroHit = resolvePveAttack({
      attacker: hero,
      defender: enemy,
      attackType,
      attackMultiplier: manaSpent > 0 ? 1 : 0.72,
      roll,
    });
    heroMana = Math.max(0, heroMana - manaSpent);
    enemyHp = Math.max(0, enemyHp - heroHit.damage);
    log.push({ round, actor: 'hero', ...heroHit, manaSpent, remainingMana: heroMana, remainingHp: enemyHp });
    let damageTaken = 0;
    if (enemyHp > 0) {
      const enemyHit = resolvePveAttack({ attacker: enemy, defender: hero, attackType: enemy.attackType || 'physical', roll });
      damageTaken = enemyHit.damage;
      heroHp = Math.max(0, heroHp - enemyHit.damage);
      log.push({ round, actor: 'enemy', ...enemyHit, remainingHp: heroHp });
      if (
        autoUsePotions
        && heroHp > 0
        && lifePotionsUsed < HUNT_AUTO_POTION_RULES.maxLifePerEncounter
        && potions.owned.life > 0
        && heroHp < hero.maxHp
        && heroHp <= hero.maxHp * HUNT_AUTO_POTION_RULES.lifeThresholdPercent
      ) {
        const restored = Math.min(HUNT_AUTO_POTION_RULES.lifeRestore, hero.maxHp - heroHp);
        heroHp += restored;
        potions.owned.life -= 1;
        lifePotionsUsed += 1;
        const use = { round, type: 'life', restored };
        potionUses.push(use);
        roundPotionUses.push(use);
        log.push({ round, actor: 'potion', potionId: 'life', restored, remainingMana: heroMana, remainingHp: heroHp });
      }
    }
    roundDetails.push({
      round,
      damageDealt: heroHit.damage,
      damageTaken,
      heroHp,
      heroMana,
      potionUses: roundPotionUses,
    });
  }
  return {
    won: enemyHp <= 0 && heroHp > 0,
    heroHp,
    heroMana,
    enemyHp,
    rounds: roundDetails.at(-1)?.round || 0,
    damageTaken: roundDetails.reduce((sum, detail) => sum + detail.damageTaken, 0),
    potionUses,
    potions,
    roundDetails,
    log,
  };
}

function seededRoll(seed) {
  let value = safeInteger(seed) || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function scaledEnemy(enemy, difficulty) {
  const scale = difficulty.multiplier;
  const attributes = Object.fromEntries(Object.entries(enemy.attributes)
    .map(([id, value]) => [id, Math.max(1, Math.round(value * scale))]));
  return enemyStatsFromAttributes(enemy, attributes);
}

function splitEncounterReward(total) {
  const first = Math.floor(total * 0.25);
  const second = Math.floor(total * 0.3);
  return [first, second, Math.max(0, total - first - second)];
}

function resourceRatio(current, maximum) {
  const max = Number(maximum);
  const value = Number(current);
  return Number.isFinite(value) && Number.isFinite(max) && max > 0
    ? clamp(value / max, 0, 1)
    : 1;
}

export function startHunt({ hunt, regionId = 'fields-of-mist', difficultyId, level = 1, currentHp, maxHp, currentMana, maxMana, relicBonuses = {}, autoUsePotions = false, fortune = null, nowTimestamp = Date.now(), seed = nowTimestamp }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  const region = huntRegion(regionId);
  const difficulty = HUNT_DIFFICULTIES[difficultyId];
  if (!region) return { ok: false, reason: 'unknown-region', hunt: normalized };
  if (!difficulty) return { ok: false, reason: 'unknown-difficulty', hunt: normalized };
  const requiredLevel = huntDifficultyMinLevel(region.id, difficulty.id);
  if (safeInteger(level) < requiredLevel) return { ok: false, reason: 'level-locked', requiredLevel, hunt: normalized };
  if (normalized.active) return { ok: false, reason: 'hunt-active', hunt: normalized };
  if (normalized.energy < difficulty.energyCost) return { ok: false, reason: 'insufficient-energy', hunt: normalized };
  const bonusEnergySpent = Math.min(normalized.bonusEnergyRemaining, difficulty.energyCost);
  const rewardEnergySpent = Math.min(
    normalized.rewardEnergyRemaining,
    difficulty.energyCost - bonusEnergySpent,
  );
  let remainingBonusToSpend = bonusEnergySpent;
  const habitEnergyRolls = normalized.habitEnergyRolls.map((entry) => {
    if (remainingBonusToSpend > 0 && entry?.granted && entry.status === 'available') {
      remainingBonusToSpend -= 1;
      return { ...entry, status: 'spent' };
    }
    return entry;
  });
  let remainingRewardToSpend = rewardEnergySpent;
  const completionEnergyRewards = normalized.completionEnergyRewards.map((entry) => {
    if (remainingRewardToSpend < 1 || entry.status !== 'available' || entry.remaining < 1) return entry;
    const spent = Math.min(entry.remaining, remainingRewardToSpend);
    remainingRewardToSpend -= spent;
    const remaining = entry.remaining - spent;
    return { ...entry, remaining, status: remaining > 0 ? 'available' : 'spent' };
  });
  const active = {
    id: `hunt-${nowTimestamp}-${safeInteger(seed)}`,
    regionId: region.id,
    difficultyId,
    startedAt: nowTimestamp,
    endsAt: nowTimestamp + difficulty.durationMinutes * 60_000,
    seed: safeInteger(seed),
    entryHpRatio: resourceRatio(currentHp, maxHp),
    entryManaRatio: resourceRatio(currentMana, maxMana),
    autoUsePotions: Boolean(autoUsePotions),
    fortune: fortune?.dayKey ? {
      dayKey: String(fortune.dayKey),
      bonusPercent: HUNT_FORTUNE_BONUS_PERCENT,
    } : null,
    relicBonuses: {
      physicalAttack: safeInteger(relicBonuses.physicalAttack),
      magicAttack: safeInteger(relicBonuses.magicAttack),
      defense: safeInteger(relicBonuses.defense),
    },
  };
  return {
    ok: true,
    reason: null,
    hunt: {
      ...normalized,
      energy: normalized.energy - difficulty.energyCost,
      bonusEnergyRemaining: normalized.bonusEnergyRemaining - bonusEnergySpent,
      rewardEnergyRemaining: normalized.rewardEnergyRemaining - rewardEnergySpent,
      habitEnergyRolls,
      completionEnergyRewards,
      active,
    },
  };
}

export function resolveHunt({ hunt, classId, level, allocation, potions: suppliedPotions, fortuneBonusRemaining = 0, nowTimestamp = Date.now() }) {
  const normalized = normalizeHuntState(hunt, nowTimestamp);
  const active = normalized.active;
  if (!active) return { ok: false, reason: 'no-active-hunt', hunt: normalized };
  if (nowTimestamp < active.endsAt) return { ok: false, reason: 'hunt-in-progress', remainingMs: active.endsAt - nowTimestamp, hunt: normalized };
  const difficulty = HUNT_DIFFICULTIES[active.difficultyId] || HUNT_DIFFICULTIES.easy;
  const region = huntRegion(active.regionId) || HUNT_REGIONS['fields-of-mist'];
  const random = seededRoll(active.seed);
  const hero = pveHeroStats({ classId, level, allocation, relicBonuses: active.relicBonuses });
  let currentHp = Number.isFinite(active.entryHpRatio)
    ? Math.max(0, Math.round(hero.maxHp * clamp(active.entryHpRatio, 0, 1)))
    : hero.maxHp;
  let currentMana = Number.isFinite(active.entryManaRatio)
    ? Math.max(0, Math.round(hero.maxMana * clamp(active.entryManaRatio, 0, 1)))
    : hero.maxMana;
  let potions = normalizePotionState(suppliedPotions);
  const encounters = [];
  for (const [enemyIndex, definition] of region.enemies.entries()) {
    const enemy = scaledEnemy(definition, difficulty);
    const heroHpAtStart = currentHp;
    const heroManaAtStart = currentMana;
    const result = simulatePveCombat({
      hero,
      enemy,
      heroHp: currentHp,
      heroMana: currentMana,
      attackType: ['sorcerer', 'druid'].includes(classId) ? 'magic' : 'physical',
      roll: random,
      autoUsePotions: Boolean(active.autoUsePotions),
      potions,
    });
    potions = result.potions;
    currentHp = result.heroHp;
    currentMana = result.heroMana;
    const heroHpAfterFight = currentHp;
    const heroManaAfterFight = currentMana;
    const hasNextEncounter = result.won && enemyIndex < region.enemies.length - 1;
    if (hasNextEncounter) {
      const hpRecoveryTarget = Math.round(hero.maxHp * HUNT_ENCOUNTER_RECOVERY.hpTargetPercent);
      const manaRecoveryLimit = Math.round(hero.maxMana * HUNT_ENCOUNTER_RECOVERY.manaCapPercent);
      currentHp = Math.max(currentHp, hpRecoveryTarget);
      currentMana = Math.max(currentMana, Math.min(
        manaRecoveryLimit,
        currentMana + Math.round(hero.maxMana * HUNT_ENCOUNTER_RECOVERY.manaPercent),
      ));
    }
    encounters.push({
      id: enemy.id,
      role: enemy.role,
      name: enemy.name,
      won: result.won,
      rounds: result.rounds,
      heroHpAtStart,
      heroManaAtStart,
      heroHp: heroHpAfterFight,
      heroMana: heroManaAfterFight,
      recoveryAfter: {
        hp: Math.max(0, currentHp - heroHpAfterFight),
        mana: Math.max(0, currentMana - heroManaAfterFight),
      },
      nextHeroHp: currentHp,
      nextHeroMana: currentMana,
      damageDealt: enemy.maxHp - result.enemyHp,
      damageTaken: result.damageTaken,
      potionUses: result.potionUses,
      roundDetails: result.roundDetails,
    });
    if (!result.won) break;
  }
  const won = encounters.length === region.enemies.length && encounters.every((encounter) => encounter.won);
  const defeatedEnemies = encounters.filter((encounter) => encounter.won).length;
  const [minGold, maxGold] = difficulty.gold;
  const rewardMultiplier = Math.max(1, Number(region.rewardMultiplier) || 1);
  const fullGold = Math.round((minGold + Math.floor(random() * (maxGold - minGold + 1))) * rewardMultiplier);
  const goldByEnemy = splitEncounterReward(fullGold);
  const xpByEnemy = splitEncounterReward(Math.round(difficulty.xp * rewardMultiplier));
  encounters.forEach((encounter, index) => {
    encounter.rewards = {
      xp: encounter.won ? xpByEnemy[index] : 0,
      gold: encounter.won ? goldByEnemy[index] : 0,
      arcaneFibers: 0,
      arcaneInks: 0,
      bossBlood: 0,
    };
  });
  const leaderRewards = encounters[1]?.won ? encounters[1].rewards : null;
  if (leaderRewards) {
    const dropRules = huntDropRules(region.id, difficulty.id);
    const fiberChance = fiberChanceForProgress({
      hunt: normalized,
      difficultyId: difficulty.id,
      regionId: region.id,
      defeatedEnemies,
      nowTimestamp,
    });
    if (random() < fiberChance) {
      const [minFiber, maxFiber] = dropRules.fiberAmount;
      leaderRewards.arcaneFibers = minFiber + Math.floor(random() * (maxFiber - minFiber + 1));
    }
    const inkChance = inkChanceForProgress({
      hunt: normalized,
      difficultyId: difficulty.id,
      regionId: region.id,
      defeatedEnemies,
      nowTimestamp,
    });
    if (random() < inkChance) {
      const [minInk, maxInk] = dropRules.inkAmount;
      leaderRewards.arcaneInks = minInk + (maxInk > minInk ? Math.floor(random() * (maxInk - minInk + 1)) : 0);
    }
  }
  const bossRewards = encounters[2]?.won ? encounters[2].rewards : null;
  if (bossRewards) bossRewards.bossBlood = difficulty.id === 'hard' && random() < region.bossBloodChance ? 1 : 0;
  const baseGold = encounters.reduce((total, encounter) => total + encounter.rewards.gold, 0);
  const fortuneRequested = active.fortune?.dayKey && baseGold > 0
    ? Math.max(1, Math.round(baseGold * HUNT_FORTUNE_BONUS_PERCENT))
    : 0;
  const fortuneGold = Math.min(fortuneRequested, safeInteger(fortuneBonusRemaining));
  const rewards = {
    xp: encounters.reduce((total, encounter) => total + encounter.rewards.xp, 0),
    gold: baseGold + fortuneGold,
    baseGold,
    fortuneGold,
    arcaneFibers: encounters.reduce((total, encounter) => total + encounter.rewards.arcaneFibers, 0),
    arcaneInks: encounters.reduce((total, encounter) => total + encounter.rewards.arcaneInks, 0),
    bossBlood: encounters.reduce((total, encounter) => total + encounter.rewards.bossBlood, 0),
  };
  const heroHpBeforeRecovery = currentHp;
  const heroManaBeforeRecovery = currentMana;
  const heroDied = heroHpBeforeRecovery <= 0;
  if (defeatedEnemies > 0 && !heroDied) {
    const recoveryRates = huntRecoveryRates(defeatedEnemies, region.enemies.length);
    const hpRecoveryLimit = Math.round(hero.maxHp * HUNT_VICTORY_RECOVERY.hpCapPercent);
    const manaRecoveryLimit = Math.round(hero.maxMana * HUNT_VICTORY_RECOVERY.manaCapPercent);
    currentHp = Math.max(currentHp, Math.min(
      hpRecoveryLimit,
      currentHp + Math.round(hero.maxHp * recoveryRates.hpPercent),
    ));
    currentMana = Math.max(currentMana, Math.min(
      manaRecoveryLimit,
      currentMana + Math.round(hero.maxMana * recoveryRates.manaPercent),
    ));
  }
  const recovery = {
    hp: Math.max(0, currentHp - heroHpBeforeRecovery),
    mana: Math.max(0, currentMana - heroManaBeforeRecovery),
  };
  const report = {
    id: active.id,
    regionId: active.regionId,
    difficultyId: difficulty.id,
    startedAt: active.startedAt,
    completedAt: nowTimestamp,
    won,
    heroDied,
    defeatedEnemies,
    heroMaxHp: hero.maxHp,
    heroHp: currentHp,
    heroHpBeforeRecovery,
    heroMaxMana: hero.maxMana,
    heroMana: currentMana,
    heroManaBeforeRecovery,
    recovery,
    encounters,
    rewards,
    fortune: active.fortune?.dayKey ? {
      dayKey: active.fortune.dayKey,
      bonusPercent: HUNT_FORTUNE_BONUS_PERCENT,
      requested: fortuneRequested,
      granted: fortuneGold,
      remaining: Math.max(0, safeInteger(fortuneBonusRemaining) - fortuneGold),
    } : null,
  };
  return { ok: true, reason: null, report, potions, hunt: { ...normalized, active: null, lastReport: report, history: [...normalized.history, report].slice(-20) } };
}
