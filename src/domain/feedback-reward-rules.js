import { normalizePotionState } from './potion-rules.js';

export const FIRST_REPORT_REWARD_ID = 'feedback-report-0001';

function transactionsOf(state) {
  return Array.isArray(state?.economy?.transactions) ? state.economy.transactions : [];
}

export function isFeedbackRewardApplied(state, eventId) {
  return Boolean(state?.game?.feedbackRewards?.claimed?.[eventId]?.claimedAt)
    || transactionsOf(state).some((transaction) => transaction?.id === eventId);
}

export function applyFeedbackReward(state, event, nowTimestamp = Date.now()) {
  const eventId = String(event?.eventId || event?.event_id || '').trim();
  if (!eventId || isFeedbackRewardApplied(state, eventId)) {
    return { state, granted: false };
  }
  const reward = event?.reward && typeof event.reward === 'object' ? event.reward : {};
  const coins = Math.max(0, Math.trunc(Number(reward.coins) || 0));
  const bloodPotions = Math.max(0, Math.trunc(Number(reward.bloodPotions ?? reward.blood_potions) || 0));
  const vigorPotions = Math.max(0, Math.trunc(Number(reward.vigorPotions ?? reward.vigor_potions) || 0));
  const claimedAt = Math.max(1, Number(event?.claimedAt || event?.claimed_at || nowTimestamp) || Date.now());
  const potions = normalizePotionState(state?.inventory?.potions);
  potions.owned.blood = Math.max(0, Number(potions.owned.blood) || 0) + bloodPotions;
  potions.owned.energy = Math.max(0, Number(potions.owned.energy) || 0) + vigorPotions;
  const economy = state?.economy && typeof state.economy === 'object' ? state.economy : {};
  const nextState = {
    ...state,
    inventory: { ...(state?.inventory || {}), potions },
    game: {
      ...(state?.game || {}),
      feedbackRewards: {
        ...(state?.game?.feedbackRewards || {}),
        claimed: {
          ...(state?.game?.feedbackRewards?.claimed || {}),
          [eventId]: { claimedAt, coins, bloodPotions, vigorPotions },
        },
      },
    },
    economy: {
      ...economy,
      coins: Math.max(0, Math.trunc(Number(economy.coins) || 0)) + coins,
      transactions: [
        ...transactionsOf(state),
        { id: eventId, type: 'feedback_reward', coins, bloodPotions, vigorPotions, at: claimedAt },
      ].slice(-200),
    },
  };
  return { state: nextState, granted: true, coins, bloodPotions, vigorPotions, eventId };
}
