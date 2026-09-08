import { OUTFIT_DEFINITIONS, isOutfitUnlocked } from '../data/outfit-data.js';
import { FRAME_DEFINITIONS, isFrameUnlocked } from '../data/frame-data.js';
import { normalizeLootState } from './loot-rules.js';

export const BOSS_FIBER_BONUS_RATE = 0.25;
export const ARCANE_RESOURCE_SALE_PRICES = Object.freeze({ arcaneFibers: 10, arcaneInks: 14 });
export const ARCANE_RESOURCE_DAILY_DEMAND_RANGES = Object.freeze({
  arcaneFibers: Object.freeze({ min: 6, max: 15 }),
  arcaneInks: Object.freeze({ min: 4, max: 10 }),
});
const MAX_BOSS_FIBER_REWARDS = 21;

function deterministicRoll(seed = '') {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function slices(state) {
  return { economy: state.economy, loot: state.loot, inventory: state.inventory, forge: state.forge, shop: state.shop };
}

function localDayKey(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function nextLocalMidnight(timestamp) {
  const next = new Date(timestamp);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

export function arcaneResourceDailyDemand({ state, resourceId, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  const range = ARCANE_RESOURCE_DAILY_DEMAND_RANGES[resourceId];
  if (!range) return null;
  const day = localDayKey(nowTimestamp);
  const roll = deterministicRoll(`${normalized.forge.seed}|arcane-market|${resourceId}|${day}`);
  const capacity = range.min + Math.floor(roll * (range.max - range.min + 1));
  const sold = normalized.economy.transactions.reduce((total, entry) => {
    if (entry?.type !== 'arcane-resource-sale' || entry.resourceId !== resourceId) return total;
    if (localDayKey(Number(entry.at) || 0) !== day) return total;
    return total + Math.abs(Math.trunc(Number(entry.quantity) || 0));
  }, 0);
  return {
    resourceId,
    day,
    capacity,
    sold: Math.min(capacity, sold),
    remaining: Math.max(0, capacity - sold),
    resetsAt: nextLocalMidnight(nowTimestamp),
  };
}

export function bossFiberBase(bossIndex = 0) {
  return Math.min(6, 3 + Math.floor(Math.max(0, Number(bossIndex) || 0) / 4));
}

export function bossInkBase(bossIndex = 0) {
  return Math.min(5, 2 + Math.floor(Math.max(0, Number(bossIndex) || 0) / 4));
}

export function grantBossFiberReward({ state, cycleId, bossIndex = 0, randomValue = null, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  if (!cycleId) return { ...slices(normalized), granted: 0, inkGranted: 0 };
  const safeBossIndex = Math.max(0, Math.trunc(Number(bossIndex) || 0));
  const previousEntry = Object.entries(normalized.loot.bossFiberOutcomes).find(
    ([storedCycleId, outcome]) => storedCycleId === cycleId || (
      Number.isFinite(Number(outcome?.bossIndex))
      && Math.max(0, Math.trunc(Number(outcome.bossIndex))) === safeBossIndex
    ),
  );
  if (previousEntry) {
    const [storedCycleId, previous] = previousEntry;
    if (Object.prototype.hasOwnProperty.call(previous, 'arcaneInks')) {
      return { ...slices(normalized), granted: 0, inkGranted: 0, rewardCycleId: storedCycleId };
    }
    const inkGranted = bossInkBase(safeBossIndex);
    normalized.loot.bossFiberOutcomes[storedCycleId] = {
      ...previous,
      arcaneInks: inkGranted,
      inkGrantedAt: nowTimestamp,
    };
    normalized.economy.arcaneInks += inkGranted;
    normalized.economy.transactions.push({ id: `boss-ink:${storedCycleId}`, type: 'boss-ink', arcaneInks: inkGranted, at: nowTimestamp });
    normalized.economy.transactions = normalized.economy.transactions.slice(-200);
    return { ...slices(normalized), granted: 0, inkGranted, rewardCycleId: storedCycleId };
  }
  const base = bossFiberBase(safeBossIndex);
  const arcaneInks = bossInkBase(safeBossIndex);
  const roll = randomValue === null ? deterministicRoll(`${normalized.forge.seed}|boss-fiber|${cycleId}`) : Number(randomValue);
  const bonus = roll < BOSS_FIBER_BONUS_RATE ? 1 : 0;
  const granted = base + bonus;
  normalized.loot.bossFiberOutcomes[cycleId] = { cycleId, bossIndex: safeBossIndex, base, bonus, roll, granted, arcaneInks, resolvedAt: nowTimestamp };
  normalized.economy.arcaneFibers += granted;
  normalized.economy.arcaneInks += arcaneInks;
  normalized.economy.transactions.push({ id: `boss-forge-resources:${cycleId}`, type: 'boss-forge-resources', arcaneFibers: granted, arcaneInks, at: nowTimestamp });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return { ...slices(normalized), granted, inkGranted: arcaneInks, base, bonus, rewardCycleId: cycleId };
}

export function reconcileHistoricalBossFibers({
  state,
  bossesDown = 0,
  randomValues = [],
  nowTimestamp = Date.now(),
}) {
  let normalized = normalizeLootState(state);
  const maximum = Math.min(
    MAX_BOSS_FIBER_REWARDS,
    Math.max(0, Math.trunc(Number(bossesDown) || 0)),
  );
  let granted = 0;
  let inkGranted = 0;
  let bossCount = 0;
  for (let bossIndex = 0; bossIndex < maximum; bossIndex += 1) {
    const result = grantBossFiberReward({
      state: normalized,
      cycleId: `retroactive:boss-${bossIndex}`,
      bossIndex,
      randomValue: randomValues[bossIndex] ?? null,
      nowTimestamp,
    });
    normalized = normalizeLootState({ ...normalized, ...result });
    if (result.granted > 0 || result.inkGranted > 0) {
      const rewardCycleId = result.rewardCycleId || `retroactive:boss-${bossIndex}`;
      normalized.loot.bossFiberOutcomes[rewardCycleId] = {
        ...normalized.loot.bossFiberOutcomes[rewardCycleId],
        notifiedAt: nowTimestamp,
      };
      granted += result.granted;
      inkGranted += result.inkGranted;
      bossCount += 1;
    }
  }
  if (granted > 0 || inkGranted > 0) {
    normalized.loot.fiberCatchupNotice = {
      id: `boss-forge-catchup-v2:${nowTimestamp}`,
      arcaneFibers: granted,
      arcaneInks: inkGranted,
      bossCount,
      acknowledged: false,
      createdAt: nowTimestamp,
    };
  }
  return { ...slices(normalized), granted, inkGranted, bossCount };
}

export function pendingFiberCatchupNotice(state) {
  const notice = normalizeLootState(state).loot.fiberCatchupNotice;
  return notice && !notice.acknowledged && (notice.arcaneFibers > 0 || notice.arcaneInks > 0) ? notice : null;
}

export function acknowledgeFiberCatchupNotice(state, noticeId) {
  const normalized = normalizeLootState(state);
  if (normalized.loot.fiberCatchupNotice?.id === noticeId) {
    normalized.loot.fiberCatchupNotice = {
      ...normalized.loot.fiberCatchupNotice,
      acknowledged: true,
    };
  }
  return slices(normalized);
}

export function sellArcaneResource({ state, resourceId, quantity = 1, operationId, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  const price = ARCANE_RESOURCE_SALE_PRICES[resourceId];
  const safeQuantity = Math.max(1, Math.trunc(Number(quantity) || 1));
  if (!price || !operationId) return { ...slices(normalized), ok: false, reason: 'invalid' };
  if (normalized.economy.transactions.some((entry) => entry.id === `arcane-resource-sale:${operationId}`)) {
    return { ...slices(normalized), ok: false, reason: 'duplicate' };
  }
  const demand = arcaneResourceDailyDemand({ state: normalized, resourceId, nowTimestamp });
  if (!demand?.remaining || safeQuantity > demand.remaining) {
    return { ...slices(normalized), ok: false, reason: 'demand', demand };
  }
  if (normalized.economy[resourceId] < safeQuantity) {
    return { ...slices(normalized), ok: false, reason: 'empty' };
  }
  const coinValue = price * safeQuantity;
  normalized.economy[resourceId] -= safeQuantity;
  normalized.economy.coins += coinValue;
  normalized.economy.transactions.push({
    id: `arcane-resource-sale:${operationId}`,
    type: 'arcane-resource-sale',
    resourceId,
    quantity: -safeQuantity,
    coins: coinValue,
    at: nowTimestamp,
  });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return {
    ...slices(normalized),
    ok: true,
    resourceId,
    quantity: safeQuantity,
    coinValue,
    demand: { ...demand, sold: demand.sold + safeQuantity, remaining: demand.remaining - safeQuantity },
  };
}

export function weaveOutfit({ state, outfitId, operationId, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  const outfit = OUTFIT_DEFINITIONS.find((item) => (
    item.id === outfitId && item.released !== false && item.craftable && item.recipe
  ));
  if (!outfit || !operationId) return { ...slices(normalized), game: state.game, ok: false, reason: 'invalid' };
  if (isOutfitUnlocked(outfit, state.game)) return { ...slices(normalized), game: state.game, ok: false, reason: 'owned' };
  if (normalized.forge.weaving.history.some((entry) => entry.operationId === operationId)) {
    return { ...slices(normalized), game: state.game, ok: false, reason: 'duplicate' };
  }
  if (normalized.economy.coins < outfit.recipe.coins || normalized.economy.arcaneFibers < outfit.recipe.arcaneFibers) {
    return { ...slices(normalized), game: state.game, ok: false, reason: 'resources' };
  }
  normalized.economy.coins -= outfit.recipe.coins;
  normalized.economy.arcaneFibers -= outfit.recipe.arcaneFibers;
  normalized.economy.transactions.push({ id: `outfit-weave:${operationId}`, type: 'outfit-weave', coins: -outfit.recipe.coins, arcaneFibers: -outfit.recipe.arcaneFibers, at: nowTimestamp });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  normalized.forge.weaving.history.push({ operationId, outfitId, at: nowTimestamp });
  normalized.forge.weaving.history = normalized.forge.weaving.history.slice(-100);
  const game = {
    ...(state.game || {}),
    outfits: {
      ...(state.game?.outfits || {}),
      owned: {
        ...(state.game?.outfits?.owned || {}),
        [outfitId]: { acquiredAt: nowTimestamp, source: 'woven', operationId },
      },
    },
  };
  return { ...slices(normalized), game, ok: true, outfit };
}

export function paintFrame({ state, frameId, operationId, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  const frame = FRAME_DEFINITIONS.find((item) => item.id === frameId && item.released !== false && item.recipe);
  if (!frame || !operationId) return { ...slices(normalized), game: state.game, ok: false, reason: 'invalid' };
  if (isFrameUnlocked(frame, state.game)) return { ...slices(normalized), game: state.game, ok: false, reason: 'owned' };
  if (normalized.forge.weaving.history.some((entry) => entry.operationId === operationId)) {
    return { ...slices(normalized), game: state.game, ok: false, reason: 'duplicate' };
  }
  if (normalized.economy.coins < frame.recipe.coins || normalized.economy.arcaneInks < frame.recipe.arcaneInks) {
    return { ...slices(normalized), game: state.game, ok: false, reason: 'resources' };
  }
  normalized.economy.coins -= frame.recipe.coins;
  normalized.economy.arcaneInks -= frame.recipe.arcaneInks;
  normalized.economy.transactions.push({ id: `frame-paint:${operationId}`, type: 'frame-paint', coins: -frame.recipe.coins, arcaneInks: -frame.recipe.arcaneInks, at: nowTimestamp });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  normalized.forge.weaving.history.push({ operationId, frameId, at: nowTimestamp });
  normalized.forge.weaving.history = normalized.forge.weaving.history.slice(-100);
  const game = {
    ...(state.game || {}),
    frames: {
      ...(state.game?.frames || {}),
      owned: {
        ...(state.game?.frames?.owned || {}),
        [frameId]: { acquiredAt: nowTimestamp, source: 'painted', operationId },
      },
    },
  };
  return { ...slices(normalized), game, ok: true, frame };
}
