import { describe, expect, it } from 'vitest';
import {
  acknowledgeLootNotice,
  advancePeriodicManaRecovery,
  attemptForge,
  awardFusionAllHabitsXp,
  canActivateDailyRelic,
  deterministicRelicRoll,
  defuseRelic,
  emptyLootState,
  ensureShopRotation,
  equipRelic,
  fuseRelics,
  equippedRelicBonuses,
  forgePreview,
  forgeAttemptRoll,
  getForgeFusionPreview,
  getDefusionPreview,
  grantBossRewards,
  markDailyRelicActivation,
  initializeForgeSeed,
  normalizeLootState,
  pendingLootNotice,
  payClassChange,
  purchaseShopRelic,
  rarityFromRoll,
  rollRelic,
  shopOffers,
  shopPriceForRelic,
  shopRankFromRoll,
  shopSalePriceForRelic,
  sellRelicToShop,
  unequipRelic,
} from './loot-rules.js';
import { exportBackup, importBackup } from '../storage/state-storage.js';

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
  it('reparte el 30% diario en ciclos de media hora sin conceder Maná al equipar', () => {
    const start = 1_000;
    const state = emptyLootState();
    state.inventory.relics.relic_05 = {
      id: 'relic_05', unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 1,
    };
    state.inventory.equipped = ['relic_05'];

    const equipped = advancePeriodicManaRecovery({
      state, nowTimestamp: start, maxMana: 200, currentMana: 20,
    });
    expect(equipped.mana).toBe(20);
    expect(equipped.manaRecovered).toBe(0);

    const recovered = advancePeriodicManaRecovery({
      state: equipped, nowTimestamp: start + 24 * 60 * 60 * 1000, maxMana: 200, currentMana: 20,
    });
    expect(recovered.mana).toBe(80);
    expect(recovered.manaRecovered).toBe(60);
    expect(recovered.ticks).toBe(48);
  });

  it('acumula intervalos cerrada, respeta el máximo y reinicia el ciclo al cambiar la fuente', () => {
    const start = 2_000;
    const state = emptyLootState();
    state.inventory.relics.fusion_04 = {
      id: 'fusion_04', unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 1,
      inheritedEffects: { relic_03: 2, relic_05: 7 },
      ingredientSnapshots: {
        relic_03: { rank: 1, rarity: 'rare', affixes: [], effectValue: 2 },
        relic_05: { rank: 2, rarity: 'rare', affixes: [], effectValue: 7 },
      },
    };
    state.inventory.equipped = ['fusion_04'];
    const equipped = advancePeriodicManaRecovery({
      state, nowTimestamp: start, maxMana: 100, currentMana: 80,
    });
    const recovered = advancePeriodicManaRecovery({
      state: equipped, nowTimestamp: start + 60 * 60 * 1000, maxMana: 100, currentMana: 80,
    });
    expect(recovered.inventory.relics.fusion_04.inheritedEffects.relic_05).toBe(45);
    expect(recovered.mana).toBe(81);
    expect(recovered.ticks).toBe(2);
    recovered.inventory.equipped = [];
    const unequipped = advancePeriodicManaRecovery({
      state: recovered, nowTimestamp: start + 70 * 60 * 1000, maxMana: 100, currentMana: 81,
    });
    expect(unequipped.inventory.periodicEffects.manaRecovery.timers.fusion_04).toMatchObject({
      paused: true,
      remainingMs: 20 * 60 * 1000,
    });
    unequipped.inventory.equipped = ['fusion_04'];
    const reequipped = advancePeriodicManaRecovery({
      state: unequipped, nowTimestamp: start + 5 * 60 * 60 * 1000, maxMana: 100, currentMana: 81,
    });
    const beforeDue = advancePeriodicManaRecovery({
      state: reequipped, nowTimestamp: start + 5 * 60 * 60 * 1000 + 19 * 60 * 1000,
      maxMana: 100, currentMana: 81,
    });
    expect(beforeDue.manaRecovered).toBe(0);
    const resumed = advancePeriodicManaRecovery({
      state: beforeDue, nowTimestamp: start + 5 * 60 * 60 * 1000 + 20 * 60 * 1000,
      maxMana: 100, currentMana: 81,
    });
    expect(resumed.ticks).toBe(1);
    expect(resumed.mana).toBe(82);
  });

  it('premia la lista completa como XP extraordinaria fuera del tope de hábitos', () => {
    const state = emptyLootState();
    state.inventory.relics.fusion_04 = {
      id: 'fusion_04', unlocked: true, rarity: 'rare', rank: 1, affixes: [],
    };
    state.inventory.equipped = ['fusion_04'];
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: `hard-${index}`,
      difficulty: 'hard',
      frequency: 'daily',
      target: 1,
      active: true,
    }));
    const entries = Object.fromEntries(items.map((habit, index) => [
      `${habit.id}|d:2026-08-15`,
      {
        habitId: habit.id,
        periodKey: 'd:2026-08-15',
        frequency: 'daily',
        count: 1,
        xpAwarded: index < 4 ? 10 : 0,
      },
    ]));
    const result = awardFusionAllHabitsXp({
      state,
      habitState: { items, entries },
      dayKey: '2026-08-15',
    });
    expect(result.activated).toBe(true);
    expect(result.xp).toBe(5);
    expect(result.habitState.entries['fusion_04|d:2026-08-15']).toBeUndefined();
    expect(result.forge.fusion.dailyActivations[
      'fusion_04:all-habits:2026-08-15'
    ]).toBe(5);
  });

  it('aplica al Anillo del Antojo Roto su sinergia de lista completa según rango', () => {
    const state = emptyLootState();
    state.inventory.relics.fusion_08 = {
      id: 'fusion_08', unlocked: true, rarity: 'mythic', rank: 2, affixes: [],
    };
    state.inventory.equipped = ['fusion_08'];
    const items = [{
      id: 'daily', difficulty: 'hard', frequency: 'daily', target: 1, active: true,
    }];
    const entries = {
      'daily|d:2026-08-15': {
        habitId: 'daily', periodKey: 'd:2026-08-15', frequency: 'daily', count: 1,
      },
    };
    const result = awardFusionAllHabitsXp({
      state, habitState: { items, entries }, dayKey: '2026-08-15',
    });
    expect(result.activated).toBe(true);
    expect(result.xp).toBe(14);
    expect(result.forge.fusion.dailyActivations[
      'fusion_08:all-habits:2026-08-15'
    ]).toBe(14);
  });

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

  it('entrega reliquia, oro y Sangre una sola vez', () => {
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
    expect(six.economy.bossBlood).toBe(10);
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

  it('aplica 60% de drop y 40% de fallo solo a victorias nuevas', () => {
    const obtained = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.599999, relicRandom: sequence(0.2), nowTimestamp: 10,
    });
    const failed = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.6, relicRandom: sequence(0.2), nowTimestamp: 10,
    });
    expect(obtained.rewards[0].obtained).toBe(true);
    expect(obtained.loot.bossRelicOutcomes.boss_reward_01.status).toBe('obtained');
    expect(failed.rewards[0].obtained).toBe(false);
    expect(failed.loot.bossRelicOutcomes.boss_reward_01.status).toBe('failed');
    expect(failed.inventory.relics.relic_01).toBeUndefined();
  });

  it('resuelve el RNG de drop exactamente una vez por recompensa', () => {
    let calls = 0;
    const first = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => { calls += 1; return 0.9; },
      relicRandom: sequence(0.2), nowTimestamp: 10,
    });
    const second = grantBossRewards({
      state: first, bossesDown: 1, source: 'victory',
      dropRandom: () => { calls += 1; return 0; },
      relicRandom: sequence(0.95, 0, 0), nowTimestamp: 20,
    });
    expect(calls).toBe(1);
    expect(second.rewards).toEqual([]);
    expect(second.loot.bossRelicOutcomes.boss_reward_01.status).toBe('failed');
  });

  it('repite el mismo resultado determinista si el guardado no llegó a persistirse', () => {
    const first = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      seed: 'partida-segura', nowTimestamp: 10,
    });
    const retry = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      seed: 'partida-segura', nowTimestamp: 20,
    });
    expect(retry.rewards[0].obtained).toBe(first.rewards[0].obtained);
    expect(retry.rewards[0].rarity).toBe(first.rewards[0].rarity);
    expect(retry.rewards[0].affixes).toEqual(first.rewards[0].affixes);
  });

  it('garantiza oro y Sangre 1/1/1/2/2/3 aunque fallen todas las reliquias', () => {
    const state = grantBossRewards({
      state: emptyLootState(), bossesDown: 6, source: 'victory',
      dropRandom: () => 0.99, relicRandom: sequence(0.2), bloodRandom: () => 0.5,
      nowTimestamp: 10,
    });
    expect(state.rewards.map((reward) => reward.bossBlood)).toEqual([1, 1, 1, 2, 2, 3]);
    expect(state.economy.bossBlood).toBe(10);
    expect(state.economy.coins).toBe(650);
    expect(Object.keys(state.inventory.relics)).toHaveLength(0);
  });

  it('duplica la Sangre con una probabilidad exacta del 2% y guarda el resultado', () => {
    const lucky = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.1, relicRandom: sequence(0.2),
      bloodRandom: () => 0.019999, nowTimestamp: 10,
    });
    expect(lucky.rewards[0]).toMatchObject({
      baseBossBlood: 1, bonusBossBlood: 1, bossBlood: 2,
    });
    expect(lucky.economy.bossBlood).toBe(2);
    expect(lucky.loot.notices[0].bonusBossBlood).toBe(1);
    const normal = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.1, relicRandom: sequence(0.2),
      bloodRandom: () => 0.02, nowTimestamp: 10,
    });
    expect(normal.rewards[0]).toMatchObject({ bonusBossBlood: 0, bossBlood: 1 });
  });

  it('no vuelve a tirar la Sangre doble para una recompensa resuelta', () => {
    let bloodRolls = 0;
    const first = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.1, relicRandom: sequence(0.2),
      bloodRandom: () => { bloodRolls += 1; return 0.01; }, nowTimestamp: 10,
    });
    const second = grantBossRewards({
      state: first, bossesDown: 1, source: 'victory',
      bloodRandom: () => { bloodRolls += 1; return 0.9; }, nowTimestamp: 20,
    });
    expect(bloodRolls).toBe(1);
    expect(second.economy.bossBlood).toBe(2);
    expect(second.rewards).toEqual([]);
  });

  it('entrega exactamente +25 oro y resuelve una sola vez la tirada anticipada', () => {
    const eligibility = {
      id: 'boss_reward_01:early-victory:week-0', bossIndex: 0,
    };
    let earlyBloodRolls = 0;
    const first = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.9, bloodRandom: () => 0.5,
      earlyVictoryBonuses: [eligibility],
      earlyVictoryBloodRandom: () => { earlyBloodRolls += 1; return 0.5; },
      nowTimestamp: 10,
    });
    const second = grantBossRewards({
      state: first, bossesDown: 1, source: 'victory',
      earlyVictoryBonuses: [eligibility],
      earlyVictoryBloodRandom: () => { earlyBloodRolls += 1; return 0; },
      nowTimestamp: 20,
    });

    expect(first.economy.coins).toBe(100);
    expect(first.earlyVictoryRewards).toEqual([
      expect.objectContaining({ coins: 25, bossBlood: 0, bloodGranted: false }),
    ]);
    expect(first.economy.transactions.filter(
      (entry) => entry.id === `${eligibility.id}:grant`,
    )).toHaveLength(1);
    expect(earlyBloodRolls).toBe(1);
    expect(second.economy).toEqual(first.economy);
    expect(second.earlyVictoryRewards).toEqual([]);
  });

  it('conserva el resultado anticipado al exportar/importar y no vuelve a tirar', () => {
    const eligibility = {
      id: 'boss_reward_01:early-victory:week-4', bossIndex: 0,
    };
    const won = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.9, bloodRandom: () => 0.5,
      earlyVictoryBonuses: [eligibility], earlyVictoryBloodRandom: () => 0.05,
      nowTimestamp: 10,
    });
    const saved = { ...won, config: { startDate: '2026-07-17' }, days: {}, game: {} };
    const restored = importBackup(
      { ...emptyLootState(), config: {}, days: {}, game: {} },
      exportBackup(saved),
    );
    let rerolls = 0;
    const retried = grantBossRewards({
      state: restored, bossesDown: 1, source: 'victory',
      earlyVictoryBonuses: [eligibility],
      earlyVictoryBloodRandom: () => { rerolls += 1; return 0.9; },
      nowTimestamp: 20,
    });

    expect(rerolls).toBe(0);
    expect(retried.economy.coins).toBe(100);
    expect(retried.economy.bossBlood).toBe(2);
    expect(retried.loot.earlyVictoryOutcomes[eligibility.id]).toMatchObject({
      coins: 25, bossBlood: 1, bloodGranted: true,
    });
  });

  it('permite que el 10% anticipado y el 2% de duplicación tengan éxito a la vez', () => {
    const result = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.9,
      bloodRandom: () => 0.019,
      earlyVictoryBonuses: [{
        id: 'boss_reward_01:early-victory:week-2', bossIndex: 0,
      }],
      earlyVictoryBloodRandom: () => 0.099,
      nowTimestamp: 10,
    });

    expect(result.economy).toMatchObject({ coins: 100, bossBlood: 3 });
    expect(result.rewards[0].bonusBossBlood).toBe(1);
    expect(result.earlyVictoryRewards[0].bossBlood).toBe(1);
    expect(result.loot.notices[0]).toMatchObject({
      bonusBossBlood: 1, earlyVictoryBonusCoins: 25, earlyVictoryBonusBossBlood: 1,
    });
  });

  it('ignora el bonus anticipado en recompensas históricas', () => {
    let rolls = 0;
    const result = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'retroactive',
      earlyVictoryBonuses: [{
        id: 'boss_reward_01:early-victory:week-0', bossIndex: 0,
      }],
      earlyVictoryBloodRandom: () => { rolls += 1; return 0; },
    });
    expect(rolls).toBe(0);
    expect(result.economy.coins).toBe(75);
    expect(result.loot.earlyVictoryOutcomes).toEqual({});
  });

  it('migra conservadoramente reliquias antiguas y nunca las rerollea', () => {
    const legacy = emptyLootState();
    legacy.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 2, affixes: ['fortune'], bossIndex: 0,
    };
    const normalized = normalizeLootState(legacy);
    expect(normalized.loot.claimedBossRewards).toContain('boss_reward_01');
    expect(normalized.loot.bossRelicOutcomes.boss_reward_01.status).toBe('obtained');
    const after = grantBossRewards({
      state: normalized, bossesDown: 1, source: 'victory', dropRandom: () => 0.99,
    });
    expect(after.rewards).toEqual([]);
    expect(after.inventory.relics.relic_01).toMatchObject({ rarity: 'legendary', rank: 2 });
  });
});

describe('cambio de clase', () => {
  it('cobra una Sangre, registra la operación y bloquea duplicados', () => {
    const state = emptyLootState();
    state.economy.bossBlood = 2;
    const changed = payClassChange({
      state, fromClass: 'paladin', toClass: 'druid', operationId: 'class-1', nowTimestamp: 10,
    });
    expect(changed.ok).toBe(true);
    expect(changed.economy.bossBlood).toBe(1);
    expect(changed.economy.transactions.at(-1)).toMatchObject({
      type: 'class_change', fromClass: 'paladin', toClass: 'druid', bossBlood: -1,
    });
    const duplicate = payClassChange({
      state: changed, fromClass: 'paladin', toClass: 'druid', operationId: 'class-1',
    });
    expect(duplicate.reason).toBe('duplicate-operation');
    expect(duplicate.economy.bossBlood).toBe(1);
  });

  it('no cobra al mantener la clase y bloquea el cambio sin Sangre', () => {
    const state = emptyLootState();
    state.economy.bossBlood = 1;
    expect(payClassChange({
      state, fromClass: 'paladin', toClass: 'paladin', operationId: 'same-class',
    }).reason).toBe('same-class');
    state.economy.bossBlood = 0;
    const blocked = payClassChange({
      state, fromClass: 'paladin', toClass: 'knight', operationId: 'no-blood',
    });
    expect(blocked.reason).toBe('blood');
    expect(blocked.economy.transactions).toEqual([]);
  });
});

describe('Tienda de reliquias falladas', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = 20 * DAY;

  function failedBosses(count = 1) {
    return grantBossRewards({
      state: emptyLootState(), bossesDown: count, source: 'victory',
      dropRandom: () => 0.99, relicRandom: sequence(0.2), nowTimestamp: NOW,
    });
  }

  it('solo incluye bosses derrotados cuyo drop falló', () => {
    const failed = failedBosses(1);
    expect(shopOffers(failed, NOW).map((offer) => offer.relicId)).toEqual(['relic_01']);
    const obtained = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.1, relicRandom: sequence(0.2), nowTimestamp: NOW,
    });
    expect(shopOffers(obtained, NOW)).toEqual([]);
    expect(shopOffers(emptyLootState(), NOW)).toEqual([]);
  });

  it('deriva los precios del boss y aplica el extra de rareza solo al oro', () => {
    const offers = shopOffers(failedBosses(1), NOW);
    const first = offers.find((offer) => offer.relicId === 'relic_01');
    expect(first).toMatchObject({
      coinPrice: shopPriceForRelic('relic_01', 'failed', first.relic.rarity).coinPrice,
      bloodPrice: 1,
    });
    expect(shopPriceForRelic('relic_04')).toEqual({ coinPrice: 230, bloodPrice: 2 });
    expect(shopPriceForRelic('relic_04', 'failed', 'legendary'))
      .toEqual({ coinPrice: 311, bloodPrice: 2 });
    expect(shopPriceForRelic('relic_04', 'failed', 'mythic'))
      .toEqual({ coinPrice: 403, bloodPrice: 2 });
    expect(shopPriceForRelic('relic_06')).toEqual({ coinPrice: 290, bloodPrice: 3 });
    expect(shopPriceForRelic('relic_04', 'failed', 'rare', 2))
      .toEqual({ coinPrice: 280, bloodPrice: 3 });
    expect(shopPriceForRelic('relic_04', 'failed', 'rare', 3))
      .toEqual({ coinPrice: 380, bloodPrice: 5 });
  });

  it('paga el 70% del valor en oro según rareza y rango', () => {
    expect(shopSalePriceForRelic('relic_01', { rarity: 'rare', rank: 1 })).toBe(105);
    expect(shopSalePriceForRelic('relic_04', { rarity: 'legendary', rank: 2 })).toBe(255);
    expect(shopSalePriceForRelic('relic_07', { rarity: 'mythic', rank: 3 })).toBe(495);
    expect(shopSalePriceForRelic('fusion_04', { rarity: 'mythic', rank: 3 })).toBe(0);
  });

  it('compra una reliquia normal y la pone en circulación en la siguiente rotación', () => {
    const state = emptyLootState();
    state.economy.coins = 20;
    state.economy.bossBlood = 4;
    state.inventory.relics.relic_01 = {
      id: 'relic_01', unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 1,
    };
    const sold = sellRelicToShop({
      state, relicId: 'relic_01', operationId: 'sale-1', nowTimestamp: NOW,
    });
    expect(sold.ok).toBe(true);
    expect(sold.sale.coinsReceived).toBe(105);
    expect(sold.economy).toMatchObject({ coins: 125, bossBlood: 4 });
    expect(sold.inventory.relics.relic_01).toBeUndefined();
    expect(sold.inventory.collection.relic_01.lastOwnedRecord.rarity).toBe('rare');
    expect(sold.economy.transactions.at(-1)).toMatchObject({
      type: 'shop_sale', coins: 105, bossBlood: 0,
    });
    expect(shopOffers(sold, NOW)).toEqual([]);
    const nextRotation = sold.shop.rotation.endsAt;
    const offer = shopOffers(sold, nextRotation)
      .find((candidate) => candidate.relicId === 'relic_01');
    expect(offer).toBeTruthy();
    expect(offer.source).toBe('sold');
    expect(offer.relic.rarity).not.toBe('rare');
  });

  it('migra las ventas bloqueadas por la antigua rotación de tres días', () => {
    const soldAt = new Date(2026, 8, 3, 19, 59, 42).getTime();
    const nextMidnight = new Date(2026, 8, 4, 0, 0, 0, 0).getTime();
    const legacyAvailableAt = new Date(2026, 8, 6, 17, 46, 8).getTime();
    const state = emptyLootState();
    state.inventory.collection.relic_07 = {
      discoveredAt: soldAt,
      lastOwnedRecord: {
        id: 'relic_07', unlocked: true, rarity: 'rare', rank: 1,
        affixes: [], obtainedAt: soldAt, bossIndex: 6,
      },
    };
    state.shop.sales = [{
      id: 'shop-sale:legacy', operationId: 'legacy', relicId: 'relic_07',
      relic: state.inventory.collection.relic_07.lastOwnedRecord,
      coinsReceived: 225, at: soldAt, availableAt: legacyAvailableAt,
    }];

    const beforeMidnight = ensureShopRotation(state, nextMidnight - 1);
    expect(beforeMidnight.shop.sales[0].availableAt).toBe(nextMidnight);
    expect(shopOffers(beforeMidnight, nextMidnight - 1)).toEqual([]);

    const afterMidnight = ensureShopRotation(beforeMidnight, nextMidnight);
    const offer = shopOffers(afterMidnight, nextMidnight)
      .find((candidate) => candidate.relicId === 'relic_07');
    expect(offer).toBeTruthy();
    expect(offer.source).toBe('sold');
  });

  it('no compra reliquias equipadas, fusionadas ni repite una venta', () => {
    const state = emptyLootState();
    state.inventory.relics.relic_01 = {
      id: 'relic_01', unlocked: true, rarity: 'rare', rank: 1, affixes: [], obtainedAt: 1,
    };
    state.inventory.equipped = ['relic_01'];
    expect(sellRelicToShop({
      state, relicId: 'relic_01', operationId: 'blocked', nowTimestamp: NOW,
    }).reason).toBe('equipped');
    state.inventory.equipped = [];
    const sold = sellRelicToShop({
      state, relicId: 'relic_01', operationId: 'sale-once', nowTimestamp: NOW,
    });
    expect(sellRelicToShop({
      state: sold, relicId: 'relic_01', operationId: 'sale-once', nowTimestamp: NOW,
    }).reason).toBe('duplicate-operation');
    expect(sellRelicToShop({
      state, relicId: 'fusion_04', operationId: 'fusion-sale', nowTimestamp: NOW,
    }).reason).toBe('fusion');
  });

  it('sortea los rangos con probabilidades 50/35/15', () => {
    expect(shopRankFromRoll(0)).toBe(1);
    expect(shopRankFromRoll(0.4999)).toBe(1);
    expect(shopRankFromRoll(0.5)).toBe(2);
    expect(shopRankFromRoll(0.8499)).toBe(2);
    expect(shopRankFromRoll(0.85)).toBe(3);
    expect(shopRankFromRoll(0.9999)).toBe(3);
  });

  it('compra de forma atómica con oro y Sangre suficientes', () => {
    const state = failedBosses(1);
    const offer = shopOffers(state, NOW)[0];
    state.economy.coins = offer.coinPrice + 50;
    state.economy.bossBlood = 2;
    const result = purchaseShopRelic({
      state, relicId: 'relic_01', operationId: 'buy-1', nowTimestamp: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.economy).toMatchObject({ coins: 50, bossBlood: 1 });
    expect(result.inventory.relics.relic_01).toMatchObject({
      rarity: offer.relic.rarity,
      affixes: offer.relic.affixes,
    });
    expect(result.loot.bossRelicOutcomes.boss_reward_01.status).toBe('purchased');
    expect(result.economy.transactions.at(-1)).toMatchObject({
      type: 'shop_purchase', coins: -offer.coinPrice, bossBlood: -1,
    });
    expect(shopOffers(result, NOW)).toEqual([]);
  });

  it('no modifica nada cuando falta oro o Sangre', () => {
    const noCoins = failedBosses(1);
    const coinPrice = shopOffers(noCoins, NOW)[0].coinPrice;
    noCoins.economy.coins = coinPrice - 1;
    noCoins.economy.bossBlood = 5;
    const coinsResult = purchaseShopRelic({
      state: noCoins, relicId: 'relic_01', operationId: 'no-coins', nowTimestamp: NOW,
    });
    expect(coinsResult.reason).toBe('coins');
    expect(coinsResult.economy).toMatchObject({ coins: coinPrice - 1, bossBlood: 5 });
    expect(coinsResult.inventory.relics.relic_01).toBeUndefined();
    const noBlood = failedBosses(1);
    noBlood.economy.coins = coinPrice;
    noBlood.economy.bossBlood = 0;
    const bloodResult = purchaseShopRelic({
      state: noBlood, relicId: 'relic_01', operationId: 'no-blood', nowTimestamp: NOW,
    });
    expect(bloodResult.reason).toBe('blood');
    expect(bloodResult.economy.coins).toBe(coinPrice);
    expect(bloodResult.inventory.relics.relic_01).toBeUndefined();
  });

  it('impide una compra doble con el mismo evento o la misma reliquia', () => {
    const state = failedBosses(1);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    const first = purchaseShopRelic({
      state, relicId: 'relic_01', operationId: 'same', nowTimestamp: NOW,
    });
    const duplicate = purchaseShopRelic({
      state: first, relicId: 'relic_01', operationId: 'same', nowTimestamp: NOW,
    });
    const otherEvent = purchaseShopRelic({
      state: first, relicId: 'relic_01', operationId: 'other', nowTimestamp: NOW,
    });
    expect(duplicate.reason).toBe('duplicate-operation');
    expect(otherEvent.reason).toBe('unavailable');
    expect(duplicate.economy.coins).toBe(first.economy.coins);
  });

  it('rota cada día, mantiene una única pendiente y limita a tres', () => {
    const one = ensureShopRotation(failedBosses(1), NOW);
    expect(one.shop.rotation.relicIds).toEqual(['relic_01']);
    expect(one.shop.rotation.offerQualities.relic_01.rarity)
      .not.toBe(one.loot.bossRelicOutcomes.boss_reward_01.relic.rarity);
    const oneNext = ensureShopRotation(one, NOW + DAY);
    expect(oneNext.shop.rotation.offerQualities.relic_01.rarity)
      .not.toBe(one.shop.rotation.offerQualities.relic_01.rarity);
    const many = ensureShopRotation(failedBosses(6), NOW);
    expect(many.shop.rotation.relicIds).toHaveLength(3);
    const same = ensureShopRotation(JSON.parse(JSON.stringify(many)), NOW + DAY / 2);
    expect(same.shop.rotation).toEqual(many.shop.rotation);
    const next = ensureShopRotation(same, NOW + DAY);
    expect(next.shop.rotation.period).toBeGreaterThan(same.shop.rotation.period);
    expect(next.shop.rotation.relicIds).not.toEqual(same.shop.rotation.relicIds);
    const clockMovedBack = ensureShopRotation(next, NOW);
    expect(clockMovedBack.shop.rotation).toEqual(next.shop.rotation);
    const seen = new Set();
    const lastSeenRarity = new Map();
    let rotating = many;
    for (let index = 0; index < 6; index += 1) {
      rotating = ensureShopRotation(rotating, NOW + index * DAY);
      rotating.shop.rotation.relicIds.forEach((id) => {
        const rarity = rotating.shop.rotation.offerQualities[id].rarity;
        if (lastSeenRarity.has(id)) expect(rarity).not.toBe(lastSeenRarity.get(id));
        lastSeenRarity.set(id, rarity);
        seen.add(id);
      });
    }
    expect(seen).toEqual(new Set([
      'relic_01', 'relic_02', 'relic_03', 'relic_04', 'relic_05', 'relic_06',
    ]));
  });

  it('cambia exactamente al llegar a las 00:00 de la hora local', () => {
    const beforeMidnight = new Date(2026, 8, 3, 23, 59, 59, 999).getTime();
    const midnight = new Date(2026, 8, 4, 0, 0, 0, 0).getTime();
    const before = ensureShopRotation(failedBosses(4), beforeMidnight);
    expect(before.shop.rotation.startedAt)
      .toBe(new Date(2026, 8, 3, 0, 0, 0, 0).getTime());
    expect(before.shop.rotation.endsAt).toBe(midnight);
    const after = ensureShopRotation(before, midnight);
    expect(after.shop.rotation.period).toBeGreaterThan(before.shop.rotation.period);
    expect(after.shop.rotation.startedAt).toBe(midnight);
    expect(after.shop.rotation.endsAt)
      .toBe(new Date(2026, 8, 5, 0, 0, 0, 0).getTime());
  });

  it('serializa, recupera y recalcula sin rerollear drop ni Tienda', () => {
    const original = ensureShopRotation(failedBosses(4), NOW);
    const restored = normalizeLootState(JSON.parse(JSON.stringify(original)));
    const rewardedAgain = grantBossRewards({
      state: restored, bossesDown: 4, source: 'victory', dropRandom: () => 0,
    });
    expect(rewardedAgain.rewards).toEqual([]);
    expect(ensureShopRotation(restored, NOW).shop.rotation)
      .toEqual(original.shop.rotation);
    expect(restored.loot.bossRelicOutcomes).toEqual(original.loot.bossRelicOutcomes);
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

  it('impide equipar dos reliquias nuevas de la misma familia de efecto', () => {
    const raw = emptyLootState();
    for (const relicId of ['relic_07', 'relic_08', 'relic_11', 'relic_12']) {
      raw.inventory.relics[relicId] = {
        unlocked: true, rarity: 'rare', rank: 1, affixes: [],
      };
    }
    let state = equipRelic(raw, 'relic_07');
    const experienceConflict = equipRelic(state, 'relic_11');
    expect(experienceConflict.reason).toBe('effect-family-conflict');
    expect(experienceConflict.effectFamily).toBe('experience');

    state = equipRelic(state, 'relic_12');
    expect(state.ok).toBe(true);
    const coinsConflict = equipRelic(state, 'relic_08', 0);
    expect(coinsConflict.reason).toBe('effect-family-conflict');
    expect(coinsConflict.effectFamily).toBe('coins');
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
      maxManaPercent: 5,
      manaRecoveryPercentBonus: 5,
      habitXpBonus: 1,
      fortune: 3,
      magicAttack: 1,
      physicalAttack: 1,
      defense: 0,
    });
    raw.inventory.relics.relic_02.affixes = ['regeneration', 'arcane'];
    raw.inventory.relics.relic_03.affixes = ['vitality', 'fortune'];
    expect(equippedRelicBonuses(raw)).toMatchObject({
      maxHpPercent: 5,
      maxManaPercent: 5,
      regenerationMinutesReduction: 2,
      fortune: 3,
    });
  });

  it('la Malla devuelve oro únicamente cuando falla una mejora', () => {
    const raw = emptyLootState();
    raw.economy.coins = 100;
    raw.economy.bossBlood = 5;
    raw.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [],
    };
    raw.inventory.relics.relic_09 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [],
    };
    raw.inventory.equipped = ['relic_09'];
    const failed = attemptForge({
      state: raw, relicId: 'relic_01', operationId: 'malla-fallo', randomValue: 0.99,
    });
    expect(failed.success).toBe(false);
    expect(failed.spentCoins).toBe(50);
    expect(failed.coinsRefunded).toBe(10);
    expect(failed.economy.coins).toBe(60);
  });

  it('la Calavera puede conceder una Sangre adicional en la recompensa semanal', () => {
    const raw = emptyLootState();
    raw.inventory.relics.relic_10 = {
      unlocked: true, rarity: 'rare', rank: 1, affixes: [],
    };
    raw.inventory.equipped = ['relic_10'];
    const rewarded = grantBossRewards({
      state: raw,
      bossesDown: 1,
      source: 'victory',
      dropRandom: () => 0,
      relicRandom: sequence(0.2),
      bloodRandom: () => 0.5,
      relicBloodRandom: () => 0.05,
      nowTimestamp: 10,
    });
    expect(rewarded.rewards[0].baseBossBlood).toBe(1);
    expect(rewarded.rewards[0].relicBonusBossBlood).toBe(1);
    expect(rewarded.rewards[0].bossBlood).toBe(2);
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

describe('preview puro de Fusión', () => {
  function fusionState() {
    const state = unlockedState(2);
    state.economy.coins = 500;
    state.economy.bossBlood = 4;
    Object.assign(state.inventory.relics.relic_01, {
      rarity: 'legendary', rank: 2, affixes: ['vitality'],
    });
    Object.assign(state.inventory.relics.relic_02, {
      rarity: 'legendary', rank: 1, affixes: ['arcane'],
    });
    return state;
  }

  it('calcula nombre, rango, efectos heredados y calidad sin RNG ni efectos secundarios', () => {
    const state = fusionState();
    const before = JSON.stringify(state);
    const originalRandom = Math.random;
    Math.random = () => { throw new Error('El preview no debe ejecutar RNG'); };
    let preview;
    try {
      preview = getForgeFusionPreview(state, 'relic_01', 'relic_02');
    } finally {
      Math.random = originalRandom;
    }
    expect(preview).toMatchObject({
      ok: true,
      successProbability: 70,
      qualityDeterministic: true,
      resultRank: 2,
      resultRarity: 'mythic',
      resultAffixes: ['vitality', 'arcane'],
      inheritedEffects: { relic_01: 7, relic_02: 5 },
    });
    expect(preview.definition.name).toBe('Corazón Espectral');
    expect(preview.resultRelic).toMatchObject({
      rank: 2, rarity: 'mythic',
      inheritedEffects: { relic_01: 7, relic_02: 5 },
    });
    expect(JSON.stringify(state)).toBe(before);
    expect(state.economy).toMatchObject({ coins: 500, bossBlood: 4 });
    expect(state.forge.attempts).toEqual({});
    expect(state.forge.history).toEqual([]);
    expect(state.forge.fusion.history).toEqual([]);
    expect(state.economy.transactions).toHaveLength(2);
  });

  it('devuelve incompatible sin inventar un resultado ni modificar la partida', () => {
    const state = unlockedState(6);
    const before = JSON.stringify(state);
    const preview = getForgeFusionPreview(state, 'relic_03', 'relic_06');
    expect(preview).toMatchObject({
      ok: false, reason: 'incompatible', status: 'incompatible', resultRelic: null,
    });
    expect(preview.definition).toBeNull();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('la operación real posterior conserva exactamente el resultado conocido', () => {
    const state = fusionState();
    const preview = getForgeFusionPreview(state, 'relic_01', 'relic_02');
    const result = fuseRelics({
      state, leftId: 'relic_01', rightId: 'relic_02', operationId: 'after-preview', randomValue: 0, nowTimestamp: 20,
    });
    expect(result.ok).toBe(true);
    expect(result.fusedRelic).toMatchObject({
      rank: preview.resultRank,
      rarity: preview.resultRarity,
      affixes: preview.resultAffixes,
      inheritedEffects: preview.inheritedEffects,
    });
    expect(result.economy).toMatchObject({ coins: 400, bossBlood: 3 });
    expect(result.forge.fusion.history).toHaveLength(1);
    expect(result.economy.transactions.at(-1).id).toBe('fusion:after-preview');
  });

  it('desfusiona por 250 de oro y una Sangre conservando las reliquias originales', () => {
    const fused = fuseRelics({
      state: fusionState(), leftId: 'relic_01', rightId: 'relic_02',
      operationId: 'fusion-before-defusion', randomValue: 0, nowTimestamp: 20,
    });
    const preview = getDefusionPreview(fused, 'fusion_01');
    expect(preview).toMatchObject({ ok: true, coinCost: 250, bloodCost: 1 });
    const result = defuseRelic({
      state: fused, relicId: 'fusion_01', operationId: 'defusion-1', nowTimestamp: 30,
    });
    expect(result.ok).toBe(true);
    expect(result.economy).toMatchObject({ coins: 150, bossBlood: 2 });
    expect(result.inventory.relics.fusion_01).toBeUndefined();
    expect(result.inventory.relics.relic_01).toMatchObject({ rarity: 'legendary', rank: 2, affixes: ['vitality'] });
    expect(result.inventory.relics.relic_02).toMatchObject({ rarity: 'legendary', rank: 1, affixes: ['arcane'] });
    expect(result.forge.fusion.history.at(-1)).toMatchObject({ type: 'defusion', coinsSpent: 250, bossBloodSpent: 1 });
    expect(result.economy.transactions.at(-1)).toMatchObject({ id: 'defusion:defusion-1', type: 'relic_defusion' });
  });

  it('no desfusiona si ya se posee una reliquia original', () => {
    const fused = fuseRelics({
      state: fusionState(), leftId: 'relic_01', rightId: 'relic_02',
      operationId: 'fusion-owned-base', randomValue: 0, nowTimestamp: 20,
    });
    fused.inventory.relics.relic_01 = fused.inventory.collection.relic_01.lastOwnedRecord;
    expect(getDefusionPreview(fused, 'fusion_01')).toMatchObject({
      ok: false, reason: 'ingredient-owned', ingredientAlreadyOwned: 'relic_01',
    });
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
    state.forge.seed = 'forge-test-seed';
    return state;
  }

  function seedForOutcome(expectedSuccess, probability = 70) {
    for (let index = 0; index < 10_000; index += 1) {
      const seed = `rollback-${index}`;
      const success = forgeAttemptRoll(seed, 'relic_01', 2, 1) < probability / 100;
      if (success === expectedSuccess) return seed;
    }
    throw new Error('No se encontró una semilla de prueba');
  }

  it('deriva un valor estable de semilla, reliquia, rango e intento lógico', () => {
    const first = forgeAttemptRoll('save-abc', 'relic_01', 2, 3);
    expect(forgeAttemptRoll('save-abc', 'relic_01', 2, 3)).toBe(first);
    expect(forgeAttemptRoll('save-abc', 'relic_01', 2, 4)).not.toBe(first);
    expect(forgeAttemptRoll('save-abc', 'relic_01', 3, 3)).not.toBe(first);
  });

  it.each([
    ['exportación', false],
    ['backup automático', false],
    ['copia diaria', false],
    ['copia semanal', false],
    ['última partida con información', false],
    ['IndexedDB', false],
    ['exportación antes de un éxito', true],
  ])('repite el resultado tras restaurar desde %s', (_source, expectedSuccess) => {
    const before = forgeState();
    before.forge.seed = seedForOutcome(expectedSuccess);
    const snapshot = JSON.stringify(before);
    const first = attemptForge({
      state: before, relicId: 'relic_01', operationId: 'first', nowTimestamp: 10,
    });
    const restored = JSON.parse(snapshot);
    const retry = attemptForge({
      state: restored, relicId: 'relic_01', operationId: 'retry', nowTimestamp: 20,
    });
    expect(first.success).toBe(expectedSuccess);
    expect(retry.success).toBe(first.success);
    expect(retry.forge.history.at(-1).roll).toBe(first.forge.history.at(-1).roll);
    expect(retry.forge.history.at(-1).logicalAttemptNumber).toBe(1);
    expect(retry.economy.coins).toBe(first.economy.coins);
    expect(retry.economy.bossBlood).toBe(first.economy.bossBlood);
  });

  it('mantiene Pity y Fortuna sobre la misma tirada lógica', () => {
    const state = forgeState({ fortune: true });
    state.forge.seed = seedForOutcome(false, 73);
    const first = attemptForge({
      state, relicId: 'relic_01', operationId: 'fortune-1', nowTimestamp: 10,
    });
    expect(first.preview).toMatchObject({ pityProbability: 70, fortune: 3, finalProbability: 73 });
    expect(first.success).toBe(false);
    const second = attemptForge({
      state: first, relicId: 'relic_01', operationId: 'fortune-2', nowTimestamp: 20,
    });
    expect(second.preview).toMatchObject({ pityProbability: 85, fortune: 3, finalProbability: 88 });
    expect(second.forge.history.at(-1).logicalAttemptNumber).toBe(2);
  });

  it('migra una partida antigua una sola vez y conserva la semilla al normalizar', () => {
    const legacy = forgeState();
    legacy.forge.seed = '';
    legacy.onboarded = true;
    legacy.config = { startDate: '2026-07-17', startLimit: 20 };
    legacy.game = { name: 'Farenheil', cls: 'sorcerer' };
    const migrated = initializeForgeSeed(legacy);
    const loadedAgain = initializeForgeSeed(JSON.parse(JSON.stringify(migrated)));
    expect(migrated.forge.seed).toMatch(/^legacy-/);
    expect(loadedAgain.forge.seed).toBe(migrated.forge.seed);
  });

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
    expect(forgePreview(state, 'relic_01').finalProbability).toBe(73);
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
