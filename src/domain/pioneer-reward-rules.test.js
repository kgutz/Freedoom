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
  it('mantiene cerrada la campaña aunque la partida fuese elegible', () => {
    expect(shouldOfferPioneerReward(eligibleState())).toBe(false);
    expect(shouldOfferPioneerReward({ ...eligibleState(), onboarded: false })).toBe(false);
    expect(shouldOfferPioneerReward({ ...eligibleState(), game: { cls: null } })).toBe(false);
    expect(shouldOfferPioneerReward({
      ...eligibleState(),
      game: { cls: 'paladin', pioneerRewardEligible: false },
    })).toBe(false);
  });

  it('desactiva las partidas anteriores que no llegaron a reclamarla', () => {
    const legacy = eligibleState();
    delete legacy.game.pioneerRewardEligible;
    legacy.game.outfit = 'beta-tester';
    const migrated = migratePioneerRewardEligibility(legacy, { existingProfile: true });
    expect(migrated.changed).toBe(true);
    expect(migrated.state.game).toMatchObject({
      outfit: 'original',
      pioneerRewardEligible: false,
    });

    const newPlayer = migratePioneerRewardEligibility(legacy, { existingProfile: false });
    expect(newPlayer.changed).toBe(false);
    expect(newPlayer.state.game.pioneerRewardEligible).toBeUndefined();
  });

  it('ya no permite reclamar el outfit ni las 130 unidades de oro', () => {
    const result = claimPioneerReward(eligibleState(), 1234);
    expect(result.granted).toBe(false);
    expect(result.coins).toBe(0);
    expect(result.state.economy.coins).toBe(20);
    expect(result.state.game.pioneerReward).toBeUndefined();
    expect(isPioneerRewardClaimed(result.state)).toBe(false);
  });

  it('conserva el registro de quien ya había recibido el regalo', () => {
    const claimed = eligibleState();
    claimed.game.pioneerReward = {
      id: 'pioneer-beta-reward-v1', claimedAt: 1234,
      outfitId: 'beta-tester', coins: PIONEER_REWARD_COINS,
    };
    expect(isPioneerRewardClaimed(claimed)).toBe(true);
    const migrated = migratePioneerRewardEligibility(claimed, { existingProfile: true });
    expect(migrated.changed).toBe(false);
    expect(migrated.state.game.pioneerReward.outfitId).toBe('beta-tester');
  });
});
