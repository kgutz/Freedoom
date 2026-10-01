import { halloweenSeasonActive, normalizeHalloweenCandy } from './halloween-candy-rules.js';

export function halloweenGiftId(now = Date.now()) {
  return `halloween-welcome-${new Date(now).getFullYear()}`;
}

export function shouldOfferHalloweenGift(state, now = Date.now(), preview = false) {
  return Number.isFinite(now) && Boolean(state?.onboarded && state.game?.cls)
    && halloweenSeasonActive(now, preview)
    && !state.game.halloweenGifts?.[halloweenGiftId(now)];
}

export function claimHalloweenGift(state, now = Date.now(), preview = false) {
  if (!shouldOfferHalloweenGift(state, now, preview)) return { granted: false, state };
  const candy = normalizeHalloweenCandy(state.inventory?.halloweenCandy);
  for (const id of ['blood', 'energy', 'experience']) candy.owned[id] += 1;
  return { granted: true, state: {
    ...state,
    game: { ...state.game, halloweenGifts: {
      ...state.game.halloweenGifts, [halloweenGiftId(now)]: now,
    } },
    inventory: { ...state.inventory, halloweenCandy: candy },
  } };
}
