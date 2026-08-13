export const LOOT_SCHEMA_VERSION = 2;
export const MAX_INITIAL_RELICS = 6;
export const MAX_EQUIPPED_RELICS = 2;

export const BOSS_REWARDS = [
  { coins: 75, bossBlood: 1 },
  { coins: 85, bossBlood: 1 },
  { coins: 100, bossBlood: 1 },
  { coins: 115, bossBlood: 2 },
  { coins: 130, bossBlood: 2 },
  { coins: 145, bossBlood: 3 },
];
export const RELIC_DROP_RATE = 0.7;
export const SHOP_ROTATION_DAYS = 3;
export const SHOP_MAX_VISIBLE_RELICS = 3;

export const RARITIES = {
  rare: { id: 'rare', label: 'RARO', rate: 0.6, affixCount: 0 },
  legendary: {
    id: 'legendary',
    label: 'LEGENDARIO',
    rate: 0.3,
    affixCount: 1,
  },
  mythic: { id: 'mythic', label: 'MÍTICO', rate: 0.1, affixCount: 2 },
};

export const RARITY_ORDER = ['rare', 'legendary', 'mythic'];

export const AFFIX_DEFINITIONS = {
  vitality: {
    id: 'vitality',
    name: 'Vitalidad',
    description: '+5 HP máximo',
    maxHp: 5,
  },
  arcane: {
    id: 'arcane',
    name: 'Arcano',
    description: '+5 Maná máximo',
    maxMana: 5,
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneración',
    description: 'La vida se recupera 30 segundos antes por cada punto.',
    regenerationMinutesReduction: 0.5,
  },
  channeling: {
    id: 'channeling',
    name: 'Canalización',
    description: '+1 Maná al recibir una recuperación explícita de Maná.',
    manaRecoveryBonus: 1,
  },
  discipline: {
    id: 'discipline',
    name: 'Disciplina',
    description: '+1 XP al completar hábitos, respetando sus topes.',
    habitXpBonus: 1,
  },
  fortune: {
    id: 'fortune',
    name: 'Fortuna',
    description: '+1 punto porcentual en la Forja.',
    forgeChanceBonus: 1,
  },
};

export const FORTUNE_CAP = 10;
export const FORTUNE_FORGE_BONUS = 1;

export const RELIC_DEFINITIONS = [
  {
    id: 'relic_01',
    rewardId: 'boss_reward_01',
    bossIndex: 0,
    name: 'Corazón de Hollín',
    image: 'relics/relic_01_corazon_hollin.png',
    effectLabel: 'Reduce la primera fuente de daño del día.',
    affixPool: ['vitality', 'regeneration', 'fortune'],
  },
  {
    id: 'relic_02',
    rewardId: 'boss_reward_02',
    bossIndex: 1,
    name: 'Lágrima de Espectro',
    image: 'relics/relic_02_lagrima_espectro.png',
    effectLabel: 'El primer hábito completado del día recupera Maná.',
    affixPool: ['arcane', 'channeling', 'discipline'],
  },
  {
    id: 'relic_03',
    rewardId: 'boss_reward_03',
    bossIndex: 2,
    name: 'Daga de Alquitrán',
    image: 'relics/relic_03_daga_alquitran.png',
    effectLabel: 'El primer hábito completado del día concede XP adicional.',
    affixPool: ['discipline', 'fortune', 'arcane'],
  },
  {
    id: 'relic_04',
    rewardId: 'boss_reward_04',
    bossIndex: 3,
    name: 'Escudo de la Última Brasa',
    image: 'relics/relic_04_escudo_ultima_brasa.png',
    effectLabel: 'Reduce el castigo de vida al perder un combate semanal.',
    affixPool: ['vitality', 'regeneration', 'fortune'],
  },
  {
    id: 'relic_05',
    rewardId: 'boss_reward_05',
    bossIndex: 4,
    name: 'Frasco del Antojo Roto',
    image: 'relics/relic_05_frasco_antojo_roto.png',
    effectLabel: 'El primer hechizo activo del día cuesta menos Maná.',
    affixPool: ['arcane', 'channeling', 'fortune'],
  },
  {
    id: 'relic_06',
    rewardId: 'boss_reward_06',
    bossIndex: 5,
    name: 'Colmillo de Nicotina',
    image: 'relics/relic_06_colmillo_nicotina.png',
    effectLabel: 'Cada día cumplido concede XP adicional.',
    affixPool: ['discipline', 'vitality', 'fortune'],
  },
];

// Rangos II y III son valores conservadores provisionales y están aislados aquí
// para poder equilibrarlos sin cambiar reglas, migraciones ni estado guardado.
export const RELIC_RANK_EFFECTS = {
  relic_01: { 1: 5, 2: 7, 3: 10 },
  relic_02: { 1: 5, 2: 7, 3: 10 },
  relic_03: { 1: 2, 2: 3, 3: 4 },
  relic_04: { 1: 5, 2: 7.5, 3: 10 },
  relic_05: { 1: 5, 2: 7, 3: 10 },
  relic_06: { 1: 10, 2: 15, 3: 20 },
};

export const FORGE_COSTS = { 2: 50, 3: 100 };
export const FORGE_BLOOD_REQUIREMENTS = { 2: 1, 3: 2 };
export const FORGE_PROBABILITIES = {
  2: [70, 85, 100],
  3: [45, 60, 75, 90, 100],
};

export function relicDefinition(relicId) {
  return RELIC_DEFINITIONS.find((relic) => relic.id === relicId) || null;
}

export function bossReward(bossIndex) {
  const reward = BOSS_REWARDS[bossIndex];
  return reward ? { ...reward } : null;
}

export function relicRankEffect(relicId, rank = 1) {
  return RELIC_RANK_EFFECTS[relicId]?.[Math.min(3, Math.max(1, rank))] || 0;
}
