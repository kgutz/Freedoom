export const PIONEER_REWARD_ID = 'pioneer-beta-reward-v1';
export const PIONEER_REWARD_COINS = 130;
export const PIONEER_REWARD_OUTFIT = 'beta-tester';

function transactionsOf(state) {
  return Array.isArray(state?.economy?.transactions)
    ? state.economy.transactions
    : [];
}

export function isPioneerRewardClaimed(state) {
  return Boolean(state?.game?.pioneerReward?.claimedAt)
    || transactionsOf(state).some((transaction) => transaction?.id === PIONEER_REWARD_ID);
}

export function shouldOfferPioneerReward(state) {
  return Boolean(
    state?.onboarded
    && state?.game?.cls
    && state?.game?.pioneerRewardEligible === true,
  ) && !isPioneerRewardClaimed(state);
}

export function migratePioneerRewardEligibility(state, { existingProfile = false } = {}) {
  const game = state?.game;
  if (
    !existingProfile
    || !state?.onboarded
    || !game?.cls
    || Object.prototype.hasOwnProperty.call(game, 'pioneerRewardEligible')
  ) {
    return { state, changed: false };
  }

  return {
    state: {
      ...state,
      game: {
        ...game,
        outfit: isPioneerRewardClaimed(state) ? game.outfit : 'original',
        pioneerRewardEligible: true,
      },
    },
    changed: true,
  };
}

export function claimPioneerReward(state, nowTimestamp = Date.now()) {
  if (!shouldOfferPioneerReward(state)) {
    return { state, granted: false, coins: 0, outfitId: PIONEER_REWARD_OUTFIT };
  }

  const economy = state?.economy && typeof state.economy === 'object'
    ? state.economy
    : {};
  const transactions = transactionsOf(state);
  const claimedAt = Math.max(1, Number(nowTimestamp) || Date.now());
  const nextState = {
    ...state,
    game: {
      ...state.game,
      pioneerRewardEligible: true,
      pioneerReward: {
        id: PIONEER_REWARD_ID,
        claimedAt,
        outfitId: PIONEER_REWARD_OUTFIT,
        coins: PIONEER_REWARD_COINS,
      },
    },
    economy: {
      ...economy,
      coins: Math.max(0, Math.trunc(Number(economy.coins) || 0)) + PIONEER_REWARD_COINS,
      transactions: [
        ...transactions,
        {
          id: PIONEER_REWARD_ID,
          type: 'pioneer_reward',
          coins: PIONEER_REWARD_COINS,
          outfitId: PIONEER_REWARD_OUTFIT,
          at: claimedAt,
        },
      ].slice(-200),
    },
  };

  return {
    state: nextState,
    granted: true,
    coins: PIONEER_REWARD_COINS,
    outfitId: PIONEER_REWARD_OUTFIT,
  };
}
