import { grantRewardHuntEnergy } from './pve-combat-rules.js';
import { isPioneerRewardClaimed } from './pioneer-reward-rules.js';

export const BETA_TESTER_REWARD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'pioneer-beta-reward-v2',
    active: true,
    title: 'Entre bugs y victorias',
    intro: 'Freedom sigue creciendo gracias a cada prueba, cada idea y cada error que nos ayudaste a encontrar.',
    coins: 140,
    arcaneFibers: 10,
    energy: 2,
    frameId: 'beta-tester',
  }),
  Object.freeze({
    id: 'pioneer-beta-reward-v3',
    active: true,
    title: 'El color de los pioneros',
    intro: 'Tu huella ya forma parte de Freedom. Recibe recursos para descubrir la Tinta Arcana y el Santuario del Crisol.',
    coins: 192,
    arcaneFibers: 0,
    arcaneInks: 20,
    energy: 0,
    frameId: 'welder-beta',
    grantsFrame: false,
  }),
]);

function transactionsOf(state) {
  return Array.isArray(state?.economy?.transactions) ? state.economy.transactions : [];
}

export function isBetaTesterRewardClaimed(state, rewardId) {
  return Boolean(state?.game?.betaTesterRewards?.claimed?.[rewardId]?.claimedAt)
    || transactionsOf(state).some((transaction) => transaction?.id === rewardId);
}

export function isBetaTesterProfile(state) {
  return isPioneerRewardClaimed(state) || state?.game?.betaTester === true;
}

export function pendingBetaTesterReward(state) {
  if (!state?.onboarded || !state?.game?.cls || !isBetaTesterProfile(state)) return null;
  return BETA_TESTER_REWARD_DEFINITIONS.find((reward) => (
    reward.active && !isBetaTesterRewardClaimed(state, reward.id)
  )) || null;
}

export function claimBetaTesterReward(state, rewardId, nowTimestamp = Date.now(), { force = false } = {}) {
  const reward = BETA_TESTER_REWARD_DEFINITIONS.find((candidate) => candidate.id === rewardId);
  const eligible = force || pendingBetaTesterReward(state)?.id === rewardId;
  if (!reward || !eligible || (!force && isBetaTesterRewardClaimed(state, rewardId))) {
    return { state, reward: reward || null, granted: false };
  }
  const claimedAt = Math.max(1, Number(nowTimestamp) || Date.now());
  const economy = state?.economy && typeof state.economy === 'object' ? state.economy : {};
  const energyGrant = grantRewardHuntEnergy({
    hunt: state?.game?.hunt,
    amount: reward.energy,
    nowTimestamp: claimedAt,
  });
  const nextState = {
    ...state,
    game: {
      ...state.game,
      hunt: energyGrant.hunt,
      ...(reward.frameId && reward.grantsFrame !== false ? { frames: {
        ...(state.game?.frames || {}),
        owned: {
          ...(state.game?.frames?.owned || {}),
          [reward.frameId]: { acquiredAt: claimedAt, source: reward.id },
        },
      } } : {}),
      betaTesterRewards: {
        ...(state.game?.betaTesterRewards || {}),
        claimed: {
          ...(state.game?.betaTesterRewards?.claimed || {}),
          [reward.id]: {
            claimedAt,
            coins: reward.coins,
            arcaneFibers: reward.arcaneFibers,
            arcaneInks: reward.arcaneInks || 0,
            energy: energyGrant.granted,
            frameId: reward.frameId,
          },
        },
      },
    },
    economy: {
      ...economy,
      coins: Math.max(0, Math.trunc(Number(economy.coins) || 0)) + reward.coins,
      arcaneFibers: Math.max(0, Math.trunc(Number(economy.arcaneFibers) || 0)) + reward.arcaneFibers,
      arcaneInks: Math.max(0, Math.trunc(Number(economy.arcaneInks) || 0)) + (reward.arcaneInks || 0),
      transactions: [
        ...transactionsOf(state),
        {
          id: reward.id,
          type: 'beta_tester_reward',
          coins: reward.coins,
          arcaneFibers: reward.arcaneFibers,
          arcaneInks: reward.arcaneInks || 0,
          energy: energyGrant.granted,
          frameId: reward.frameId,
          at: claimedAt,
        },
      ].slice(-200),
    },
  };
  return { state: nextState, reward, granted: true };
}
