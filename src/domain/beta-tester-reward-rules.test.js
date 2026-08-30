import { describe, expect, it } from 'vitest';
import {
  BETA_TESTER_REWARD_DEFINITIONS,
  claimBetaTesterReward,
  isBetaTesterRewardClaimed,
  pendingBetaTesterReward,
} from './beta-tester-reward-rules.js';
import { normalizeHuntState } from './pve-combat-rules.js';

function betaTesterState() {
  return {
    onboarded: true,
    game: {
      cls: 'paladin',
      pioneerReward: { id: 'pioneer-beta-reward-v1', claimedAt: 100 },
    },
    economy: { coins: 20, arcaneFibers: 2, transactions: [] },
  };
}

describe('regalos sucesivos para beta testers', () => {
  it('ofrece el segundo regalo solo a un perfil Beta Tester', () => {
    expect(pendingBetaTesterReward(betaTesterState())?.id).toBe('pioneer-beta-reward-v2');
    expect(pendingBetaTesterReward({ ...betaTesterState(), game: { cls: 'paladin' } })).toBeNull();
    expect(BETA_TESTER_REWARD_DEFINITIONS[0]).toMatchObject({ coins: 140, arcaneFibers: 10, energy: 2, frameId: 'beta-tester' });
  });

  it('ofrece como tercera recompensa el 60% del oro y todas las Tintas del Santuario', () => {
    const state = betaTesterState();
    state.game.betaTesterRewards = { claimed: { 'pioneer-beta-reward-v2': { claimedAt: 200 } } };
    const pending = pendingBetaTesterReward(state);
    expect(pending).toMatchObject({
      id: 'pioneer-beta-reward-v3', frameId: 'welder-beta', arcaneInks: 20, coins: 192,
    });
    const result = claimBetaTesterReward(state, pending.id, 2345);
    expect(result.granted).toBe(true);
    expect(result.state.economy).toMatchObject({ arcaneInks: 20, coins: 212 });
    expect(result.state.game.frames?.owned?.['welder-beta']).toBeUndefined();
  });

  it('entrega y guarda una sola vez todos los elementos del regalo', () => {
    const first = claimBetaTesterReward(betaTesterState(), 'pioneer-beta-reward-v2', 1234);
    expect(first.granted).toBe(true);
    expect(first.state.economy).toMatchObject({ coins: 160, arcaneFibers: 12 });
    expect(first.state.game.hunt).toMatchObject({ energy: 7, rewardEnergyRemaining: 2 });
    expect(first.state.game.frames.owned['beta-tester']).toMatchObject({ acquiredAt: 1234 });
    expect(isBetaTesterRewardClaimed(first.state, 'pioneer-beta-reward-v2')).toBe(true);

    const second = claimBetaTesterReward(first.state, 'pioneer-beta-reward-v2', 5678);
    expect(second.granted).toBe(false);
    expect(second.state.economy.coins).toBe(160);
    expect(second.state.game.hunt.rewardEnergyRemaining).toBe(2);
  });

  it('permite volver a cobrar una previsualización forzada sin afectar la protección real', () => {
    const first = claimBetaTesterReward(betaTesterState(), 'pioneer-beta-reward-v3', 1234, { force: true });
    const previewAgain = claimBetaTesterReward(first.state, 'pioneer-beta-reward-v3', 5678, { force: true });
    expect(previewAgain.granted).toBe(true);
    expect(previewAgain.state.economy).toMatchObject({ coins: 404, arcaneInks: 40 });

    const protectedClaim = claimBetaTesterReward(previewAgain.state, 'pioneer-beta-reward-v3', 6789);
    expect(protectedClaim.granted).toBe(false);
    expect(protectedClaim.state.economy).toMatchObject({ coins: 404, arcaneInks: 40 });
  });

  it('conserva la energía del regalo al comenzar un nuevo día', () => {
    const first = claimBetaTesterReward(betaTesterState(), 'pioneer-beta-reward-v2', new Date(2026, 7, 26, 12).getTime());
    const nextDay = new Date(2026, 7, 27, 12).getTime();
    const normalized = normalizeHuntState(first.state.game.hunt, nextDay);
    expect(normalized).toMatchObject({ energy: 7, rewardEnergyRemaining: 2 });
  });
});
