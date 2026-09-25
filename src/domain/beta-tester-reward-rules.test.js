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

  it('ofrece después el nuevo regalo con 80 de oro y dos Pociones de Vigor', () => {
    const state = betaTesterState();
    state.game.betaTesterRewards = { claimed: {
      'pioneer-beta-reward-v2': { claimedAt: 200 },
      'pioneer-beta-reward-v3': { claimedAt: 300 },
    } };
    state.inventory = { potions: { owned: { energy: 1 } } };
    const pending = pendingBetaTesterReward(state);
    expect(pending).toMatchObject({
      id: 'pioneer-beta-reward-v4', coins: 80, energyPotions: 2,
    });

    const result = claimBetaTesterReward(state, pending.id, 3456);
    expect(result.granted).toBe(true);
    expect(result.state.economy.coins).toBe(100);
    expect(result.state.inventory.potions.owned.energy).toBe(3);
    expect(result.state.game.betaTesterRewards.claimed[pending.id]).toMatchObject({ energyPotions: 2 });
  });

  it('no pierde las pociones regaladas aunque el bolso ya tenga cuatro tipos distintos', () => {
    const state = betaTesterState();
    state.game.betaTesterRewards = { claimed: {
      'pioneer-beta-reward-v2': { claimedAt: 200 },
      'pioneer-beta-reward-v3': { claimedAt: 300 },
    } };
    state.inventory = { potions: { owned: { fortune: 1, experience: 1, life: 1, mana: 1 } } };

    const result = claimBetaTesterReward(state, 'pioneer-beta-reward-v4', 4567);
    expect(result.granted).toBe(true);
    expect(result.state.inventory.potions.owned.energy).toBe(2);
  });

  it('entrega y guarda una sola vez todos los elementos del regalo', () => {
    const first = claimBetaTesterReward(betaTesterState(), 'pioneer-beta-reward-v2', 1234);
    expect(first.granted).toBe(true);
    expect(first.state.economy).toMatchObject({ coins: 160, arcaneFibers: 12 });
    expect(first.state.game.hunt).toMatchObject({ energy: 12, rewardEnergyRemaining: 2 });
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
    expect(normalized).toMatchObject({ energy: 12, rewardEnergyRemaining: 2 });
  });
});


describe('regalo 05: compensación por reorganizar reliquias', () => {
  function ready() {
    const state = betaTesterState();
    state.game.betaTesterRewards = { claimed: Object.fromEntries([2, 3, 4].map(n => [`pioneer-beta-reward-v${n}`, { claimedAt: n * 100 }])) };
    state.economy.bossBlood = 7;
    state.inventory = { relics: { relic_07: { rank: 3 } }, potions: { owned: { energy: 3, life: 1, mana: 1, fortune: 1 } } };
    return state;
  }
  it('tiene identificador independiente y entrega exactamente dos Sangres y dos pociones', () => {
    const state = ready();
    const reward = pendingBetaTesterReward(state);
    expect(reward).toMatchObject({ id: 'pioneer-beta-reward-v5', bossBlood: 2, energyPotions: 2, coins: 150, energy: 0, grantsFrame: false });
    expect(new Set(BETA_TESTER_REWARD_DEFINITIONS.map(r => r.id)).size).toBe(BETA_TESTER_REWARD_DEFINITIONS.length);
    const result = claimBetaTesterReward(state, reward.id, 500);
    expect(result.granted).toBe(true);
    expect(result.state.economy).toMatchObject({ bossBlood: 9, coins: 170, arcaneFibers: 2 });
    expect(result.state.inventory.potions.owned).toMatchObject({ energy: 5, life: 1, mana: 1, fortune: 1 });
    expect(result.state.inventory.relics).toEqual(state.inventory.relics);
    expect(result.state.game.betaTesterRewards.claimed[reward.id]).toMatchObject({ bossBlood: 2, energyPotions: 2 });
    expect(result.state.economy.transactions.at(-1)).toMatchObject({ id: reward.id, bossBlood: 2, energyPotions: 2 });
    expect(state.economy.bossBlood).toBe(7);
  });
  it('no permite repetir tras guardar y cargar ni perder uno de los dos registros', () => {
    const first = claimBetaTesterReward(ready(), 'pioneer-beta-reward-v5', 500);
    for (const remove of ['none', 'ledger', 'transaction']) {
      const saved = JSON.parse(JSON.stringify(first.state));
      if (remove === 'ledger') delete saved.game.betaTesterRewards.claimed['pioneer-beta-reward-v5'];
      if (remove === 'transaction') saved.economy.transactions = [];
      const again = claimBetaTesterReward(saved, 'pioneer-beta-reward-v5', 600);
      expect(again.granted).toBe(false);
      expect(again.state.economy.bossBlood).toBe(9);
      expect(again.state.economy.coins).toBe(170);
      expect(again.state.inventory.potions.owned.energy).toBe(5);
    }
  });
  it('respeta la elegibilidad y el orden anterior sin exigir gasto previo', () => {
    const state = ready();
    expect(claimBetaTesterReward(betaTesterState(), 'pioneer-beta-reward-v5', 500).granted).toBe(false);
    delete state.game.pioneerReward;
    expect(claimBetaTesterReward(state, 'pioneer-beta-reward-v5', 500).granted).toBe(false);
    state.game.betaTester = true;
    state.economy.bossBlood = 0;
    expect(claimBetaTesterReward(state, 'pioneer-beta-reward-v5', 500).granted).toBe(true);
    state.onboarded = false;
    expect(claimBetaTesterReward(state, 'pioneer-beta-reward-v5', 500).granted).toBe(false);
  });
});
