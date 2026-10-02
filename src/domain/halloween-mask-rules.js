export const HALLOWEEN_MASK_ID = 'halloween-mask';
export const HALLOWEEN_MASK_DURATION_MS = 24 * 60 * 60 * 1000;
export function halloweenMaskPrice(level = 1) { return 50 + 5 * Math.max(1, Math.trunc(Number(level) || 1)); }
export const HALLOWEEN_MASK_BLOOD_COST = 1;
export function halloweenMaskActive(record, now = Date.now()) {
  return Boolean(record?.unlocked && (!record.expiresAt || record.expiresAt > now));
}
export function expireHalloweenMask(state, now = Date.now()) {
  const record = state.inventory?.relics?.[HALLOWEEN_MASK_ID];
  if (!record?.expiresAt || record.expiresAt > now) return { state, expired: false };
  const relics = { ...state.inventory.relics };
  delete relics[HALLOWEEN_MASK_ID];
  return { expired: true, state: { ...state, inventory: {
    ...state.inventory, relics,
    equipped: (state.inventory.equipped || []).filter(id => id !== HALLOWEEN_MASK_ID),
    collection: { ...state.inventory.collection, [HALLOWEEN_MASK_ID]: {
      ...state.inventory.collection?.[HALLOWEEN_MASK_ID], lastOwnedRecord: record,
    } },
  } } };
}
export function buyHalloweenMask({ state, level = 1, active = false, operationId, nowTimestamp = Date.now() }) {
  if (!active) return { ...state, ok: false, reason: 'season' };
  if (!operationId) return { ...state, ok: false, reason: 'operation' };
  if (state.economy.transactions.some(item => item.id === `mask:${operationId}`)) return { ...state, ok: true, duplicate: true };
  const previous = state.inventory.relics[HALLOWEEN_MASK_ID];
  if (halloweenMaskActive(previous, nowTimestamp)) return { ...state, ok: false, reason: 'owned' };
  const price = halloweenMaskPrice(level);
  if (state.economy.coins < price) return { ...state, ok: false, reason: 'coins' };
  if (state.economy.bossBlood < HALLOWEEN_MASK_BLOOD_COST) return { ...state, ok: false, reason: 'blood' };
  const record = { unlocked: true, rank: 3, rarity: 'legendary', affixes: [], obtainedAt: nowTimestamp, firstEquippedAt: 0, expiresAt: 0 };
  return { ...state, ok: true, cost: price, bloodCost: HALLOWEEN_MASK_BLOOD_COST,
    economy: { ...state.economy, coins: state.economy.coins - price, bossBlood: state.economy.bossBlood - HALLOWEEN_MASK_BLOOD_COST, transactions: [...state.economy.transactions,{id:`mask:${operationId}`,type:'halloween_mask',coins:-price,bossBlood:-HALLOWEEN_MASK_BLOOD_COST,at:nowTimestamp}].slice(-200) },
    inventory: { ...state.inventory, relics: { ...state.inventory.relics,[HALLOWEEN_MASK_ID]:record },
      equipped: state.inventory.equipped.filter(id => id !== HALLOWEEN_MASK_ID),
      collection: { ...state.inventory.collection,[HALLOWEEN_MASK_ID]:{discoveredAt:state.inventory.collection[HALLOWEEN_MASK_ID]?.discoveredAt || nowTimestamp,lastOwnedRecord:record} } },
  };
}
