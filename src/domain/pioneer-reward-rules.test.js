import { describe, expect, it } from 'vitest';
import {
  PIONEER_REWARD_COINS,
  claimPioneerReward,
  isPioneerRewardClaimed,
  migratePioneerRewardEligibility,
  shouldOfferPioneerReward,
} from './pioneer-reward-rules.js';

function eligibleState() {
  return {
    onboarded: true,
    game: { cls: 'paladin', pioneerRewardEligible: true },
    economy: { coins: 20, bossBlood: 0, transactions: [] },
  };
}

describe('recompensa de pioneros', () => {
  it('solo se ofrece a una partida activa que todavía no la recibió', () => {
    expect(shouldOfferPioneerReward(eligibleState())).toBe(true);
    expect(shouldOfferPioneerReward({ ...eligibleState(), onboarded: false })).toBe(false);
    expect(shouldOfferPioneerReward({ ...eligibleState(), game: { cls: null } })).toBe(false);
    expect(shouldOfferPioneerReward({
      ...eligibleState(),
      game: { cls: 'paladin', pioneerRewardEligible: false },
    })).toBe(false);
  });

  it('marca solo las partidas anteriores como beta testers elegibles', () => {
    const legacy = eligibleState();
    delete legacy.game.pioneerRewardEligible;
    legacy.game.outfit = 'beta-tester';
    const migrated = migratePioneerRewardEligibility(legacy, { existingProfile: true });
    expect(migrated.changed).toBe(true);
    expect(migrated.state.game).toMatchObject({
      outfit: 'original',
      pioneerRewardEligible: true,
    });

    const newPlayer = migratePioneerRewardEligibility(legacy, { existingProfile: false });
    expect(newPlayer.changed).toBe(false);
    expect(newPlayer.state.game.pioneerRewardEligible).toBeUndefined();
  });

  it('entrega el outfit y 130 de oro una sola vez', () => {
    const first = claimPioneerReward(eligibleState(), 1234);
    expect(first.granted).toBe(true);
    expect(first.coins).toBe(PIONEER_REWARD_COINS);
    expect(first.outfitId).toBe('beta-tester');
    expect(first.state.economy.coins).toBe(150);
    expect(first.state.game.pioneerReward).toMatchObject({
      claimedAt: 1234,
      outfitId: 'beta-tester',
      coins: 130,
    });
    expect(isPioneerRewardClaimed(first.state)).toBe(true);

    const repeated = claimPioneerReward(first.state, 5678);
    expect(repeated.granted).toBe(false);
    expect(repeated.state.economy.coins).toBe(150);
    expect(repeated.state.economy.transactions).toHaveLength(1);
  });
});
