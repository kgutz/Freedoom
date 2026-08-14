import { describe, expect, it } from 'vitest';
import {
  acknowledgeLootNotice,
  attemptForge,
  canActivateDailyRelic,
  deterministicRelicRoll,
  emptyLootState,
  ensureShopRotation,
  equipRelic,
  equippedRelicBonuses,
  forgePreview,
  forgeAttemptRoll,
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

  it('aplica 70% de drop y 30% de fallo solo a victorias nuevas', () => {
    const obtained = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.699999, relicRandom: sequence(0.2), nowTimestamp: 10,
    });
    const failed = grantBossRewards({
      state: emptyLootState(), bossesDown: 1, source: 'victory',
      dropRandom: () => 0.7, relicRandom: sequence(0.2), nowTimestamp: 10,
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

  it('deriva los precios del reward del boss', () => {
    const offers = shopOffers(failedBosses(6), NOW);
    const first = offers.find((offer) => offer.relicId === 'relic_01');
    expect(first).toMatchObject({ coinPrice: 150, bloodPrice: 1 });
    expect(shopPriceForRelic('relic_04')).toEqual({ coinPrice: 230, bloodPrice: 2 });
    expect(shopPriceForRelic('relic_06')).toEqual({ coinPrice: 290, bloodPrice: 3 });
  });

  it('compra de forma atómica con oro y Sangre suficientes', () => {
    const state = failedBosses(1);
    state.economy.coins = 200;
    state.economy.bossBlood = 2;
    const result = purchaseShopRelic({
      state, relicId: 'relic_01', operationId: 'buy-1', nowTimestamp: NOW,
    });
    expect(result.ok).toBe(true);
    expect(result.economy).toMatchObject({ coins: 50, bossBlood: 1 });
    expect(result.inventory.relics.relic_01).toBeTruthy();
    expect(result.loot.bossRelicOutcomes.boss_reward_01.status).toBe('purchased');
    expect(result.economy.transactions.at(-1)).toMatchObject({
      type: 'shop_purchase', coins: -150, bossBlood: -1,
    });
    expect(shopOffers(result, NOW)).toEqual([]);
  });

  it('no modifica nada cuando falta oro o Sangre', () => {
    const noCoins = failedBosses(1);
    noCoins.economy.coins = 149;
    noCoins.economy.bossBlood = 5;
    const coinsResult = purchaseShopRelic({
      state: noCoins, relicId: 'relic_01', operationId: 'no-coins', nowTimestamp: NOW,
    });
    expect(coinsResult.reason).toBe('coins');
    expect(coinsResult.economy).toMatchObject({ coins: 149, bossBlood: 5 });
    expect(coinsResult.inventory.relics.relic_01).toBeUndefined();
    const noBlood = failedBosses(1);
    noBlood.economy.coins = 200;
    noBlood.economy.bossBlood = 0;
    const bloodResult = purchaseShopRelic({
      state: noBlood, relicId: 'relic_01', operationId: 'no-blood', nowTimestamp: NOW,
    });
    expect(bloodResult.reason).toBe('blood');
    expect(bloodResult.economy.coins).toBe(200);
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

  it('rota cada tres días, mantiene una única pendiente y limita a tres', () => {
    const one = ensureShopRotation(failedBosses(1), NOW);
    expect(one.shop.rotation.relicIds).toEqual(['relic_01']);
    const many = ensureShopRotation(failedBosses(6), NOW);
    expect(many.shop.rotation.relicIds).toHaveLength(3);
    const same = ensureShopRotation(JSON.parse(JSON.stringify(many)), NOW + DAY / 2);
    expect(same.shop.rotation).toEqual(many.shop.rotation);
    const next = ensureShopRotation(same, NOW + 3 * DAY);
    expect(next.shop.rotation.period).toBeGreaterThan(same.shop.rotation.period);
    expect(next.shop.rotation.relicIds).not.toEqual(same.shop.rotation.relicIds);
    const clockMovedBack = ensureShopRotation(next, NOW);
    expect(clockMovedBack.shop.rotation).toEqual(next.shop.rotation);
    const seen = new Set();
    let rotating = many;
    for (let index = 0; index < 6; index += 1) {
      rotating = ensureShopRotation(rotating, NOW + index * 3 * DAY);
      rotating.shop.rotation.relicIds.forEach((id) => seen.add(id));
    }
    expect(seen).toEqual(new Set([
      'relic_01', 'relic_02', 'relic_03', 'relic_04', 'relic_05', 'relic_06',
    ]));
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
    state.forge.seed = seedForOutcome(false, 71);
    const first = attemptForge({
      state, relicId: 'relic_01', operationId: 'fortune-1', nowTimestamp: 10,
    });
    expect(first.preview).toMatchObject({ pityProbability: 70, fortune: 1, finalProbability: 71 });
    expect(first.success).toBe(false);
    const second = attemptForge({
      state: first, relicId: 'relic_01', operationId: 'fortune-2', nowTimestamp: 20,
    });
    expect(second.preview).toMatchObject({ pityProbability: 85, fortune: 1, finalProbability: 86 });
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
