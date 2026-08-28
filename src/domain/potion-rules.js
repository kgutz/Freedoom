import {
  POTION_BLOOD_CHANCES,
  POTION_BAG_SLOT_LIMIT,
  POTION_BONUS_CAPS,
  POTION_BY_ID,
  POTION_DAILY_LIMITS,
  POTION_DURATION_MS,
} from '../data/potion-data.js';
import {
  habitEntryKey,
  habitPeriodKey,
  habitProgressCoinSchedule,
  habitProgressXpSchedule,
} from './habit-rules.js';

function objectOf(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function emptyPotionState() {
  return { owned: {}, active: null, dailyUses: {}, bloodPrepared: {}, purchases: [] };
}

export function normalizePotionState(value) {
  const raw = objectOf(value);
  const active = objectOf(raw.active);
  const activeDefinition = POTION_BY_ID[active.id];
  return {
    owned: Object.fromEntries(Object.keys(POTION_BY_ID).map((id) => [
      id, Math.max(0, Math.trunc(Number(objectOf(raw.owned)[id]) || 0)),
    ])),
    active: activeDefinition && ['fortune', 'experience'].includes(active.id) &&
      Number(active.endsAt) > Number(active.startedAt)
      ? {
          id: active.id,
          dayKey: String(active.dayKey || ''),
          startedAt: Math.max(0, Number(active.startedAt) || 0),
          endsAt: Math.max(0, Number(active.endsAt) || 0),
        }
      : null,
    dailyUses: Object.fromEntries(Object.entries(objectOf(raw.dailyUses)).map(([dayKey, uses]) => [
      dayKey,
      Object.fromEntries(Object.keys(POTION_DAILY_LIMITS).map((id) => [
        id, Math.max(0, Math.trunc(Number(objectOf(uses)[id]) || 0)),
      ])),
    ])),
    bloodPrepared: Object.fromEntries(Object.entries(objectOf(raw.bloodPrepared)).map(([bossKey, count]) => [
      bossKey, Math.min(3, Math.max(0, Math.trunc(Number(count) || 0))),
    ])),
    purchases: Array.isArray(raw.purchases)
      ? raw.purchases.filter((entry) => entry && typeof entry === 'object').slice(-100)
      : [],
  };
}

export function potionBloodChance(potions, bossKey) {
  const count = Math.min(3, Math.max(0,
    normalizePotionState(potions).bloodPrepared[String(bossKey || '')] || 0));
  return POTION_BLOOD_CHANCES.slice(0, count).reduce((sum, chance) => sum + chance, 0);
}

export function purchasePotion({ inventory, economy, potionId, operationId, quantity = 1, nowTimestamp = Date.now() }) {
  const definition = POTION_BY_ID[potionId];
  const potions = normalizePotionState(inventory?.potions);
  const safeEconomy = {
    ...objectOf(economy),
    coins: Math.max(0, Math.trunc(Number(economy?.coins) || 0)),
    transactions: Array.isArray(economy?.transactions) ? [...economy.transactions] : [],
  };
  if (!definition) return { ok: false, reason: 'unknown', inventory, economy: safeEconomy };
  const safeQuantity = Math.min(99, Math.max(1, Math.trunc(Number(quantity) || 1)));
  const totalPrice = definition.price * safeQuantity;
  const transactionId = `potion-buy:${operationId}`;
  if (potions.purchases.some((entry) => entry.operationId === operationId) ||
      safeEconomy.transactions.some((entry) => entry.id === transactionId)) {
    return { ok: true, duplicate: true, inventory: { ...inventory, potions }, economy: safeEconomy };
  }
  const occupiedSlots = Object.values(potions.owned)
    .filter((ownedQuantity) => Math.max(0, Number(ownedQuantity) || 0) > 0).length;
  if ((potions.owned[potionId] || 0) < 1 && occupiedSlots >= POTION_BAG_SLOT_LIMIT) {
    return { ok: false, reason: 'bag_full', inventory: { ...inventory, potions }, economy: safeEconomy };
  }
  if (safeEconomy.coins < totalPrice) {
    return { ok: false, reason: 'coins', inventory: { ...inventory, potions }, economy: safeEconomy };
  }
  potions.owned[potionId] += safeQuantity;
  potions.purchases.push({ operationId, potionId, quantity: safeQuantity, price: totalPrice, at: nowTimestamp });
  potions.purchases = potions.purchases.slice(-100);
  safeEconomy.coins -= totalPrice;
  safeEconomy.transactions = [...safeEconomy.transactions, {
    id: transactionId, type: 'potion_purchase', potionId,
    quantity: safeQuantity, coins: -totalPrice, at: nowTimestamp,
  }].slice(-200);
  return { ok: true, inventory: { ...inventory, potions }, economy: safeEconomy };
}

export function usePotion({ inventory, potionId, dayKey, bossKey = '', nowTimestamp = Date.now() }) {
  const potions = normalizePotionState(inventory?.potions);
  const definition = POTION_BY_ID[potionId];
  if (!definition) return { ok: false, reason: 'unknown', inventory: { ...inventory, potions } };
  if ((potions.owned[potionId] || 0) < 1) return { ok: false, reason: 'empty', inventory: { ...inventory, potions } };
  if (potionId === 'blood') {
    if (!bossKey) return { ok: false, reason: 'boss', inventory: { ...inventory, potions } };
    const used = potions.bloodPrepared[bossKey] || 0;
    if (used >= 3) return { ok: false, reason: 'limit', inventory: { ...inventory, potions } };
    potions.owned[potionId] -= 1;
    potions.bloodPrepared[bossKey] = used + 1;
    return { ok: true, inventory: { ...inventory, potions }, prepared: used + 1 };
  }
  const daily = potions.dailyUses[dayKey] || {};
  const used = Math.max(0, Number(daily[potionId]) || 0);
  const dailyLimit = POTION_DAILY_LIMITS[potionId];
  if (dailyLimit && used >= dailyLimit) {
    return { ok: false, reason: 'limit', inventory: { ...inventory, potions } };
  }
  if (['fortune', 'experience'].includes(potionId) && potions.active?.endsAt > nowTimestamp) {
    return { ok: false, reason: 'active', inventory: { ...inventory, potions } };
  }
  potions.owned[potionId] -= 1;
  if (dailyLimit) potions.dailyUses[dayKey] = { ...daily, [potionId]: used + 1 };
  if (['fortune', 'experience'].includes(potionId)) {
    potions.active = {
      id: potionId, dayKey, startedAt: nowTimestamp, endsAt: nowTimestamp + POTION_DURATION_MS,
    };
  }
  return {
    ok: true,
    inventory: { ...inventory, potions },
    uses: dailyLimit ? used + 1 : null,
    active: potions.active,
  };
}

export function consumePreparedBlood(inventory, bossKeys = []) {
  const potions = normalizePotionState(inventory?.potions);
  bossKeys.forEach((bossKey) => { delete potions.bloodPrepared[bossKey]; });
  return { ...inventory, potions };
}

function bonusUsed(entries, periodKey, field) {
  return Object.values(objectOf(entries)).reduce((sum, entry) =>
    entry?.periodKey === periodKey ? sum + Math.max(0, Number(entry?.[field]) || 0) : sum, 0);
}

export function reconcilePotionHabitBonus({
  inventory, habitState, economy, habit, date, planStartDate, previousCount,
  nowTimestamp = Date.now(),
}) {
  const potions = normalizePotionState(inventory?.potions);
  const periodKey = habitPeriodKey(habit, date, planStartDate);
  const entryKey = habitEntryKey(habit.id, periodKey);
  const entry = objectOf(habitState?.entries?.[entryKey]);
  const count = Math.max(0, Math.trunc(Number(entry.count) || 0));
  const oldCount = Math.max(0, Math.trunc(Number(previousCount) || 0));
  let fortuneAwards = Array.isArray(entry.fortuneCoinAwards) ? [...entry.fortuneCoinAwards] : [];
  let potionXpAwards = Array.isArray(entry.potionXpAwards) ? [...entry.potionXpAwards] : [];
  let coinDelta = 0;
  let xpDelta = 0;
  const safeEconomy = { ...economy, transactions: [...(economy?.transactions || [])] };

  if (count < oldCount) {
    fortuneAwards.slice(count).forEach((award) => { coinDelta -= Math.max(0, Number(award) || 0); });
    potionXpAwards.slice(count).forEach((award) => { xpDelta -= Math.max(0, Number(award) || 0); });
    fortuneAwards = fortuneAwards.slice(0, count);
    potionXpAwards = potionXpAwards.slice(0, count);
  }
  while (fortuneAwards.length < count) fortuneAwards.push(0);
  while (potionXpAwards.length < count) potionXpAwards.push(0);

  const active = potions.active;
  const eligible = habit?.frequency !== 'weekly' && active?.endsAt > nowTimestamp && active?.dayKey === periodKey.slice(2);
  if (eligible && count > oldCount) {
    for (let index = oldCount; index < count; index += 1) {
      if (active.id === 'fortune' && !fortuneAwards[index]) {
        const used = bonusUsed(habitState.entries, periodKey, 'fortuneCoinsAwarded') + coinDelta;
        const requested = Math.max(0, Number(habitProgressCoinSchedule(habit)[index]) || 0) * 2;
        const award = Math.min(requested, Math.max(0, POTION_BONUS_CAPS.fortune - used));
        fortuneAwards[index] = award;
        coinDelta += award;
      }
      if (active.id === 'experience' && !potionXpAwards[index]) {
        const used = bonusUsed(habitState.entries, periodKey, 'potionXpAwarded') + xpDelta;
        const base = Math.max(0, Number(habitProgressXpSchedule(habit)[index]) || 0);
        const award = Math.min(Math.ceil(base * .5), Math.max(0, POTION_BONUS_CAPS.experience - used));
        potionXpAwards[index] = award;
        xpDelta += award;
      }
    }
  }
  const fortuneCoinsAwarded = fortuneAwards.reduce((sum, award) => sum + Math.max(0, Number(award) || 0), 0);
  const potionXpAwarded = potionXpAwards.reduce((sum, award) => sum + Math.max(0, Number(award) || 0), 0);
  const requestedCoinDelta = coinDelta;
  if (coinDelta < 0) coinDelta = -Math.min(Math.max(0, safeEconomy.coins), Math.abs(coinDelta));
  safeEconomy.coins = Math.max(0, safeEconomy.coins + coinDelta);
  const transactionId = `potion-fortune:${entryKey}`;
  safeEconomy.transactions = safeEconomy.transactions.filter((transaction) => transaction.id !== transactionId);
  if (fortuneCoinsAwarded > 0 || requestedCoinDelta < 0) safeEconomy.transactions.push({
    id: transactionId, type: 'potion_fortune_reward', habitId: habit.id,
    periodKey, coins: fortuneCoinsAwarded, at: nowTimestamp,
  });
  return {
    inventory: { ...inventory, potions }, economy: safeEconomy,
    habitState: {
      ...habitState,
      entries: { ...habitState.entries, [entryKey]: {
        ...entry, fortuneCoinAwards: fortuneAwards, fortuneCoinsAwarded,
        potionXpAwards, potionXpAwarded,
      } },
    },
    coinDelta, xpDelta,
  };
}
