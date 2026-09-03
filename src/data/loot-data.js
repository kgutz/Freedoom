export const LOOT_SCHEMA_VERSION = 5;
export const MAX_INITIAL_RELICS = 12;
export const MAX_EQUIPPED_RELICS = 2;

export const BOSS_REWARDS = [
  { coins: 75, bossBlood: 1 },
  { coins: 85, bossBlood: 1 },
  { coins: 100, bossBlood: 1 },
  { coins: 115, bossBlood: 2 },
  { coins: 130, bossBlood: 2 },
  { coins: 145, bossBlood: 3 },
  { coins: 160, bossBlood: 3 },
  { coins: 175, bossBlood: 3 },
  { coins: 190, bossBlood: 4 },
  { coins: 205, bossBlood: 4 },
  { coins: 220, bossBlood: 5 },
  { coins: 235, bossBlood: 5 },
];
export const RELIC_DROP_RATE = 0.6;
export const BOSS_BLOOD_DOUBLE_RATE = 0.02;
export const EARLY_VICTORY_COIN_BONUS = 25;
export const EARLY_VICTORY_BLOOD_RATE = 0.1;
export const SHOP_ROTATION_DAYS = 3;
export const SHOP_MAX_VISIBLE_RELICS = 3;
export const FUSION_COIN_COST = 100;
export const FUSION_BLOOD_COST = 1;
export const DEFUSION_COIN_COST = 250;
export const DEFUSION_BLOOD_COST = 1;
export const FUSION_SUCCESS_PROBABILITIES = Object.freeze([70, 85, 100]);

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
    description: '+5% de Vida máxima',
    maxHpPercent: 5,
  },
  arcane: {
    id: 'arcane',
    name: 'Arcano',
    description: '+5% de Maná máximo',
    maxManaPercent: 5,
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneración',
    description: 'La vida se recupera 2 minutos antes.',
    regenerationMinutesReduction: 2,
  },
  channeling: {
    id: 'channeling',
    name: 'Canalización',
    description: 'Cada vez que una acción te devuelve Maná, recuperas un 5% adicional de tu Maná máximo.',
    manaRecoveryPercentBonus: 5,
  },
  discipline: {
    id: 'discipline',
    name: 'Disciplina',
    description: '+1 XP extra al completar hábitos.',
    habitXpBonus: 1,
  },
  fortune: {
    id: 'fortune',
    name: 'Fortuna',
    description: '+3 puntos porcentuales en la Forja.',
    forgeChanceBonus: 3,
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
    effectFamily: 'protection',
    image: 'relics/relic_01_corazon_hollin.webp',
    effectLabel: 'Reduce la primera fuente de daño del día.',
    affixPool: ['vitality', 'regeneration', 'fortune'],
  },
  {
    id: 'relic_02',
    rewardId: 'boss_reward_02',
    bossIndex: 1,
    name: 'Lágrima de Espectro',
    equipmentType: 'spirit',
    effectFamily: 'mana',
    image: 'relics/relic_02_lagrima_espectro.webp',
    effectLabel: 'El primer hábito completado del día recupera un porcentaje del Maná máximo.',
    affixPool: ['arcane', 'channeling', 'discipline'],
  },
  {
    id: 'relic_03',
    rewardId: 'boss_reward_03',
    bossIndex: 2,
    name: 'Daga de Alquitrán',
    equipmentType: 'dagger',
    effectFamily: 'experience',
    image: 'relics/relic_03_daga_alquitran.webp',
    effectLabel: 'El primer hábito completado del día concede XP adicional.',
    affixPool: ['discipline', 'fortune', 'arcane'],
  },
  {
    id: 'relic_04',
    rewardId: 'boss_reward_04',
    bossIndex: 3,
    name: 'Yelmo de la Última Brasa',
    equipmentType: 'helmet',
    effectFamily: 'experience',
    image: 'relics/relic_04_yelmo_ultima_brasa.webp',
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
    effectFamily: 'mana',
    image: 'relics/relic_05_frasco_antojo_roto.webp',
    effectLabel: 'Recupera Maná cada 30 minutos mientras está equipado.',
    affixPool: ['arcane', 'channeling', 'fortune'],
  },
  {
    id: 'relic_06',
    rewardId: 'boss_reward_06',
    bossIndex: 5,
    name: 'Colmillo de Nicotina',
    equipmentType: 'fang',
    effectFamily: 'experience',
    image: 'relics/relic_06_colmillo_nicotina.webp',
    effectLabel: 'Cada día cumplido concede XP adicional.',
    affixPool: ['discipline', 'vitality', 'fortune'],
  },
  {
    id: 'relic_07',
    rewardId: 'boss_reward_07',
    bossIndex: 6,
    name: 'Collar de la Ansiedad Rota',
    equipmentType: 'collar',
    effectFamily: 'experience',
    image: 'relics/relic_07_collar_ansiedad_rota.webp',
    effectLabel: 'Después de un día fallido, el siguiente día completado concede experiencia adicional. Una activación por semana.',
    affixPool: ['discipline', 'vitality', 'fortune'],
    valueUnit: 'XP',
  },
  {
    id: 'relic_08',
    rewardId: 'boss_reward_08',
    bossIndex: 7,
    name: 'Ojo de la Duda Petrificada',
    equipmentType: 'eye',
    effectFamily: 'coins',
    image: 'relics/relic_08_ojo_duda_petrificada.webp',
    effectLabel: 'El primer hábito difícil completado cada día concede oro adicional. Una activación diaria.',
    affixPool: ['fortune', 'discipline', 'vitality'],
    valueUnit: 'oro',
  },
  {
    id: 'relic_09',
    rewardId: 'boss_reward_09',
    bossIndex: 8,
    name: 'Malla de Escamas de Brea',
    equipmentType: 'armor',
    effectFamily: 'forge',
    image: 'relics/relic_09_malla_escamas_brea.webp',
    effectLabel: 'Cuando falla una mejora en la Forja, recupera una parte del oro invertido.',
    affixPool: ['fortune', 'regeneration', 'vitality'],
    valueUnit: '%',
  },
  {
    id: 'relic_10',
    rewardId: 'boss_reward_10',
    bossIndex: 9,
    name: 'Calavera de la Llama Muerta',
    equipmentType: 'skull',
    effectFamily: 'bosses',
    image: 'relics/relic_10_calavera_llama_muerta.webp',
    effectLabel: 'Al derrotar al jefe semanal, aumenta la probabilidad de recibir una unidad adicional de Sangre de Jefe.',
    affixPool: ['fortune', 'vitality', 'discipline'],
    valueUnit: 'puntos porcentuales',
  },
  {
    id: 'relic_11',
    rewardId: 'boss_reward_11',
    bossIndex: 10,
    name: 'Gargantilla de las Tres Fauces',
    equipmentType: 'choker',
    effectFamily: 'experience',
    image: 'relics/relic_11_gargantilla_tres_fauces.webp',
    effectLabel: 'Completar tres hábitos distintos durante el mismo día concede experiencia adicional. Una activación diaria.',
    affixPool: ['discipline', 'arcane', 'fortune'],
    valueUnit: 'XP',
  },
  {
    id: 'relic_12',
    rewardId: 'boss_reward_12',
    bossIndex: 11,
    name: 'Puño de Papel',
    equipmentType: 'fist',
    effectFamily: 'coins',
    image: 'relics/relic_12_puno_papel.webp',
    effectLabel: 'Completar todos los hábitos programados para el día concede oro adicional. Una activación diaria.',
    affixPool: ['fortune', 'discipline', 'vitality'],
    valueUnit: 'oro',
  },
];

export const FUSION_RELIC_DEFINITIONS = [
  {
    id: 'fusion_01',
    recipeId: 'fusion_recipe_01',
    ingredientIds: ['relic_01', 'relic_02'],
    name: 'Corazón Espectral',
    equipmentType: 'heart',
    image: 'relics/fusion_01_corazon_espectral.webp',
    effectLabel: 'Reduce la primera fuente de daño del día. El primer hábito recupera un porcentaje del Maná máximo y recibe 3 puntos porcentuales adicionales.',
    synergy: { type: 'first-habit-mana', value: 3 },
  },
  {
    id: 'fusion_02',
    recipeId: 'fusion_recipe_02',
    ingredientIds: ['relic_01', 'relic_04'],
    name: 'Yelmo del Corazón Ardiente',
    equipmentType: 'helmet',
    image: 'relics/fusion_02_yelmo_corazon_ardiente.webp',
    effectLabel: 'Reduce la primera fuente de daño del día. La Constancia concede XP y seis días cumplidos otorgan 20 XP adicionales.',
    synergy: { type: 'six-days-xp', value: 20 },
  },
  {
    id: 'fusion_04',
    recipeId: 'fusion_recipe_04',
    ingredientIds: ['relic_03', 'relic_05'],
    name: 'Daga del Antojo',
    equipmentType: 'dagger',
    image: 'relics/fusion_04_daga_antojo.webp',
    effectLabel: 'El primer hábito concede XP y recupera Maná cada 30 minutos. Completar todos los hábitos diarios otorga 5 XP adicionales.',
    synergy: { type: 'all-daily-habits-xp', value: 5 },
  },
  {
    id: 'fusion_06',
    recipeId: 'fusion_recipe_06',
    ingredientIds: ['relic_01', 'relic_07'],
    name: 'Nudo del Pulso Libre',
    equipmentType: 'collar',
    image: 'relics/fusion_06_nudo_pulso_libre.webp',
    effectLabel: 'Reduce la primera fuente de daño del día y concede XP al recuperarse de un día fallido. Si el escudo absorbe daño durante la recuperación y completas el día, obtienes 5 XP adicionales.',
    synergy: { type: 'recovery-shield-xp', values: { 1: 5, 2: 7, 3: 10 } },
  },
  {
    id: 'fusion_07',
    recipeId: 'fusion_recipe_07',
    ingredientIds: ['relic_02', 'relic_07'],
    name: 'Brújula del Regreso',
    equipmentType: 'collar',
    image: 'relics/fusion_07_brujula_regreso.webp',
    effectLabel: 'El primer hábito recupera un porcentaje del Maná máximo y concede XP al recuperarse de un día fallido. Si recuperas Maná durante la recuperación y completas el día, obtienes 5 XP adicionales.',
    synergy: { type: 'recovery-mana-xp', values: { 1: 5, 2: 7, 3: 10 } },
  },
  {
    id: 'fusion_08',
    recipeId: 'fusion_recipe_08',
    ingredientIds: ['relic_05', 'relic_07'],
    name: 'Anillo del Antojo Roto',
    equipmentType: 'collar',
    image: 'relics/fusion_08_anillo_antojo_roto.webp',
    effectLabel: 'Recupera Maná cada 30 minutos y concede XP al recuperarse de un día fallido. Si recuperas Maná durante esa recuperación y completas el día, obtienes XP adicional.',
    synergy: { type: 'recovery-periodic-mana-xp', values: { 1: 10, 2: 14, 3: 18 } },
  },
  {
    id: 'fusion_09',
    recipeId: 'fusion_recipe_09',
    ingredientIds: ['relic_01', 'relic_03'],
    name: 'Filo del Corazón Ardiente',
    equipmentType: 'dagger',
    image: 'relics/fusion_09_filo_corazon_ardiente.webp',
    effectLabel: 'Reduce el primer daño del día y concede XP con el primer hábito. Completarlo antes de consumir la protección otorga XP adicional.',
    synergy: { type: 'protected-first-habit-xp', values: { 1: 2, 2: 3, 3: 5 } },
  },
  {
    id: 'fusion_10',
    recipeId: 'fusion_recipe_10',
    ingredientIds: ['relic_01', 'relic_05'],
    name: 'Vasija del Pulso Carmesí',
    equipmentType: 'vessel',
    image: 'relics/fusion_10_vasija_pulso_carmesi.webp',
    effectLabel: 'Reduce el primer daño del día y recupera Maná cada 30 minutos. Al activar la protección recupera Maná adicional.',
    synergy: { type: 'shield-mana', values: { 1: 3, 2: 5, 3: 7 } },
  },
  {
    id: 'fusion_11',
    recipeId: 'fusion_recipe_11',
    ingredientIds: ['relic_01', 'relic_06'],
    name: 'Mandíbula del Pulso Ardiente',
    equipmentType: 'fang',
    image: 'relics/fusion_11_mandibula_pulso_ardiente.webp',
    effectLabel: 'Reduce el primer daño del día y concede XP por cada día cumplido. Completar el día tras activar la protección otorga XP adicional.',
    synergy: { type: 'shielded-day-xp', values: { 1: 5, 2: 7, 3: 10 } },
  },
  {
    id: 'fusion_12',
    recipeId: 'fusion_recipe_12',
    ingredientIds: ['relic_02', 'relic_03'],
    name: 'Hoja del Espectro',
    equipmentType: 'dagger',
    image: 'relics/fusion_12_hoja_espectro.webp',
    effectLabel: 'El primer hábito recupera Maná y concede XP. Al activar ambos efectos simultáneamente otorga XP adicional.',
    synergy: { type: 'first-habit-mana-xp', values: { 1: 2, 2: 3, 3: 5 } },
  },
  {
    id: 'fusion_13',
    recipeId: 'fusion_recipe_13',
    ingredientIds: ['relic_02', 'relic_04'],
    name: 'Yelmo del Espectro',
    equipmentType: 'helmet',
    image: 'relics/fusion_13_yelmo_espectro.webp',
    effectLabel: 'El primer hábito recupera Maná y la Constancia concede XP. Completar la Constancia otorga XP y recupera Maná adicionales.',
    synergy: {
      type: 'constancy-mana-xp',
      values: { 1: 10, 2: 15, 3: 20 },
      manaValues: { 1: 5, 2: 7, 3: 10 },
    },
  },
  {
    id: 'fusion_14',
    recipeId: 'fusion_recipe_14',
    ingredientIds: ['relic_02', 'relic_06'],
    name: 'Colmillo del Espectro',
    equipmentType: 'fang',
    image: 'relics/fusion_14_colmillo_espectro.webp',
    effectLabel: 'El primer hábito recupera Maná y cada día cumplido concede XP. Activar ambos efectos durante el mismo día otorga XP adicional.',
    synergy: { type: 'mana-day-xp', values: { 1: 5, 2: 7, 3: 10 } },
  },
  {
    id: 'fusion_15',
    recipeId: 'fusion_recipe_15',
    ingredientIds: ['relic_04', 'relic_05'],
    name: 'Yelmo del Antojo Roto',
    equipmentType: 'helmet',
    image: 'relics/fusion_15_yelmo_antojo_roto.webp',
    effectLabel: 'Recupera Maná cada 30 minutos y la Constancia concede XP. Completar la Constancia otorga XP y recupera Maná adicionales.',
    synergy: {
      type: 'constancy-periodic-mana-xp',
      values: { 1: 10, 2: 15, 3: 20 },
      manaValues: { 1: 5, 2: 7, 3: 10 },
    },
  },
  {
    id: 'fusion_16',
    recipeId: 'fusion_recipe_16',
    ingredientIds: ['relic_05', 'relic_06'],
    name: 'Colmillo del Antojo Roto',
    equipmentType: 'fang',
    image: 'relics/fusion_16_colmillo_antojo_roto.webp',
    effectLabel: 'Recupera Maná cada 30 minutos y concede XP por cada día cumplido. Recuperar Maná y completar el día otorga XP adicional.',
    synergy: { type: 'periodic-mana-day-xp', values: { 1: 5, 2: 7, 3: 10 } },
  },
];

export const PERMANENTLY_INCOMPATIBLE_FUSIONS = [
  ['relic_02', 'relic_05'],
  ['relic_03', 'relic_06'],
  ['relic_04', 'relic_06'],
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
  relic_04: { 1: 20, 2: 30, 3: 45 },
  relic_05: { 1: 30, 2: 45, 3: 60 },
  relic_06: { 1: 10, 2: 15, 3: 20 },
  relic_07: { 1: 20, 2: 30, 3: 45 },
  relic_08: { 1: 2, 2: 3, 3: 5 },
  relic_09: { 1: 20, 2: 30, 3: 40 },
  relic_10: { 1: 10, 2: 15, 3: 20 },
  relic_11: { 1: 12, 2: 18, 3: 25 },
  relic_12: { 1: 5, 2: 8, 3: 12 },
};

export const RELIC_COMBAT_STATS_BY_EQUIPMENT_TYPE = Object.freeze({
  heart: 'defense',
  helmet: 'defense',
  armor: 'defense',
  dagger: 'physicalAttack',
  fang: 'physicalAttack',
  fist: 'physicalAttack',
  spirit: 'magicAttack',
  vessel: 'magicAttack',
  collar: 'magicAttack',
  eye: 'magicAttack',
  skull: 'magicAttack',
  choker: 'magicAttack',
});

export const RELIC_COMBAT_BONUS_BY_RANK = Object.freeze({ 1: 0, 2: 1, 3: 2 });

// Algunos jefes comparten escalón de poder para mantener una progresión coherente
// con el orden real en que se obtienen sus reliquias.
export const RELIC_COMBAT_BASE_BONUS = Object.freeze({
  relic_05: 1,
  relic_07: 4,
});

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

export function relicCombatBonus(relicId, rank = 1) {
  const definition = relicDefinition(relicId);
  const stat = RELIC_COMBAT_STATS_BY_EQUIPMENT_TYPE[definition?.equipmentType];
  if (!stat) return { stat: null, value: 0 };
  const safeRank = Math.min(3, Math.max(1, Math.trunc(Number(rank) || 1)));
  const ingredientBossIndexes = Array.isArray(definition.ingredientIds)
    ? definition.ingredientIds
      .map((ingredientId) => relicDefinition(ingredientId)?.bossIndex)
      .filter(Number.isFinite)
    : [];
  const bossIndex = Number.isFinite(definition.bossIndex)
    ? definition.bossIndex
    : Math.max(0, ...ingredientBossIndexes);
  const progressionBonus = RELIC_COMBAT_BASE_BONUS[relicId]
    ?? Math.min(4, Math.floor(bossIndex / 3) + 1);
  return {
    stat,
    value: progressionBonus + RELIC_COMBAT_BONUS_BY_RANK[safeRank],
  };
}

export function relicCombatBonuses(relicId, rank = 1, ingredientSnapshots = {}) {
  const definition = relicDefinition(relicId);
  if (!Array.isArray(definition?.ingredientIds)) {
    const bonus = relicCombatBonus(relicId, rank);
    return bonus.stat ? [bonus] : [];
  }

  const totals = new Map();
  for (const ingredientId of definition.ingredientIds) {
    const ingredientRank = ingredientSnapshots?.[ingredientId]?.rank ?? rank;
    const bonus = relicCombatBonus(ingredientId, ingredientRank);
    if (!bonus.stat) continue;
    totals.set(bonus.stat, (totals.get(bonus.stat) || 0) + bonus.value);
  }
  return [...totals].map(([stat, value]) => ({ stat, value }));
}
