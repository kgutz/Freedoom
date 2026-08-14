import {
  AFFIX_DEFINITIONS,
  BOSS_BLOOD_DOUBLE_RATE,
  FORTUNE_CAP,
  FUSION_BLOOD_COST,
  FUSION_COIN_COST,
  FUSION_RELIC_DEFINITIONS,
  FORGE_BLOOD_REQUIREMENTS,
  FORGE_COSTS,
  FORGE_PROBABILITIES,
  LOOT_SCHEMA_VERSION,
  MAX_EQUIPPED_RELICS,
  MAX_INITIAL_RELICS,
  PERMANENTLY_INCOMPATIBLE_FUSIONS,
  RELIC_DROP_RATE,
  RARITY_ORDER,
  RARITIES,
  RELIC_DEFINITIONS,
  SHOP_MAX_VISIBLE_RELICS,
  SHOP_ROTATION_DAYS,
  bossReward,
  fusionDefinition,
  isBaseRelic,
  relicDefinition,
  relicRankEffect,
} from '../data/loot-data.js';
import { HABIT_DAILY_XP_CAP } from './habit-rules.js';

const objectOf = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const arrayOf = (value) => (Array.isArray(value) ? value : []);
const SHOP_ROTATION_MS = SHOP_ROTATION_DAYS * 24 * 60 * 60 * 1000;
const OUTCOME_STATUSES = new Set(['obtained', 'failed', 'purchased']);
const FUSION_HISTORY_LIMIT = 100;

function higherRarity(left = 'rare', right = 'rare') {
  return RARITY_ORDER.indexOf(right) > RARITY_ORDER.indexOf(left) ? right : left;
}

export function fusionRarityFromAffixes(baseRarity = 'rare', affixes = []) {
  const uniqueAffixCount = new Set(
    arrayOf(affixes).filter((affixId) => Boolean(AFFIX_DEFINITIONS[affixId])),
  ).size;
  const affixRarity = uniqueAffixCount >= 2
    ? 'mythic'
    : uniqueAffixCount === 1 ? 'legendary' : 'rare';
  return higherRarity(RARITIES[baseRarity] ? baseRarity : 'rare', affixRarity);
}

export function fusionPairKey(leftId, rightId) {
  return [String(leftId || ''), String(rightId || '')].sort().join('+');
}

export function emptyLootState() {
  return {
    economy: { coins: 0, bossBlood: 0, transactions: [] },
    loot: {
      schemaVersion: LOOT_SCHEMA_VERSION,
      claimedBossRewards: [],
      bossRelicOutcomes: {},
      notices: [],
      migrationComplete: false,
    },
    inventory: {
      relics: {},
      collection: {},
      equipped: [],
      dailyActivations: {},
      weeklyActivations: {},
      constancy: { cycleId: '', charge: 0 },
    },
    forge: {
      seed: '',
      attempts: {},
      history: [],
      fusion: { discoveredRecipes: [], history: [], dailyActivations: {}, weeklyActivations: {} },
    },
    shop: {
      schemaVersion: 1,
      rotation: null,
      purchases: [],
    },
  };
}

function normalizeRelicRecord(id, value) {
  const relic = objectOf(value);
  const rarity = RARITIES[relic.rarity] ? relic.rarity : 'rare';
  const definition = relicDefinition(id);
  const fusion = Boolean(definition?.recipeId);
  const affixes = [...new Set(arrayOf(relic.affixes))]
    .filter((affixId) => Boolean(AFFIX_DEFINITIONS[affixId]));
  const normalizedRarity = fusion ? fusionRarityFromAffixes(rarity, affixes) : rarity;
  const inheritedEffects = Object.fromEntries(
    Object.entries(objectOf(relic.inheritedEffects))
      .filter(([baseId]) => isBaseRelic(baseId))
      .map(([baseId, effect]) => [baseId, Math.max(0, Number(effect) || 0)]),
  );
  const ingredientSnapshots = Object.fromEntries(
    Object.entries(objectOf(relic.ingredientSnapshots))
      .filter(([baseId]) => isBaseRelic(baseId))
      .map(([baseId, snapshot]) => {
        const safe = objectOf(snapshot);
        const safeRarity = RARITIES[safe.rarity] ? safe.rarity : 'rare';
        return [baseId, {
          rarity: safeRarity,
          rank: Math.min(3, Math.max(1, Number(safe.rank) || 1)),
          affixes: [...new Set(arrayOf(safe.affixes))]
            .filter((affixId) => Boolean(AFFIX_DEFINITIONS[affixId])),
          effectValue: Math.max(0, Number(safe.effectValue) || 0),
        }];
      }),
  );
  return {
    unlocked: relic.unlocked !== false,
    rarity: normalizedRarity,
    rank: fusion ? 1 : Math.min(3, Math.max(1, Number(relic.rank) || 1)),
    affixes: affixes.slice(0,
      fusion ? Object.keys(AFFIX_DEFINITIONS).length : RARITIES[rarity].affixCount),
    obtainedAt: Number(relic.obtainedAt) || 0,
    bossIndex: Number.isFinite(relic.bossIndex)
      ? relic.bossIndex
      : definition?.bossIndex,
    ...(fusion ? {
      kind: 'fusion',
      recipeId: definition.recipeId,
      ingredientIds: [...definition.ingredientIds],
      inheritedEffects,
      ingredientSnapshots,
    } : {}),
  };
}

function collectionEntry(id, value, fallbackRelic = null) {
  const raw = objectOf(value);
  const historical = raw.lastOwnedRecord || fallbackRelic;
  return {
    discoveredAt: Math.max(0, Number(raw.discoveredAt) || Number(fallbackRelic?.obtainedAt) || 0),
    kind: fusionDefinition(id) ? 'fusion' : 'base',
    ...(historical ? { lastOwnedRecord: normalizeRelicRecord(id, historical) } : {}),
  };
}

export function normalizeLootState(state = {}) {
  const defaults = emptyLootState();
  const economy = objectOf(state.economy);
  const loot = objectOf(state.loot);
  const inventory = objectOf(state.inventory);
  const forge = objectOf(state.forge);
  const shop = objectOf(state.shop);
  const relics = Object.fromEntries(
    Object.entries(objectOf(inventory.relics))
      .filter(([id]) => Boolean(relicDefinition(id)))
      .map(([id, value]) => {
        return [id, normalizeRelicRecord(id, value)];
      }),
  );
  const collection = Object.fromEntries(
    Object.entries(objectOf(inventory.collection))
      .filter(([id]) => Boolean(relicDefinition(id)))
      .map(([id, value]) => [id, collectionEntry(id, value)]),
  );
  Object.entries(relics).forEach(([id, relic]) => {
    collection[id] = collectionEntry(id, collection[id], relic);
    collection[id].lastOwnedRecord = relic;
  });
  const claimedBossRewards = new Set(arrayOf(loot.claimedBossRewards));
  const bossRelicOutcomes = {};
  for (const [rewardId, rawOutcome] of Object.entries(objectOf(loot.bossRelicOutcomes))) {
    const definition = RELIC_DEFINITIONS.find((item) => item.rewardId === rewardId);
    const outcome = objectOf(rawOutcome);
    if (!definition || !OUTCOME_STATUSES.has(outcome.status)) continue;
    bossRelicOutcomes[rewardId] = {
      status: outcome.status,
      relicId: definition.id,
      resolvedAt: Math.max(0, Number(outcome.resolvedAt) || 0),
      source: typeof outcome.source === 'string' ? outcome.source : 'migration',
      ...(outcome.relic ? { relic: normalizeRelicRecord(definition.id, outcome.relic) } : {}),
      ...(outcome.purchasedAt ? { purchasedAt: Number(outcome.purchasedAt) || 0 } : {}),
      ...(outcome.operationId ? { operationId: String(outcome.operationId) } : {}),
    };
  }
  for (const definition of RELIC_DEFINITIONS) {
    if (relics[definition.id]) {
      claimedBossRewards.add(definition.rewardId);
      if (!bossRelicOutcomes[definition.rewardId]) {
        bossRelicOutcomes[definition.rewardId] = {
          status: 'obtained', relicId: definition.id, resolvedAt: 0, source: 'legacy',
        };
      }
    } else if (claimedBossRewards.has(definition.rewardId) && !bossRelicOutcomes[definition.rewardId]) {
      bossRelicOutcomes[definition.rewardId] = {
        status: 'obtained', relicId: definition.id, resolvedAt: 0, source: 'legacy',
      };
    }
  }
  const equippedTypes = new Set();
  const equipped = [...new Set(arrayOf(inventory.equipped))]
    .filter((id) => relics[id]?.unlocked)
    .filter((id) => {
      const equipmentType = relicDefinition(id)?.equipmentType;
      if (!equipmentType || !equippedTypes.has(equipmentType)) {
        if (equipmentType) equippedTypes.add(equipmentType);
        return true;
      }
      return false;
    })
    .slice(0, MAX_EQUIPPED_RELICS);
  return {
    economy: {
      coins: Math.max(0, Math.trunc(Number(economy.coins) || 0)),
      bossBlood: Math.max(0, Math.trunc(Number(economy.bossBlood) || 0)),
      transactions: arrayOf(economy.transactions).slice(-200),
    },
    loot: {
      schemaVersion: Math.max(
        LOOT_SCHEMA_VERSION,
        Number(loot.schemaVersion) || 0,
      ),
      claimedBossRewards: [...claimedBossRewards],
      bossRelicOutcomes,
      notices: arrayOf(loot.notices).map((notice) => ({
        ...notice,
        relicIds: arrayOf(notice?.relicIds).filter((id) => Boolean(relicDefinition(id))),
        failedRelicIds: arrayOf(notice?.failedRelicIds)
          .filter((id) => Boolean(relicDefinition(id))),
        results: arrayOf(notice?.results).map((result) => ({ ...result })),
      })),
      migrationComplete: loot.migrationComplete === true,
    },
    inventory: {
      relics,
      collection,
      equipped,
      dailyActivations: { ...objectOf(inventory.dailyActivations) },
      weeklyActivations: { ...objectOf(inventory.weeklyActivations) },
      constancy: {
        cycleId: typeof inventory.constancy?.cycleId === 'string'
          ? inventory.constancy.cycleId
          : '',
        charge: Math.min(
          6,
          Math.max(0, Math.trunc(Number(inventory.constancy?.charge) || 0)),
        ),
      },
    },
    forge: {
      seed: typeof forge.seed === 'string' ? forge.seed : '',
      attempts: { ...objectOf(forge.attempts) },
      history: arrayOf(forge.history).slice(-100),
      fusion: (() => {
        const fusion = objectOf(forge.fusion);
        const validRecipeIds = new Set(FUSION_RELIC_DEFINITIONS.map((item) => item.recipeId));
        const history = arrayOf(fusion.history)
          .filter((entry) => validRecipeIds.has(entry?.recipeId))
          .map((entry) => ({ ...entry }))
          .slice(-FUSION_HISTORY_LIMIT);
        history.forEach((entry) => {
          const definition = fusionDefinition(entry.recipeId);
          if (!definition) return;
          if (!collection[definition.id]) {
            collection[definition.id] = collectionEntry(definition.id, {
              discoveredAt: entry.at,
              lastOwnedRecord: entry.result,
            });
          }
          Object.entries(objectOf(entry.ingredients)).forEach(([id, relic]) => {
            if (isBaseRelic(id) && !collection[id]) {
              collection[id] = collectionEntry(id, { discoveredAt: entry.at, lastOwnedRecord: relic });
            }
          });
        });
        return {
          discoveredRecipes: [...new Set(arrayOf(fusion.discoveredRecipes))]
            .filter((id) => validRecipeIds.has(id)),
          history,
          dailyActivations: { ...objectOf(fusion.dailyActivations) },
          weeklyActivations: { ...objectOf(fusion.weeklyActivations) },
        };
      })(),
    },
    shop: {
      schemaVersion: Math.max(1, Number(shop.schemaVersion) || 0),
      rotation: (() => {
        const rotation = objectOf(shop.rotation);
        if (!Number.isInteger(rotation.period)) return null;
        const startedAt = Math.max(0, Number(rotation.startedAt) || 0);
        const endsAt = Math.max(0, Number(rotation.endsAt) || 0);
        if (endsAt <= startedAt) return null;
        return {
          period: Math.max(0, rotation.period),
          startedAt,
          endsAt,
          relicIds: [...new Set(arrayOf(rotation.relicIds))]
            .filter((id) => Boolean(relicDefinition(id)))
            .slice(0, SHOP_MAX_VISIBLE_RELICS),
        };
      })(),
      purchases: arrayOf(shop.purchases).map((purchase) => ({ ...purchase })).slice(-100),
    },
  };
}

export function rarityFromRoll(roll) {
  const safe = Math.min(0.999999999, Math.max(0, Number(roll) || 0));
  if (safe < RARITIES.rare.rate) return 'rare';
  if (safe < RARITIES.rare.rate + RARITIES.legendary.rate) {
    return 'legendary';
  }
  return 'mythic';
}

export function rollAffixes(pool, count, random = Math.random) {
  const available = [...new Set(pool)].filter((id) => AFFIX_DEFINITIONS[id]);
  const result = [];
  while (result.length < count && available.length) {
    const index = Math.min(
      available.length - 1,
      Math.floor(Math.max(0, Math.min(0.999999999, random())) * available.length),
    );
    result.push(available.splice(index, 1)[0]);
  }
  return result;
}

export function rollRelic(relicId, random = Math.random, obtainedAt = Date.now()) {
  const definition = relicDefinition(relicId);
  if (!definition) throw new Error('Reliquia desconocida');
  const rarity = rarityFromRoll(random());
  return {
    unlocked: true,
    rarity,
    rank: 1,
    affixes: rollAffixes(
      definition.affixPool,
      RARITIES[rarity].affixCount,
      random,
    ),
    obtainedAt,
    bossIndex: definition.bossIndex,
  };
}

export function hashString(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deterministicRandom(seed, index = 0) {
  let value = hashString(`${seed}:${index}`) || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

function legacyForgeSeed(state = {}) {
  const config = objectOf(state.config);
  const game = objectOf(state.game);
  const identity = [
    'freedoom-forge-legacy-v1',
    config.startDate || '',
    config.startLimit || '',
    game.name || '',
    game.cls || '',
  ].join('|');
  return `legacy-${hashString(identity).toString(36)}-${hashString(`${identity}:seed`).toString(36)}`;
}

export function createForgeSeed(randomSource = globalThis.crypto) {
  if (randomSource?.getRandomValues) {
    const values = new Uint32Array(4);
    randomSource.getRandomValues(values);
    return `forge-${Array.from(values, (value) => value.toString(36)).join('-')}`;
  }
  const fallback = `${Math.random()}:${Math.random()}:${Date.now()}`;
  return `forge-${hashString(fallback).toString(36)}-${hashString(`${fallback}:seed`).toString(36)}`;
}

export function initializeForgeSeed(state = {}, seed = null) {
  const normalized = normalizeLootState(state);
  if (!normalized.forge.seed) {
    const hasExistingJourney = state.onboarded === true || Boolean(state.game?.cls);
    normalized.forge.seed = String(
      seed || (hasExistingJourney ? legacyForgeSeed(state) : createForgeSeed()),
    );
  }
  return normalized;
}

export function forgeAttemptRoll(seed, relicId, targetRank, logicalAttemptNumber) {
  return deterministicRandom(
    `forge:v1:${seed}:${relicId}:rank-${targetRank}:attempt-${logicalAttemptNumber}`,
  );
}

export function deterministicRelicRoll(relicId, seed, obtainedAt = 0) {
  let index = 0;
  return rollRelic(
    relicId,
    () => deterministicRandom(`${seed}:${relicId}`, index++),
    obtainedAt,
  );
}

function noticeForRewards(rewards, source, nowTimestamp) {
  return {
    id: `${source}:${rewards.map((reward) => reward.rewardId).join(',')}`,
    source,
    rewardIds: rewards.map((reward) => reward.rewardId),
    relicIds: rewards.filter((reward) => reward.obtained).map((reward) => reward.relicId),
    failedRelicIds: rewards.filter((reward) => !reward.obtained).map((reward) => reward.relicId),
    results: rewards.map((reward) => ({
      rewardId: reward.rewardId,
      relicId: reward.relicId,
      obtained: reward.obtained,
      rarity: reward.rarity,
    })),
    coins: rewards.reduce((total, reward) => total + reward.coins, 0),
    bossBlood: rewards.reduce((total, reward) => total + reward.bossBlood, 0),
    bonusBossBlood: rewards.reduce((total, reward) => total + reward.bonusBossBlood, 0),
    acknowledged: false,
    createdAt: nowTimestamp,
  };
}

export function grantBossRewards({
  state,
  bossesDown,
  source = 'victory',
  seed = '',
  random = null,
  dropRandom = random,
  relicRandom = random,
  bloodRandom = random,
  nowTimestamp = Date.now(),
}) {
  const normalized = normalizeLootState(state);
  const claimed = new Set(normalized.loot.claimedBossRewards);
  const rewards = [];
  const maximum = Math.min(
    MAX_INITIAL_RELICS,
    Math.max(0, Math.trunc(Number(bossesDown) || 0)),
  );
  for (let bossIndex = 0; bossIndex < maximum; bossIndex += 1) {
    const definition = RELIC_DEFINITIONS[bossIndex];
    if (!definition || claimed.has(definition.rewardId)) continue;
    const guaranteedLegacyReward = source === 'retroactive';
    const dropRoll = typeof dropRandom === 'function'
      ? dropRandom()
      : deterministicRandom(`${seed}:${definition.rewardId}:drop`);
    const obtained = guaranteedLegacyReward ||
      Math.max(0, Math.min(0.999999999, dropRoll)) < RELIC_DROP_RATE;
    const relic = guaranteedLegacyReward
      ? deterministicRelicRoll(
          definition.id,
          `${seed}:${definition.rewardId}`,
          nowTimestamp,
        )
      : typeof relicRandom === 'function'
        ? rollRelic(definition.id, relicRandom, nowTimestamp)
        : deterministicRelicRoll(
            definition.id,
            `${seed}:${definition.rewardId}:relic`,
            nowTimestamp,
          );
    const reward = bossReward(bossIndex);
    if (!reward) continue;
    const { coins } = reward;
    const bloodRoll = source === 'victory'
      ? typeof bloodRandom === 'function'
        ? bloodRandom()
        : deterministicRandom(`${seed}:${definition.rewardId}:blood`)
      : 1;
    const bloodDoubled = source === 'victory' &&
      Math.max(0, Math.min(0.999999999, bloodRoll)) < BOSS_BLOOD_DOUBLE_RATE;
    const bonusBossBlood = bloodDoubled ? reward.bossBlood : 0;
    const bossBlood = reward.bossBlood + bonusBossBlood;
    if (obtained) {
      normalized.inventory.relics[definition.id] = relic;
      normalized.inventory.collection[definition.id] = collectionEntry(
        definition.id,
        normalized.inventory.collection[definition.id],
        relic,
      );
      normalized.inventory.collection[definition.id].lastOwnedRecord = relic;
    }
    normalized.economy.coins += coins;
    normalized.economy.bossBlood += bossBlood;
    normalized.economy.transactions.push({
      id: `${definition.rewardId}:grant`,
      type: 'boss-reward',
      rewardId: definition.rewardId,
      coins,
      bossBlood,
      baseBossBlood: reward.bossBlood,
      bonusBossBlood,
      relicOutcome: obtained ? 'obtained' : 'failed',
      at: nowTimestamp,
    });
    normalized.loot.claimedBossRewards.push(definition.rewardId);
    normalized.loot.bossRelicOutcomes[definition.rewardId] = {
      status: obtained ? 'obtained' : 'failed',
      relicId: definition.id,
      resolvedAt: nowTimestamp,
      source,
      relic,
    };
    claimed.add(definition.rewardId);
    rewards.push({
      rewardId: definition.rewardId,
      relicId: definition.id,
      rarity: relic.rarity,
      affixes: [...relic.affixes],
      obtained,
      coins,
      bossBlood,
      baseBossBlood: reward.bossBlood,
      bonusBossBlood,
    });
  }
  if (rewards.length) {
    normalized.loot.notices.push(noticeForRewards(rewards, source, nowTimestamp));
  }
  if (source === 'retroactive') normalized.loot.migrationComplete = true;
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return { ...normalized, rewards };
}

export function acknowledgeLootNotice(lootState, noticeId) {
  const normalized = normalizeLootState(lootState);
  normalized.loot.notices = normalized.loot.notices.map((notice) =>
    notice.id === noticeId ? { ...notice, acknowledged: true } : notice,
  );
  return normalized;
}

export function pendingLootNotice(lootState) {
  return normalizeLootState(lootState).loot.notices.find(
    (notice) => !notice.acknowledged,
  ) || null;
}

function failedRelicIds(normalized) {
  return RELIC_DEFINITIONS
    .filter((definition) =>
      normalized.loot.bossRelicOutcomes[definition.rewardId]?.status === 'failed' &&
      !normalized.inventory.relics[definition.id])
    .map((definition) => definition.id);
}

function recoverableRelicIds(normalized) {
  const failed = failedRelicIds(normalized);
  const consumed = RELIC_DEFINITIONS
    .filter((definition) =>
      !normalized.inventory.relics[definition.id] &&
      normalized.inventory.collection[definition.id]?.lastOwnedRecord &&
      normalized.forge.fusion.history.some((entry) =>
        Boolean(entry.ingredients?.[definition.id])))
    .map((definition) => definition.id);
  return [...new Set([...failed, ...consumed])];
}

function rotationSelection(relicIds, period) {
  const sorted = [...new Set(relicIds)].sort();
  if (sorted.length <= SHOP_MAX_VISIBLE_RELICS) return sorted;
  const offset = period % sorted.length;
  return Array.from({ length: SHOP_MAX_VISIBLE_RELICS }, (_, index) =>
    sorted[(offset + index) % sorted.length]);
}

export function ensureShopRotation(lootState, nowTimestamp = Date.now()) {
  const normalized = normalizeLootState(lootState);
  const safeNow = Math.max(0, Number(nowTimestamp) || 0);
  const previous = normalized.shop.rotation;
  const pending = recoverableRelicIds(normalized);
  const elapsedPeriods = previous && safeNow >= previous.endsAt
    ? Math.floor((safeNow - previous.endsAt) / SHOP_ROTATION_MS) + 1
    : 0;
  const effectivePeriod = previous ? previous.period + elapsedPeriods : 0;
  const startedAt = previous
    ? previous.startedAt + elapsedPeriods * SHOP_ROTATION_MS
    : safeNow;
  const periodChanged = !previous || elapsedPeriods > 0;
  let relicIds = periodChanged
    ? rotationSelection(pending, effectivePeriod)
    : [...previous.relicIds];
  if (!periodChanged && relicIds.length < SHOP_MAX_VISIBLE_RELICS) {
    const additions = rotationSelection(
      pending.filter((id) => !relicIds.includes(id)),
      effectivePeriod,
    );
    relicIds = [...relicIds, ...additions]
      .slice(0, SHOP_MAX_VISIBLE_RELICS);
  }
  normalized.shop.rotation = {
    period: effectivePeriod,
    startedAt,
    endsAt: startedAt + SHOP_ROTATION_MS,
    relicIds,
  };
  return normalized;
}

export function shopPriceForRelic(relicId, source = 'failed') {
  const definition = relicDefinition(relicId);
  const reward = definition ? bossReward(definition.bossIndex) : null;
  if (!reward) return null;
  const normalCoinPrice = reward.coins * 2;
  return {
    coinPrice: source === 'fusion-consumed'
      ? Math.round(normalCoinPrice * 1.25)
      : normalCoinPrice,
    bloodPrice: reward.bossBlood,
  };
}

export function shopOffers(lootState, nowTimestamp = Date.now()) {
  const normalized = ensureShopRotation(lootState, nowTimestamp);
  return normalized.shop.rotation.relicIds
    .map((relicId) => {
      const definition = relicDefinition(relicId);
      const outcome = definition
        ? normalized.loot.bossRelicOutcomes[definition.rewardId]
        : null;
      const collection = normalized.inventory.collection[relicId];
      const consumed = Boolean(collection?.lastOwnedRecord) &&
        normalized.forge.fusion.history.some((entry) => Boolean(entry.ingredients?.[relicId]));
      const source = outcome?.status === 'failed'
        ? 'failed'
        : consumed ? 'fusion-consumed' : null;
      const price = definition && source ? shopPriceForRelic(definition.id, source) : null;
      if (!definition || !price || !source || normalized.inventory.relics[relicId]) return null;
      const historicalRelic = source === 'failed' ? outcome?.relic : collection.lastOwnedRecord;
      return {
        relicId,
        definition,
        relic: normalizeRelicRecord(relicId, historicalRelic),
        bossIndex: definition.bossIndex,
        source,
        ...price,
      };
    })
    .filter(Boolean);
}

export function purchaseShopRelic({
  state,
  relicId,
  operationId,
  nowTimestamp = Date.now(),
}) {
  const normalized = ensureShopRotation(state, nowTimestamp);
  if (!operationId) return { ...normalized, ok: false, reason: 'missing-operation' };
  if (normalized.shop.purchases.some((entry) => entry.operationId === operationId) ||
      normalized.economy.transactions.some((entry) => entry.id === `shop:${operationId}`)) {
    return { ...normalized, ok: false, reason: 'duplicate-operation' };
  }
  const offer = shopOffers(normalized, nowTimestamp)
    .find((candidate) => candidate.relicId === relicId);
  if (!offer) return { ...normalized, ok: false, reason: 'unavailable' };
  if (normalized.economy.coins < offer.coinPrice) {
    return { ...normalized, ok: false, reason: 'coins', offer };
  }
  if (normalized.economy.bossBlood < offer.bloodPrice) {
    return { ...normalized, ok: false, reason: 'blood', offer };
  }
  normalized.economy.coins -= offer.coinPrice;
  normalized.economy.bossBlood -= offer.bloodPrice;
  normalized.inventory.relics[relicId] = {
    ...offer.relic,
    unlocked: true,
    obtainedAt: nowTimestamp,
  };
  normalized.inventory.collection[relicId] = collectionEntry(
    relicId,
    normalized.inventory.collection[relicId],
    normalized.inventory.relics[relicId],
  );
  normalized.inventory.collection[relicId].lastOwnedRecord = normalized.inventory.relics[relicId];
  const outcome = normalized.loot.bossRelicOutcomes[offer.definition.rewardId];
  if (offer.source === 'failed') {
    normalized.loot.bossRelicOutcomes[offer.definition.rewardId] = {
      ...outcome,
      status: 'purchased',
      purchasedAt: nowTimestamp,
      operationId,
    };
  }
  const purchase = {
    id: `shop:${operationId}`,
    operationId,
    relicId,
    rewardId: offer.definition.rewardId,
    source: offer.source,
    coinsSpent: offer.coinPrice,
    bossBloodSpent: offer.bloodPrice,
    at: nowTimestamp,
  };
  normalized.shop.purchases.push(purchase);
  normalized.shop.purchases = normalized.shop.purchases.slice(-100);
  normalized.economy.transactions.push({
    ...purchase,
    type: 'shop_purchase',
    coins: -offer.coinPrice,
    bossBlood: -offer.bloodPrice,
  });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return { ...normalized, ok: true, purchase, relic: normalized.inventory.relics[relicId] };
}

export function payClassChange({
  state,
  fromClass,
  toClass,
  operationId,
  nowTimestamp = Date.now(),
}) {
  const normalized = normalizeLootState(state);
  if (!operationId) return { ...normalized, ok: false, reason: 'missing-operation' };
  if (!fromClass || !toClass || fromClass === toClass) {
    return { ...normalized, ok: false, reason: 'same-class' };
  }
  const transactionId = `class-change:${operationId}`;
  if (normalized.economy.transactions.some((entry) => entry.id === transactionId)) {
    return { ...normalized, ok: false, reason: 'duplicate-operation' };
  }
  if (normalized.economy.bossBlood < 1) {
    return { ...normalized, ok: false, reason: 'blood' };
  }
  normalized.economy.bossBlood -= 1;
  const transaction = {
    id: transactionId,
    operationId,
    type: 'class_change',
    fromClass,
    toClass,
    coins: 0,
    bossBlood: -1,
    bossBloodSpent: 1,
    at: nowTimestamp,
  };
  normalized.economy.transactions.push(transaction);
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return { ...normalized, ok: true, spentBossBlood: 1, transaction };
}

function rarityForFusion(ingredients, affixes) {
  const highestIngredientRarity = Object.values(ingredients)
    .reduce((best, relic) => higherRarity(best, relic.rarity), 'rare');
  return fusionRarityFromAffixes(highestIngredientRarity, affixes);
}

function ingredientSnapshot(relicId, relic) {
  return {
    rarity: relic.rarity,
    rank: relic.rank,
    affixes: [...relic.affixes],
    effectValue: relicRankEffect(relicId, relic.rank),
  };
}

export function fusionRecipeStatus(leftId, rightId) {
  if (!leftId || !rightId) return { status: 'incomplete', definition: null };
  if (leftId === rightId) return { status: 'same-relic', definition: null };
  const pairKey = fusionPairKey(leftId, rightId);
  const definition = FUSION_RELIC_DEFINITIONS.find((recipe) =>
    fusionPairKey(...recipe.ingredientIds) === pairKey) || null;
  if (definition) return { status: 'available', definition };
  const incompatible = PERMANENTLY_INCOMPATIBLE_FUSIONS.some((pair) =>
    fusionPairKey(...pair) === pairKey);
  return { status: incompatible ? 'incompatible' : 'not-designed', definition: null };
}

export function fusionPreview(lootState, leftId, rightId) {
  const normalized = normalizeLootState(lootState);
  const recipe = fusionRecipeStatus(leftId, rightId);
  const ownsLeft = Boolean(normalized.inventory.relics[leftId]);
  const ownsRight = Boolean(normalized.inventory.relics[rightId]);
  const baseIngredients = isBaseRelic(leftId) && isBaseRelic(rightId);
  const previewIngredients = ownsLeft && ownsRight
    ? {
        [leftId]: normalized.inventory.relics[leftId],
        [rightId]: normalized.inventory.relics[rightId],
      }
    : null;
  const resultAffixes = previewIngredients
    ? [...new Set(Object.values(previewIngredients).flatMap((relic) => relic.affixes))]
    : [];
  const resultRarity = previewIngredients
    ? rarityForFusion(previewIngredients, resultAffixes)
    : null;
  const discovered = Boolean(recipe.definition &&
    normalized.forge.fusion.discoveredRecipes.includes(recipe.definition.recipeId));
  let reason = null;
  if (recipe.status !== 'available') reason = recipe.status;
  else if (!baseIngredients) reason = 'base-only';
  else if (normalized.inventory.relics[recipe.definition.id]) reason = 'already-owned';
  else if (!ownsLeft || !ownsRight) reason = 'missing-ingredients';
  else if (normalized.economy.coins < FUSION_COIN_COST) reason = 'coins';
  else if (normalized.economy.bossBlood < FUSION_BLOOD_COST) reason = 'blood';
  return {
    ok: reason === null,
    reason,
    status: recipe.status,
    definition: recipe.definition,
    discovered,
    ingredientIds: [leftId, rightId].filter(Boolean),
    coinCost: FUSION_COIN_COST,
    bloodCost: FUSION_BLOOD_COST,
    coinsAvailable: normalized.economy.coins,
    bloodAvailable: normalized.economy.bossBlood,
    resultRarity,
    resultAffixes,
  };
}

export function fuseRelics({
  state,
  leftId,
  rightId,
  operationId,
  nowTimestamp = Date.now(),
}) {
  const normalized = normalizeLootState(state);
  if (!operationId) return { ...normalized, ok: false, reason: 'missing-operation' };
  if (normalized.forge.fusion.history.some((entry) => entry.operationId === operationId) ||
      normalized.economy.transactions.some((entry) => entry.id === `fusion:${operationId}`)) {
    return { ...normalized, ok: false, reason: 'duplicate-operation' };
  }
  const preview = fusionPreview(normalized, leftId, rightId);
  if (!preview.ok) return { ...normalized, ok: false, ...preview };
  const definition = preview.definition;
  const ingredients = Object.fromEntries(definition.ingredientIds.map((id) => [
    id,
    { ...normalized.inventory.relics[id], affixes: [...normalized.inventory.relics[id].affixes] },
  ]));
  const ingredientSnapshots = Object.fromEntries(
    Object.entries(ingredients).map(([id, relic]) => [id, ingredientSnapshot(id, relic)]),
  );
  const inheritedEffects = Object.fromEntries(
    Object.entries(ingredientSnapshots).map(([id, snapshot]) => [id, snapshot.effectValue]),
  );
  const affixes = [...new Set(Object.values(ingredients).flatMap((relic) => relic.affixes))];
  const fusedRelic = normalizeRelicRecord(definition.id, {
    unlocked: true,
    kind: 'fusion',
    recipeId: definition.recipeId,
    rarity: rarityForFusion(ingredients, affixes),
    rank: 1,
    affixes,
    obtainedAt: nowTimestamp,
    ingredientSnapshots,
    inheritedEffects,
  });
  const newlyDiscovered = !normalized.forge.fusion.discoveredRecipes.includes(definition.recipeId);
  definition.ingredientIds.forEach((id) => {
    normalized.inventory.collection[id] = collectionEntry(
      id,
      normalized.inventory.collection[id],
      ingredients[id],
    );
    normalized.inventory.collection[id].lastOwnedRecord = ingredients[id];
    delete normalized.inventory.relics[id];
  });
  normalized.inventory.equipped = normalized.inventory.equipped.filter(
    (id) => !definition.ingredientIds.includes(id),
  );
  normalized.inventory.relics[definition.id] = fusedRelic;
  normalized.inventory.collection[definition.id] = collectionEntry(
    definition.id,
    { discoveredAt: nowTimestamp, lastOwnedRecord: fusedRelic },
    fusedRelic,
  );
  normalized.economy.coins -= FUSION_COIN_COST;
  normalized.economy.bossBlood -= FUSION_BLOOD_COST;
  if (newlyDiscovered) normalized.forge.fusion.discoveredRecipes.push(definition.recipeId);
  const historyEntry = {
    id: `fusion:${operationId}`,
    operationId,
    recipeId: definition.recipeId,
    resultRelicId: definition.id,
    ingredientIds: [...definition.ingredientIds],
    ingredients,
    result: fusedRelic,
    coinsSpent: FUSION_COIN_COST,
    bossBloodSpent: FUSION_BLOOD_COST,
    newlyDiscovered,
    at: nowTimestamp,
  };
  normalized.forge.fusion.history.push(historyEntry);
  normalized.forge.fusion.history = normalized.forge.fusion.history.slice(-FUSION_HISTORY_LIMIT);
  normalized.economy.transactions.push({
    id: `fusion:${operationId}`,
    operationId,
    type: 'relic_fusion',
    recipeId: definition.recipeId,
    resultRelicId: definition.id,
    coins: -FUSION_COIN_COST,
    bossBlood: -FUSION_BLOOD_COST,
    at: nowTimestamp,
  });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return {
    ...normalized,
    ok: true,
    preview,
    fusedRelic,
    historyEntry,
    newlyDiscovered,
    spentCoins: FUSION_COIN_COST,
    spentBossBlood: FUSION_BLOOD_COST,
  };
}

export function equipRelic(lootState, relicId, replaceIndex = null) {
  const normalized = normalizeLootState(lootState);
  if (!normalized.inventory.relics[relicId]?.unlocked) {
    return { ...normalized, ok: false, reason: 'locked' };
  }
  if (normalized.inventory.equipped.includes(relicId)) {
    return { ...normalized, ok: false, reason: 'already-equipped' };
  }
  const validReplaceIndex = Number.isInteger(replaceIndex) &&
    replaceIndex >= 0 && replaceIndex < MAX_EQUIPPED_RELICS;
  const equipmentType = relicDefinition(relicId)?.equipmentType || '';
  const conflictingRelicId = normalized.inventory.equipped.find((equippedId, index) =>
    (!validReplaceIndex || index !== replaceIndex) &&
    equipmentType && relicDefinition(equippedId)?.equipmentType === equipmentType);
  if (conflictingRelicId) {
    return {
      ...normalized,
      ok: false,
      reason: 'equipment-type-conflict',
      equipmentType,
      conflictingRelicId,
    };
  }
  if (normalized.inventory.equipped.length < MAX_EQUIPPED_RELICS) {
    normalized.inventory.equipped.push(relicId);
  } else if (validReplaceIndex) {
    normalized.inventory.equipped[replaceIndex] = relicId;
  } else {
    return { ...normalized, ok: false, reason: 'slots-full' };
  }
  return { ...normalized, ok: true };
}

export function unequipRelic(lootState, relicId) {
  const normalized = normalizeLootState(lootState);
  normalized.inventory.equipped = normalized.inventory.equipped.filter(
    (id) => id !== relicId,
  );
  return { ...normalized, ok: true };
}

export function equippedRelicBonuses(lootState) {
  const normalized = normalizeLootState(lootState);
  const result = {
    maxHp: 0,
    maxMana: 0,
    regenerationMinutesReduction: 0,
    manaRecoveryBonus: 0,
    habitXpBonus: 0,
    fortune: 0,
    rankEffects: {},
  };
  for (const relicId of normalized.inventory.equipped) {
    const relic = normalized.inventory.relics[relicId];
    if (!relic) continue;
    result.rankEffects[relicId] = relicRankEffect(relicId, relic.rank);
    for (const affixId of relic.affixes) {
      const affix = AFFIX_DEFINITIONS[affixId];
      result.maxHp += affix?.maxHp || 0;
      result.maxMana += affix?.maxMana || 0;
      result.regenerationMinutesReduction +=
        affix?.regenerationMinutesReduction || 0;
      result.manaRecoveryBonus += affix?.manaRecoveryBonus || 0;
      result.habitXpBonus += affix?.habitXpBonus || 0;
      result.fortune += affix?.forgeChanceBonus || 0;
    }
  }
  result.fortune = Math.min(FORTUNE_CAP, result.fortune);
  return result;
}

export function equippedRelicEffectSources(lootState, baseRelicId) {
  const normalized = normalizeLootState(lootState);
  return normalized.inventory.equipped.flatMap((relicId) => {
    const relic = normalized.inventory.relics[relicId];
    if (!relic) return [];
    if (relicId === baseRelicId) {
      return [{ relicId, baseRelicId, value: relicRankEffect(baseRelicId, relic.rank) }];
    }
    const value = Number(relic.inheritedEffects?.[baseRelicId]);
    return value > 0 ? [{ relicId, baseRelicId, value }] : [];
  });
}

export function effectActivationKey(sourceRelicId, baseRelicId, periodKey) {
  return sourceRelicId === baseRelicId
    ? activationKey(baseRelicId, periodKey)
    : `${sourceRelicId}:${baseRelicId}:${periodKey}`;
}

export function availableDailyEffectSources(lootState, baseRelicId, dayKey) {
  const normalized = normalizeLootState(lootState);
  return equippedRelicEffectSources(normalized, baseRelicId).filter((source) =>
    !normalized.inventory.dailyActivations[
      effectActivationKey(source.relicId, baseRelicId, dayKey)
    ]);
}

export function markDailyEffectSources(lootState, baseRelicId, dayKey, sources, value = true) {
  const normalized = normalizeLootState(lootState);
  arrayOf(sources).forEach((source) => {
    normalized.inventory.dailyActivations[
      effectActivationKey(source.relicId, baseRelicId, dayKey)
    ] = value;
  });
  return normalized;
}

export function activationKey(relicId, periodKey) {
  return `${relicId}:${periodKey}`;
}

export function isRelicEquipped(lootState, relicId) {
  return normalizeLootState(lootState).inventory.equipped.includes(relicId);
}

export function canActivateDailyRelic(lootState, relicId, dayKey) {
  const normalized = normalizeLootState(lootState);
  return normalized.inventory.equipped.includes(relicId) &&
    !normalized.inventory.dailyActivations[activationKey(relicId, dayKey)];
}

export function markDailyRelicActivation(lootState, relicId, dayKey) {
  const normalized = normalizeLootState(lootState);
  normalized.inventory.dailyActivations[activationKey(relicId, dayKey)] = true;
  return normalized;
}

export function constancyCharge(outcomes = []) {
  let charge = 0;
  for (const outcome of arrayOf(outcomes)) {
    if (outcome === 'hit') charge = Math.min(6, charge + 1);
    else if (outcome === 'fail') charge = 0;
  }
  return charge;
}

export function constancyActivationKey(cycleId) {
  return `relic_04:constancy:${cycleId}`;
}

export function syncRelicConstancy(lootState, { cycleId, outcomes = [] }) {
  const normalized = normalizeLootState(lootState);
  const activationKey = constancyActivationKey(cycleId);
  const alreadyActivated = Boolean(normalized.inventory.weeklyActivations[activationKey]) ||
    Object.keys(normalized.inventory.weeklyActivations).some((key) =>
      key.endsWith(`:constancy:${cycleId}`));
  normalized.inventory.constancy = {
    cycleId,
    charge: alreadyActivated
      ? 0
      : constancyCharge(outcomes),
  };
  return normalized;
}

export function activateRelicConstancy({
  state,
  cycleId,
  outcomes = [],
  bossWon = false,
  nowTimestamp = Date.now(),
}) {
  const normalized = syncRelicConstancy(state, { cycleId, outcomes });
  const activationKey = constancyActivationKey(cycleId);
  if (!bossWon) return { ...normalized, activated: false, xp: 0, activationKey };
  let xp = 0;
  const activations = [];
  if (normalized.inventory.constancy.charge >= 6) {
    for (const source of equippedRelicEffectSources(normalized, 'relic_04')) {
      const key = source.relicId === 'relic_04'
        ? activationKey
        : `${source.relicId}:constancy:${cycleId}`;
      if (normalized.inventory.weeklyActivations[key]) continue;
      normalized.inventory.weeklyActivations[key] = {
        type: 'constancy', cycleId, relicId: source.relicId, xp: source.value, at: nowTimestamp,
      };
      xp += source.value;
      activations.push(key);
    }
  }
  const fulfilledDays = arrayOf(outcomes).filter((outcome) => outcome === 'hit').length;
  for (const fusionId of ['fusion_02', 'fusion_05']) {
    if (!normalized.inventory.equipped.includes(fusionId) || fulfilledDays < 6) continue;
    const definition = fusionDefinition(fusionId);
    const key = `${fusionId}:six-days:${cycleId}`;
    if (!definition || normalized.forge.fusion.weeklyActivations[key]) continue;
    const bonus = definition.synergy.value;
    normalized.forge.fusion.weeklyActivations[key] = {
      type: definition.synergy.type, cycleId, relicId: fusionId, xp: bonus, at: nowTimestamp,
    };
    xp += bonus;
    activations.push(key);
  }
  if (activations.length) normalized.inventory.constancy.charge = 0;
  return {
    ...normalized,
    activated: activations.length > 0,
    xp,
    activationKey,
    activations,
  };
}

export function fusionDailyKey(fusionId, effect, dayKey) {
  return `${fusionId}:${effect}:${dayKey}`;
}

export function canActivateFusionDaily(lootState, fusionId, effect, dayKey) {
  const normalized = normalizeLootState(lootState);
  const key = fusionDailyKey(fusionId, effect, dayKey);
  return normalized.inventory.equipped.includes(fusionId) &&
    !normalized.forge.fusion.dailyActivations[key];
}

export function markFusionDaily(lootState, fusionId, effect, dayKey, value = true) {
  const normalized = normalizeLootState(lootState);
  normalized.forge.fusion.dailyActivations[
    fusionDailyKey(fusionId, effect, dayKey)
  ] = value;
  return normalized;
}

export function awardFusionAllHabitsXp({
  state,
  habitState,
  dayKey,
  cap = HABIT_DAILY_XP_CAP,
}) {
  const normalized = normalizeLootState(state);
  const habits = objectOf(habitState);
  const items = arrayOf(habits.items);
  const entries = { ...objectOf(habits.entries) };
  if (!canActivateFusionDaily(normalized, 'fusion_04', 'all-habits', dayKey)) {
    return { ...normalized, habitState: { ...habits, items, entries }, activated: false, xp: 0 };
  }
  const daily = items.filter((habit) => habit?.active !== false && habit?.frequency === 'daily');
  const periodKey = `d:${dayKey}`;
  const complete = daily.length > 0 && daily.every((habit) =>
    (Number(entries[`${habit.id}|${periodKey}`]?.count) || 0) >=
      Math.max(1, Number(habit.target) || 1));
  if (!complete) {
    return { ...normalized, habitState: { ...habits, items, entries }, activated: false, xp: 0 };
  }
  const used = Object.values(entries).reduce((total, entry) =>
    entry?.frequency === 'daily' && entry?.periodKey === periodKey
      ? total + Math.max(0, Number(entry.xpAwarded) || 0)
      : total, 0);
  const xp = Math.min(5, Math.max(0, Math.trunc(Number(cap) || 0) - used));
  if (xp <= 0) {
    return { ...normalized, habitState: { ...habits, items, entries }, activated: false, xp: 0 };
  }
  entries[`fusion_04|${periodKey}`] = {
    habitId: 'fusion_04', periodKey, frequency: 'daily', count: 1, xpAwarded: xp, source: 'fusion',
  };
  const marked = markFusionDaily(normalized, 'fusion_04', 'all-habits', dayKey, xp);
  return {
    ...marked,
    habitState: { ...habits, items, entries },
    activated: true,
    xp,
  };
}

export function forgePreview(lootState, relicId) {
  const normalized = normalizeLootState(lootState);
  const relic = normalized.inventory.relics[relicId];
  if (!relic) return { ok: false, reason: 'locked' };
  if (!isBaseRelic(relicId)) return { ok: false, reason: 'fusion-not-upgradeable', relic };
  if (relic.rank >= 3) return { ok: false, reason: 'max-rank', relic };
  const targetRank = relic.rank + 1;
  const attemptKey = `${relicId}:rank-${targetRank}`;
  const failures = Math.max(0, Number(normalized.forge.attempts[attemptKey]) || 0);
  const probabilities = FORGE_PROBABILITIES[targetRank];
  const pityProbability = probabilities[Math.min(failures, probabilities.length - 1)];
  const fortune = equippedRelicBonuses(normalized).fortune;
  return {
    ok: true,
    relic,
    targetRank,
    attemptKey,
    failures,
    cost: FORGE_COSTS[targetRank],
    bloodRequired: FORGE_BLOOD_REQUIREMENTS[targetRank],
    pityProbability,
    fortune,
    finalProbability: Math.min(100, pityProbability + fortune),
    coinsAvailable: normalized.economy.coins,
    bloodAvailable: normalized.economy.bossBlood,
  };
}

export function attemptForge({
  state,
  relicId,
  operationId,
  randomValue = null,
  nowTimestamp = Date.now(),
}) {
  const normalized = normalizeLootState(state);
  if (!operationId) return { ...normalized, ok: false, reason: 'missing-operation' };
  if (normalized.forge.history.some((entry) => entry.operationId === operationId)) {
    return { ...normalized, ok: false, reason: 'duplicate-operation' };
  }
  const preview = forgePreview(normalized, relicId);
  if (!preview.ok) return { ...normalized, ...preview };
  if (normalized.economy.coins < preview.cost) {
    return { ...normalized, ok: false, reason: 'coins', preview };
  }
  if (normalized.economy.bossBlood < preview.bloodRequired) {
    return { ...normalized, ok: false, reason: 'blood', preview };
  }
  if (!normalized.forge.seed) normalized.forge.seed = legacyForgeSeed(state);
  const logicalAttemptNumber = preview.failures + 1;
  const resolvedRandomValue = Number.isFinite(randomValue)
    ? randomValue
    : forgeAttemptRoll(
        normalized.forge.seed,
        relicId,
        preview.targetRank,
        logicalAttemptNumber,
      );
  normalized.economy.coins -= preview.cost;
  const success = Math.max(0, Math.min(0.999999999, resolvedRandomValue)) <
    preview.finalProbability / 100;
  const bossBloodSpent = success ? preview.bloodRequired : 0;
  if (success) {
    normalized.economy.bossBlood = Math.max(
      0,
      normalized.economy.bossBlood - bossBloodSpent,
    );
    normalized.inventory.relics[relicId] = {
      ...normalized.inventory.relics[relicId],
      rank: preview.targetRank,
    };
    delete normalized.forge.attempts[preview.attemptKey];
  } else {
    normalized.forge.attempts[preview.attemptKey] = preview.failures + 1;
  }
  const nextPreview = success ? null : forgePreview(normalized, relicId);
  const historyEntry = {
    id: `forge:${operationId}`,
    operationId,
    relicId,
    previousRank: preview.targetRank - 1,
    newRank: success ? preview.targetRank : preview.targetRank - 1,
    targetRank: preview.targetRank,
    attemptKey: preview.attemptKey,
    logicalAttemptNumber,
    roll: resolvedRandomValue,
    coinsSpent: preview.cost,
    cost: preview.cost,
    bloodRequired: preview.bloodRequired,
    bossBloodSpent,
    bloodConsumed: bossBloodSpent,
    probability: preview.finalProbability,
    success,
    at: nowTimestamp,
  };
  normalized.forge.history.push(historyEntry);
  normalized.forge.history = normalized.forge.history.slice(-100);
  normalized.economy.transactions.push({
    id: `forge:${operationId}:coins`,
    type: success ? 'forge_success' : 'forge_failure',
    relicId,
    previousRank: preview.targetRank - 1,
    newRank: success ? preview.targetRank : preview.targetRank - 1,
    coinsSpent: preview.cost,
    bossBloodSpent,
    coins: -preview.cost,
    bossBlood: bossBloodSpent ? -bossBloodSpent : 0,
    success,
    at: nowTimestamp,
  });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return {
    ...normalized,
    ok: true,
    success,
    spentCoins: preview.cost,
    spentBossBlood: bossBloodSpent,
    preview,
    nextProbability: nextPreview?.finalProbability || null,
  };
}
