import {
  AFFIX_DEFINITIONS,
  BOSS_BLOOD_REWARD,
  BOSS_COIN_REWARDS,
  FORTUNE_CAP,
  FORGE_BLOOD_REQUIREMENTS,
  FORGE_COSTS,
  FORGE_PROBABILITIES,
  LOOT_SCHEMA_VERSION,
  MAX_EQUIPPED_RELICS,
  MAX_INITIAL_RELICS,
  RARITIES,
  RELIC_DEFINITIONS,
  relicDefinition,
  relicRankEffect,
} from '../data/loot-data.js';

const objectOf = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const arrayOf = (value) => (Array.isArray(value) ? value : []);

export function emptyLootState() {
  return {
    economy: { coins: 0, bossBlood: 0, transactions: [] },
    loot: {
      schemaVersion: LOOT_SCHEMA_VERSION,
      claimedBossRewards: [],
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
  };
}

export function normalizeLootState(state = {}) {
  const defaults = emptyLootState();
  const economy = objectOf(state.economy);
  const loot = objectOf(state.loot);
  const inventory = objectOf(state.inventory);
  const forge = objectOf(state.forge);
  const relics = Object.fromEntries(
    Object.entries(objectOf(inventory.relics))
      .filter(([id]) => Boolean(relicDefinition(id)))
      .map(([id, value]) => {
        const relic = objectOf(value);
        const rarity = RARITIES[relic.rarity] ? relic.rarity : 'rare';
        return [id, {
          unlocked: relic.unlocked !== false,
          rarity,
          rank: Math.min(3, Math.max(1, Number(relic.rank) || 1)),
          affixes: [...new Set(arrayOf(relic.affixes))]
            .filter((id) => Boolean(AFFIX_DEFINITIONS[id]))
            .slice(0, RARITIES[rarity].affixCount),
          obtainedAt: Number(relic.obtainedAt) || 0,
          bossIndex: Number.isFinite(relic.bossIndex)
            ? relic.bossIndex
            : relicDefinition(id)?.bossIndex,
        }];
      }),
  );
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
      claimedBossRewards: [...new Set(arrayOf(loot.claimedBossRewards))],
      notices: arrayOf(loot.notices).map((notice) => ({ ...notice })),
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
    relicIds: rewards.map((reward) => reward.relicId),
    coins: rewards.reduce((total, reward) => total + reward.coins, 0),
    bossBlood: rewards.reduce((total, reward) => total + reward.bossBlood, 0),
    acknowledged: false,
    createdAt: nowTimestamp,
  };
}

export function grantBossRewards({
  state,
  bossesDown,
  source = 'victory',
  seed = '',
  random = Math.random,
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
    const relic = source === 'retroactive'
      ? deterministicRelicRoll(
          definition.id,
          `${seed}:${definition.rewardId}`,
          nowTimestamp,
        )
      : rollRelic(definition.id, random, nowTimestamp);
    const coins = BOSS_COIN_REWARDS[bossIndex];
    normalized.inventory.relics[definition.id] = relic;
    normalized.economy.coins += coins;
    normalized.economy.bossBlood += BOSS_BLOOD_REWARD;
    normalized.economy.transactions.push({
      id: `${definition.rewardId}:grant`,
      type: 'boss-reward',
      rewardId: definition.rewardId,
      coins,
      bossBlood: BOSS_BLOOD_REWARD,
      at: nowTimestamp,
    });
    normalized.loot.claimedBossRewards.push(definition.rewardId);
    claimed.add(definition.rewardId);
    rewards.push({
      rewardId: definition.rewardId,
      relicId: definition.id,
      rarity: relic.rarity,
      affixes: [...relic.affixes],
      coins,
      bossBlood: BOSS_BLOOD_REWARD,
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
  if (success) {
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
    targetRank: preview.targetRank,
    cost: preview.cost,
    bloodRequired: preview.bloodRequired,
    bloodConsumed: 0,
    probability: preview.finalProbability,
    success,
    at: nowTimestamp,
  };
  normalized.forge.history.push(historyEntry);
  normalized.forge.history = normalized.forge.history.slice(-100);
  normalized.economy.transactions.push({
    id: `forge:${operationId}:coins`,
    type: 'forge',
    relicId,
    coins: -preview.cost,
    bossBlood: 0,
    success,
    at: nowTimestamp,
  });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return {
    ...normalized,
    ok: true,
    success,
    spentCoins: preview.cost,
    preview,
    nextProbability: nextPreview?.finalProbability || null,
  };
}
