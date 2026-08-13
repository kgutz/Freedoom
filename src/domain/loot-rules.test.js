import { describe, expect, it } from 'vitest';
import {
  acknowledgeLootNotice,
  attemptForge,
  canActivateDailyRelic,
  deterministicRelicRoll,
  emptyLootState,
  equipRelic,
  equippedRelicBonuses,
  forgePreview,
  grantBossRewards,
  markDailyRelicActivation,
  normalizeLootState,
  pendingLootNotice,
  rarityFromRoll,
  rollRelic,
  unequipRelic,
} from './loot-rules.js';

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function unlockedState(count = 3) {
  return grantBossRewards({
    state: emptyLootState(),
    bossesDown: count,
    source: 'retroactive',
    seed: 'test',
    nowTimestamp: 1,
  });
}

describe('loot de bosses', () => {
  it('delimita 60/30/10', () => {
    expect(rarityFromRoll(0)).toBe('rare');
    expect(rarityFromRoll(0.599999)).toBe('rare');
    expect(rarityFromRoll(0.6)).toBe('legendary');
    expect(rarityFromRoll(0.899999)).toBe('legendary');
    expect(rarityFromRoll(0.9)).toBe('mythic');
    expect(rarityFromRoll(0.999)).toBe('mythic');
  });

  it('genera 0, 1 o 2 affixes sin duplicados y dentro del pool', () => {
    const rare = rollRelic('relic_01', sequence(0.2));
    const legendary = rollRelic('relic_02', sequence(0.7, 0));
    const mythic = rollRelic('relic_03', sequence(0.95, 0, 0));
    expect(rare.affixes).toEqual([]);
    expect(legendary.affixes).toEqual(['arcane']);
    expect(mythic.affixes).toHaveLength(2);
    expect(new Set(mythic.affixes).size).toBe(2);
    expect(mythic.affixes.every((id) =>
      ['discipline', 'fortune', 'arcane'].includes(id))).toBe(true);
  });

  it('entrega reliquia, monedas y Sangre una sola vez', () => {
    const first = grantBossRewards({
      state: emptyLootState(),
      bossesDown: 3,
      source: 'retroactive',
      seed: 'hero',
      nowTimestamp: 10,
    });
    expect(first.rewards).toHaveLength(3);
    expect(first.economy.coins).toBe(260);
    expect(first.economy.bossBlood).toBe(3);
    expect(Object.keys(first.inventory.relics)).toHaveLength(3);
    expect(first.loot.claimedBossRewards).toEqual([
      'boss_reward_01',
      'boss_reward_02',
      'boss_reward_03',
    ]);
    const second = grantBossRewards({
      state: first,
      bossesDown: 3,
      source: 'retroactive',
      seed: 'different',
      nowTimestamp: 20,
    });
    expect(second.rewards).toEqual([]);
    expect(second.economy.coins).toBe(260);
    expect(second.economy.bossBlood).toBe(3);
    expect(second.inventory.relics).toEqual(first.inventory.relics);
  });

  it('migra cero y seis bosses de forma estable', () => {
    const zero = grantBossRewards({
      state: emptyLootState(),
      bossesDown: 0,
      source: 'retroactive',
      seed: 'hero',
    });
    expect(zero.rewards).toEqual([]);
    expect(pendingLootNotice(zero)).toBeNull();
    const six = grantBossRewards({
      state: emptyLootState(),
      bossesDown: 6,
      source: 'retroactive',
      seed: 'hero',
      nowTimestamp: 10,
    });
    expect(six.rewards).toHaveLength(6);
    expect(six.economy.coins).toBe(650);
    expect(six.economy.bossBlood).toBe(6);
    expect(deterministicRelicRoll('relic_01', 'hero')).toEqual(
      deterministicRelicRoll('relic_01', 'hero'),
    );
  });

  it('separa rewards reclamados del aviso obligatorio', () => {
    const state = unlockedState(2);
    const notice = pendingLootNotice(state);
    expect(notice.coins).toBe(160);
    expect(notice.bossBlood).toBe(2);
    const acknowledged = acknowledgeLootNotice(state, notice.id);
    expect(pendingLootNotice(acknowledged)).toBeNull();
    expect(acknowledged.economy.coins).toBe(160);
  });
});

describe('equipamiento y bonus derivados', () => {
  it('equipa máximo dos, no duplica y permite desequipar/sustituir', () => {
    let state = unlockedState(3);
    state = equipRelic(state, 'relic_01');
    expect(state.ok).toBe(true);
    state = equipRelic(state, 'relic_01');
    expect(state.reason).toBe('already-equipped');
    state = equipRelic(state, 'relic_02');
    expect(state.inventory.equipped).toEqual(['relic_01', 'relic_02']);
    const full = equipRelic(state, 'relic_03');
    expect(full.reason).toBe('slots-full');
    state = equipRelic(state, 'relic_03', 0);
    expect(state.inventory.equipped).toEqual(['relic_03', 'relic_02']);
    state = unequipRelic(state, 'relic_02');
    expect(state.inventory.equipped).toEqual(['relic_03']);
  });

  it('calcula Vitalidad, Arcano, Regeneración, Canalización, Disciplina y Fortuna', () => {
    const raw = emptyLootState();
    raw.inventory.relics = {
      relic_02: {
        unlocked: true, rarity: 'mythic', rank: 1,
        affixes: ['arcane', 'channeling'],
      },
      relic_03: {
        unlocked: true, rarity: 'mythic', rank: 1,
        affixes: ['discipline', 'fortune'],
      },
    };
    raw.inventory.equipped = ['relic_02', 'relic_03'];
    const bonuses = equippedRelicBonuses(raw);
    expect(bonuses).toMatchObject({
      maxMana: 5,
      manaRecoveryBonus: 1,
      habitXpBonus: 1,
      fortune: 1,
    });
    raw.inventory.relics.relic_02.affixes = ['regeneration', 'arcane'];
    raw.inventory.relics.relic_03.affixes = ['vitality', 'fortune'];
    expect(equippedRelicBonuses(raw)).toMatchObject({
      maxHp: 5,
      maxMana: 5,
      regenerationMinutesReduction: 0.5,
      fortune: 1,
    });
  });

  it('recuerda una activación diaria aunque se desequipe', () => {
    let state = equipRelic(unlockedState(1), 'relic_01');
    expect(canActivateDailyRelic(state, 'relic_01', '2026-08-12')).toBe(true);
    state = markDailyRelicActivation(state, 'relic_01', '2026-08-12');
    state = unequipRelic(state, 'relic_01');
    state = equipRelic(state, 'relic_01');
    expect(canActivateDailyRelic(state, 'relic_01', '2026-08-12')).toBe(false);
  });
});

describe('Forja', () => {
  function forgeState({ coins = 650, blood = 6, fortune = false } = {}) {
    const state = unlockedState(3);
    state.economy.coins = coins;
    state.economy.bossBlood = blood;
    state.inventory.relics.relic_01 = {
      unlocked: true,
      rarity: fortune ? 'legendary' : 'rare',
      rank: 1,
      affixes: fortune ? ['fortune'] : [],
      bossIndex: 0,
    };
    if (fortune) state.inventory.equipped = ['relic_01'];
    state.loot.notices = [];
    return state;
  }

  it('aplica pity completo de Rango II, conserva Sangre al fallar y consume 1 al acertar', () => {
    let state = forgeState();
    let result = attemptForge({
      state, relicId: 'relic_01', operationId: 'a', randomValue: 0.99,
    });
    expect(result.success).toBe(false);
    expect(result.nextProbability).toBe(85);
    expect(result.economy.coins).toBe(600);
    expect(result.economy.bossBlood).toBe(6);
    result = attemptForge({
      state: result, relicId: 'relic_01', operationId: 'b', randomValue: 0.99,
    });
    expect(result.success).toBe(false);
    expect(result.nextProbability).toBe(100);
    result = attemptForge({
      state: result, relicId: 'relic_01', operationId: 'c', randomValue: 0.99,
    });
    expect(result.success).toBe(true);
    expect(result.inventory.relics.relic_01.rank).toBe(2);
    expect(result.economy.coins).toBe(500);
    expect(result.economy.bossBlood).toBe(5);
    expect(result.spentBossBlood).toBe(1);
    expect(result.forge.history.at(-1)).toMatchObject({
      previousRank: 1,
      newRank: 2,
      coinsSpent: 50,
      bossBloodSpent: 1,
      success: true,
    });
    expect(result.economy.transactions.at(-1)).toMatchObject({
      type: 'forge_success',
      bossBlood: -1,
      bossBloodSpent: 1,
    });
  });

  it('aplica pity completo de Rango III', () => {
    let state = forgeState();
    state.inventory.relics.relic_01.rank = 2;
    for (let index = 0; index < 4; index += 1) {
      const result = attemptForge({
        state,
        relicId: 'relic_01',
        operationId: `fail-${index}`,
        randomValue: 0.999,
      });
      expect(result.success).toBe(false);
      expect(result.economy.bossBlood).toBe(6);
      expect(result.spentBossBlood).toBe(0);
      state = result;
    }
    const guaranteed = forgePreview(state, 'relic_01');
    expect(guaranteed.finalProbability).toBe(100);
    const result = attemptForge({
      state,
      relicId: 'relic_01',
      operationId: 'success',
      randomValue: 0.999,
    });
    expect(result.success).toBe(true);
    expect(result.inventory.relics.relic_01.rank).toBe(3);
    expect(result.economy.bossBlood).toBe(4);
    expect(result.spentBossBlood).toBe(2);
  });

  it('suma Fortuna, limita al 100 y valida recursos', () => {
    const state = forgeState({ fortune: true });
    expect(forgePreview(state, 'relic_01').finalProbability).toBe(71);
    const noCoins = forgeState({ coins: 49 });
    expect(attemptForge({
      state: noCoins,
      relicId: 'relic_01',
      operationId: 'no-coins',
    }).reason).toBe('coins');
    const noBlood = forgeState({ blood: 0 });
    expect(attemptForge({
      state: noBlood,
      relicId: 'relic_01',
      operationId: 'no-blood',
    }).reason).toBe('blood');
    expect(noBlood.economy.bossBlood).toBe(0);
    const oneBloodForRankThree = forgeState({ blood: 1 });
    oneBloodForRankThree.inventory.relics.relic_01.rank = 2;
    const blockedRankThree = attemptForge({
      state: oneBloodForRankThree,
      relicId: 'relic_01',
      operationId: 'rank-three-no-blood',
      randomValue: 0,
    });
    expect(blockedRankThree.reason).toBe('blood');
    expect(blockedRankThree.inventory.relics.relic_01.rank).toBe(2);
    expect(blockedRankThree.economy.bossBlood).toBe(1);
  });

  it('bloquea la misma operación dos veces', () => {
    const first = attemptForge({
      state: forgeState(),
      relicId: 'relic_01',
      operationId: 'same',
      randomValue: 0,
    });
    const second = attemptForge({
      state: first,
      relicId: 'relic_01',
      operationId: 'same',
      randomValue: 0,
    });
    expect(first.success).toBe(true);
    expect(first.economy.bossBlood).toBe(5);
    expect(second.reason).toBe('duplicate-operation');
    expect(second.economy.coins).toBe(first.economy.coins);
    expect(second.economy.bossBlood).toBe(first.economy.bossBlood);
    expect(second.forge.history.filter((entry) => entry.operationId === 'same')).toHaveLength(1);
  });

  it('conserva la Sangre en fallos y nunca permite un saldo negativo', () => {
    const rankTwoFailure = attemptForge({
      state: forgeState({ blood: 1 }),
      relicId: 'relic_01',
      operationId: 'rank-two-failure',
      randomValue: 0.99,
    });
    expect(rankTwoFailure.success).toBe(false);
    expect(rankTwoFailure.economy.bossBlood).toBe(1);
    expect(rankTwoFailure.forge.history.at(-1).bossBloodSpent).toBe(0);
    expect(rankTwoFailure.economy.transactions.at(-1)).toMatchObject({
      type: 'forge_failure',
      bossBlood: 0,
      bossBloodSpent: 0,
    });

    const exactRankThreeBlood = forgeState({ blood: 2 });
    exactRankThreeBlood.inventory.relics.relic_01.rank = 2;
    const rankThreeSuccess = attemptForge({
      state: exactRankThreeBlood,
      relicId: 'relic_01',
      operationId: 'rank-three-exact-blood',
      randomValue: 0,
    });
    expect(rankThreeSuccess.success).toBe(true);
    expect(rankThreeSuccess.economy.bossBlood).toBe(0);
    expect(rankThreeSuccess.economy.bossBlood).toBeGreaterThanOrEqual(0);
  });

  it('normaliza y conserva economía, equipo, pity e historial', () => {
    const state = forgeState();
    state.forge.attempts['relic_01:rank-2'] = 2;
    state.inventory.dailyActivations['relic_01:2026-08-12'] = true;
    const normalized = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(normalized.forge.attempts['relic_01:rank-2']).toBe(2);
    expect(normalized.inventory.dailyActivations).toEqual(
      state.inventory.dailyActivations,
    );
    expect(normalized.economy.coins).toBe(state.economy.coins);
    expect(normalized.economy.bossBlood).toBe(state.economy.bossBlood);
  });
});
