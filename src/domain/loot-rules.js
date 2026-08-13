import {
  AFFIX_DEFINITIONS,
  BOSS_BLOOD_DOUBLE_RATE,
  FORTUNE_CAP,
  FORGE_BLOOD_REQUIREMENTS,
  FORGE_COSTS,
  FORGE_PROBABILITIES,
  LOOT_SCHEMA_VERSION,
  MAX_EQUIPPED_RELICS,
  MAX_INITIAL_RELICS,
  RELIC_DROP_RATE,
  RARITIES,
  RELIC_DEFINITIONS,
  SHOP_MAX_VISIBLE_RELICS,
  SHOP_ROTATION_DAYS,
  bossReward,
  relicDefinition,
  relicRankEffect,
} from '../data/loot-data.js';

const objectOf = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const arrayOf = (value) => (Array.isArray(value) ? value : []);
const SHOP_ROTATION_MS = SHOP_ROTATION_DAYS * 24 * 60 * 60 * 1000;
const OUTCOME_STATUSES = new Set(['obtained', 'failed', 'purchased']);

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
      equipped: [],
      dailyActivations: {},
      weeklyActivations: {},
    },
    forge: { attempts: {}, history: [] },
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
  return {
    unlocked: relic.unlocked !== false,
    rarity,
    rank: Math.min(3, Math.max(1, Number(relic.rank) || 1)),
    affixes: [...new Set(arrayOf(relic.affixes))]
      .filter((affixId) => Boolean(AFFIX_DEFINITIONS[affixId]))
      .slice(0, RARITIES[rarity].affixCount),
    obtainedAt: Number(relic.obtainedAt) || 0,
    bossIndex: Number.isFinite(relic.bossIndex)
      ? relic.bossIndex
      : relicDefinition(id)?.bossIndex,
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
  const equipped = [...new Set(arrayOf(inventory.equipped))]
    .filter((id) => relics[id]?.unlocked)
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
      equipped,
      dailyActivations: { ...objectOf(inventory.dailyActivations) },
      weeklyActivations: { ...objectOf(inventory.weeklyActivations) },
    },
    forge: {
      attempts: { ...objectOf(forge.attempts) },
      history: arrayOf(forge.history).slice(-100),
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
    if (obtained) normalized.inventory.relics[definition.id] = relic;
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
  const pending = failedRelicIds(normalized);
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

export function shopPriceForRelic(relicId) {
  const definition = relicDefinition(relicId);
  const reward = definition ? bossReward(definition.bossIndex) : null;
  return reward ? { coinPrice: reward.coins * 2, bloodPrice: reward.bossBlood } : null;
}

export function shopOffers(lootState, nowTimestamp = Date.now()) {
  const normalized = ensureShopRotation(lootState, nowTimestamp);
  return normalized.shop.rotation.relicIds
    .map((relicId) => {
      const definition = relicDefinition(relicId);
      const outcome = definition
        ? normalized.loot.bossRelicOutcomes[definition.rewardId]
        : null;
      const price = definition ? shopPriceForRelic(definition.id) : null;
      if (!definition || !price || outcome?.status !== 'failed' ||
          normalized.inventory.relics[relicId]) return null;
      return {
        relicId,
        definition,
        relic: normalizeRelicRecord(relicId, outcome.relic),
        bossIndex: definition.bossIndex,
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
  const outcome = normalized.loot.bossRelicOutcomes[offer.definition.rewardId];
  normalized.loot.bossRelicOutcomes[offer.definition.rewardId] = {
    ...outcome,
    status: 'purchased',
    purchasedAt: nowTimestamp,
    operationId,
  };
  const purchase = {
    id: `shop:${operationId}`,
    operationId,
    relicId,
    rewardId: offer.definition.rewardId,
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

export function equipRelic(lootState, relicId, replaceIndex = null) {
  const normalized = normalizeLootState(lootState);
  if (!normalized.inventory.relics[relicId]?.unlocked) {
    return { ...normalized, ok: false, reason: 'locked' };
  }
  if (normalized.inventory.equipped.includes(relicId)) {
    return { ...normalized, ok: false, reason: 'already-equipped' };
  }
  if (normalized.inventory.equipped.length < MAX_EQUIPPED_RELICS) {
    normalized.inventory.equipped.push(relicId);
  } else if (
    Number.isInteger(replaceIndex) &&
    replaceIndex >= 0 &&
    replaceIndex < MAX_EQUIPPED_RELICS
  ) {
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

export function forgePreview(lootState, relicId) {
  const normalized = normalizeLootState(lootState);
  const relic = normalized.inventory.relics[relicId];
  if (!relic) return { ok: false, reason: 'locked' };
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
  randomValue = Math.random(),
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
  normalized.economy.coins -= preview.cost;
  const success = Math.max(0, Math.min(0.999999999, randomValue)) <
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
