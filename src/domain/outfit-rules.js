import { OUTFIT_DEFINITIONS, isOutfitUnlocked } from '../data/outfit-data.js';
import { FRAME_DEFINITIONS, isFrameUnlocked } from '../data/frame-data.js';
import { normalizeLootState } from './loot-rules.js';

export const HABIT_FIBER_DROP_RATES = Object.freeze({ easy: 0.06, medium: 0.12, hard: 0.18 });
export const BOSS_FIBER_BONUS_RATE = 0.25;
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

export function bossFiberBase(bossIndex = 0) {
  return Math.min(6, 3 + Math.floor(Math.max(0, Number(bossIndex) || 0) / 4));
}

export function resolveHabitFiberDrop({ state, habit, periodKey, becameCompleted, becameIncomplete = false, randomValue = null, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  if ((!becameCompleted && !becameIncomplete) || !habit?.id || !periodKey) return { ...slices(normalized), granted: 0, revoked: 0 };
  const outcomeId = `${habit.id}|${periodKey}`;
  const previous = normalized.loot.habitFiberOutcomes[outcomeId];
  if (previous) {
    const previousStatus = previous.status || (previous.granted ? 'available' : 'missed');
    if (becameIncomplete && previous.granted && previousStatus === 'available') {
      const revoked = normalized.economy.arcaneFibers > 0 ? 1 : 0;
      normalized.loot.habitFiberOutcomes[outcomeId] = {
        ...previous,
        status: revoked ? 'revoked' : 'spent',
        revokedAt: nowTimestamp,
      };
      if (revoked) {
        normalized.economy.arcaneFibers -= 1;
        normalized.economy.transactions.push({ id: `habit-fiber-revoke:${outcomeId}:${nowTimestamp}`, type: 'habit-fiber-revoke', arcaneFibers: -1, at: nowTimestamp });
        normalized.economy.transactions = normalized.economy.transactions.slice(-200);
      }
      return { ...slices(normalized), granted: 0, revoked };
    }
    if (becameCompleted && previous.granted && previousStatus === 'revoked') {
      normalized.loot.habitFiberOutcomes[outcomeId] = { ...previous, status: 'available', restoredAt: nowTimestamp };
      normalized.economy.arcaneFibers += 1;
      normalized.economy.transactions.push({ id: `habit-fiber-restore:${outcomeId}:${nowTimestamp}`, type: 'habit-fiber-restore', arcaneFibers: 1, at: nowTimestamp });
      normalized.economy.transactions = normalized.economy.transactions.slice(-200);
      return { ...slices(normalized), granted: 1, revoked: 0 };
    }
    return { ...slices(normalized), granted: 0, revoked: 0 };
  }
  if (!becameCompleted) return { ...slices(normalized), granted: 0, revoked: 0 };
  const rate = HABIT_FIBER_DROP_RATES[habit.difficulty] || 0;
  const roll = randomValue === null ? deterministicRoll(`${normalized.forge.seed}|habit-fiber|${outcomeId}`) : Number(randomValue);
  const granted = roll < rate ? 1 : 0;
  normalized.loot.habitFiberOutcomes[outcomeId] = { habitId: habit.id, periodKey, rate, roll, granted, status: granted ? 'available' : 'missed', resolvedAt: nowTimestamp };
  if (granted) {
    normalized.economy.arcaneFibers += granted;
    normalized.economy.transactions.push({ id: `habit-fiber:${outcomeId}`, type: 'habit-fiber', arcaneFibers: granted, at: nowTimestamp });
    normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  }
  return { ...slices(normalized), granted, revoked: 0 };
}

export function grantBossFiberReward({ state, cycleId, bossIndex = 0, randomValue = null, nowTimestamp = Date.now() }) {
  const normalized = normalizeLootState(state);
  if (!cycleId) return { ...slices(normalized), granted: 0 };
  if (normalized.loot.bossFiberOutcomes[cycleId]) return { ...slices(normalized), granted: 0 };
  const safeBossIndex = Math.max(0, Math.trunc(Number(bossIndex) || 0));
  if (Object.values(normalized.loot.bossFiberOutcomes).some(
    (outcome) => Number.isFinite(Number(outcome?.bossIndex))
      && Math.max(0, Math.trunc(Number(outcome.bossIndex))) === safeBossIndex,
  )) return { ...slices(normalized), granted: 0 };
  const base = bossFiberBase(safeBossIndex);
  const roll = randomValue === null ? deterministicRoll(`${normalized.forge.seed}|boss-fiber|${cycleId}`) : Number(randomValue);
  const bonus = roll < BOSS_FIBER_BONUS_RATE ? 1 : 0;
  const granted = base + bonus;
  normalized.loot.bossFiberOutcomes[cycleId] = { cycleId, bossIndex: safeBossIndex, base, bonus, roll, granted, resolvedAt: nowTimestamp };
  normalized.economy.arcaneFibers += granted;
  normalized.economy.transactions.push({ id: `boss-fiber:${cycleId}`, type: 'boss-fiber', arcaneFibers: granted, at: nowTimestamp });
  normalized.economy.transactions = normalized.economy.transactions.slice(-200);
  return { ...slices(normalized), granted, base, bonus };
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
    if (result.granted > 0) {
      const cycleId = `retroactive:boss-${bossIndex}`;
      normalized.loot.bossFiberOutcomes[cycleId] = {
        ...normalized.loot.bossFiberOutcomes[cycleId],
        notifiedAt: nowTimestamp,
      };
      granted += result.granted;
      bossCount += 1;
    }
  }
  if (granted > 0) {
    normalized.loot.fiberCatchupNotice = {
      id: `boss-fiber-catchup-v1:${nowTimestamp}`,
      arcaneFibers: granted,
      bossCount,
      acknowledged: false,
      createdAt: nowTimestamp,
    };
  }
  return { ...slices(normalized), granted, bossCount };
}

export function pendingFiberCatchupNotice(state) {
  const notice = normalizeLootState(state).loot.fiberCatchupNotice;
  return notice && !notice.acknowledged && notice.arcaneFibers > 0 ? notice : null;
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
  const frame = FRAME_DEFINITIONS.find((item) => item.id === frameId && item.recipe);
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
