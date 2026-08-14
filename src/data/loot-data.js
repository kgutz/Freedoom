export const LOOT_SCHEMA_VERSION = 4;
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
export const BOSS_BLOOD_DOUBLE_RATE = 0.02;
export const SHOP_ROTATION_DAYS = 3;
export const SHOP_MAX_VISIBLE_RELICS = 3;
export const FUSION_COIN_COST = 100;
export const FUSION_BLOOD_COST = 1;

export const CHARGE_MECHANICS = {
  constancy: { id: 'constancy', label: 'Constancia', max: 6 },
};

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
    equipmentType: 'heart',
    image: 'relics/relic_01_corazon_hollin.png',
    effectLabel: 'Reduce la primera fuente de daño del día.',
    affixPool: ['vitality', 'regeneration', 'fortune'],
  },
  {
    id: 'relic_02',
    rewardId: 'boss_reward_02',
    bossIndex: 1,
    name: 'Lágrima de Espectro',
    equipmentType: 'spirit',
    image: 'relics/relic_02_lagrima_espectro.png',
    effectLabel: 'El primer hábito completado del día recupera Maná.',
    affixPool: ['arcane', 'channeling', 'discipline'],
  },
  {
    id: 'relic_03',
    rewardId: 'boss_reward_03',
    bossIndex: 2,
    name: 'Daga de Alquitrán',
    equipmentType: 'dagger',
    image: 'relics/relic_03_daga_alquitran.png',
    effectLabel: 'El primer hábito completado del día concede XP adicional.',
    affixPool: ['discipline', 'fortune', 'arcane'],
  },
  {
    id: 'relic_04',
    rewardId: 'boss_reward_04',
    bossIndex: 3,
    name: 'Yelmo de la Última Brasa',
    equipmentType: 'helmet',
    image: 'relics/relic_04_yelmo_ultima_brasa.png',
    chargeMechanic: 'constancy',
    effectLabel: 'Constancia: completa 6 días consecutivos y derrota al jefe para ganar XP extraordinaria.',
    affixPool: ['vitality', 'regeneration', 'fortune'],
  },
  {
    id: 'relic_05',
    rewardId: 'boss_reward_05',
    bossIndex: 4,
    name: 'Frasco del Antojo Roto',
    equipmentType: 'vessel',
    image: 'relics/relic_05_frasco_antojo_roto.png',
    effectLabel: 'El primer hechizo activo del día cuesta menos Maná.',
    affixPool: ['arcane', 'channeling', 'fortune'],
  },
  {
    id: 'relic_06',
    rewardId: 'boss_reward_06',
    bossIndex: 5,
    name: 'Colmillo de Nicotina',
    equipmentType: 'fang',
    image: 'relics/relic_06_colmillo_nicotina.png',
    effectLabel: 'Cada día cumplido concede XP adicional.',
    affixPool: ['discipline', 'vitality', 'fortune'],
  },
];

export const FUSION_RELIC_DEFINITIONS = [
  {
    id: 'fusion_01',
    recipeId: 'fusion_recipe_01',
    ingredientIds: ['relic_01', 'relic_02'],
    name: 'Corazón Espectral',
    equipmentType: 'heart',
    image: 'relics/fusion_01_corazon_espectral.png',
    effectLabel: 'Reduce la primera fuente de daño del día. El primer hábito recupera Maná y recibe 3 Maná adicionales.',
    synergy: { type: 'first-habit-mana', value: 3 },
  },
  {
    id: 'fusion_02',
    recipeId: 'fusion_recipe_02',
    ingredientIds: ['relic_01', 'relic_04'],
    name: 'Yelmo del Corazón Ardiente',
    equipmentType: 'helmet',
    image: 'relics/fusion_02_yelmo_corazon_ardiente.png',
    effectLabel: 'Reduce la primera fuente de daño del día. La Constancia concede XP y seis días cumplidos otorgan 20 XP adicionales.',
    synergy: { type: 'six-days-xp', value: 20 },
  },
  {
    id: 'fusion_03',
    recipeId: 'fusion_recipe_03',
    ingredientIds: ['relic_02', 'relic_05'],
    name: 'Ampolla del Alma',
    equipmentType: 'vessel',
    image: 'relics/fusion_03_ampolla_alma.png',
    effectLabel: 'El primer hábito recupera Maná y el primer hechizo cuesta menos. Completar antes un hábito reduce otros 3 Maná.',
    synergy: { type: 'habit-before-spell-discount', value: 3 },
  },
  {
    id: 'fusion_04',
    recipeId: 'fusion_recipe_04',
    ingredientIds: ['relic_03', 'relic_05'],
    name: 'Daga del Antojo',
    equipmentType: 'dagger',
    image: 'relics/fusion_04_daga_antojo.png',
    effectLabel: 'El primer hábito concede XP y el primer hechizo cuesta menos. Completar todos los hábitos diarios otorga 5 XP adicionales.',
    synergy: { type: 'all-daily-habits-xp', value: 5 },
  },
  {
    id: 'fusion_05',
    recipeId: 'fusion_recipe_05',
    ingredientIds: ['relic_04', 'relic_06'],
    name: 'Yelmo del Vencedor',
    equipmentType: 'helmet',
    image: 'relics/fusion_05_yelmo_vencedor.png',
    effectLabel: 'La Constancia y cada día cumplido conceden XP. Alcanzar seis días cumplidos otorga 25 XP adicionales.',
    synergy: { type: 'six-days-xp', value: 25 },
  },
];

export const PERMANENTLY_INCOMPATIBLE_FUSIONS = [
  ['relic_03', 'relic_06'],
];

export const ALL_RELIC_DEFINITIONS = [
  ...RELIC_DEFINITIONS,
  ...FUSION_RELIC_DEFINITIONS,
];

// Rangos II y III son valores conservadores provisionales y están aislados aquí
// para poder equilibrarlos sin cambiar reglas, migraciones ni estado guardado.
export const RELIC_RANK_EFFECTS = {
  relic_01: { 1: 5, 2: 7, 3: 10 },
  relic_02: { 1: 5, 2: 7, 3: 10 },
  relic_03: { 1: 2, 2: 3, 3: 4 },
  relic_04: { 1: 15, 2: 25, 3: 40 },
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
  return ALL_RELIC_DEFINITIONS.find((relic) => relic.id === relicId) || null;
}

export function fusionDefinition(recipeOrRelicId) {
  return FUSION_RELIC_DEFINITIONS.find((recipe) =>
    recipe.id === recipeOrRelicId || recipe.recipeId === recipeOrRelicId) || null;
}

export function isBaseRelic(relicId) {
  return RELIC_DEFINITIONS.some((relic) => relic.id === relicId);
}

export function bossReward(bossIndex) {
  const reward = BOSS_REWARDS[bossIndex];
  return reward ? { ...reward } : null;
}

export function relicRankEffect(relicId, rank = 1) {
  return RELIC_RANK_EFFECTS[relicId]?.[Math.min(3, Math.max(1, rank))] || 0;
}
