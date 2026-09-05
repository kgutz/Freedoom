import { describe, expect, it } from 'vitest';
import { castSpellEffect } from './spell-rules.js';
import { exportBackup, importBackup } from '../storage/state-storage.js';
import { RARITIES } from '../data/loot-data.js';
import {
  activateRelicConstancy,
  awardFusionAllHabitsXp,
  canActivateFusionDaily,
  emptyLootState,
  ensureShopRotation,
  equipRelic,
  equippedRelicBonuses,
  equippedRelicEffectSources,
  fuseRelics,
  fusionPreview,
  fusionRecipeStatus,
  grantBossRewards,
  markFusionDaily,
  normalizeLootState,
  purchaseShopRelic,
  shopOffers,
  shopPriceForRelic,
  syncRelicConstancy,
} from './loot-rules.js';

function fusionState(count = 6) {
  const state = grantBossRewards({
    state: emptyLootState(),
    bossesDown: count,
    source: 'retroactive',
    seed: 'fusion-tests',
    nowTimestamp: 1,
  });
  state.economy.coins = 1000;
  state.economy.bossBlood = 20;
  state.loot.notices = [];
  return state;
}

function fuse(state, leftId, rightId, operationId = 'fusion-op') {
  return fuseRelics({ state, leftId, rightId, operationId, randomValue: 0, nowTimestamp: 10 });
}

describe('Fusión de reliquias', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 2],
    [3, 3, 3],
  ])('Rango %i + Rango %i produce una fusión de Rango %i sin alterar cada potencia',
    (leftRank, rightRank, expectedRank) => {
      const state = fusionState(2);
      state.inventory.relics.relic_01.rank = leftRank;
      state.inventory.relics.relic_02.rank = rightRank;
      const result = fuse(state, 'relic_01', 'relic_02', `ranks-${leftRank}-${rightRank}`);
      const expectedLeftValue = [0, 5, 7, 10][leftRank];
      const expectedRightValue = [0, 5, 7, 10][rightRank];
      expect(result.fusedRelic.rank).toBe(expectedRank);
      expect(result.fusedRelic.ingredientSnapshots.relic_01).toMatchObject({
        rank: leftRank, effectValue: expectedLeftValue,
      });
      expect(result.fusedRelic.ingredientSnapshots.relic_02).toMatchObject({
        rank: rightRank, effectValue: expectedRightValue,
      });
      expect(result.fusedRelic.inheritedEffects).toEqual({
        relic_01: expectedLeftValue,
        relic_02: expectedRightValue,
      });
    });

  it('bloquea la fusión de reliquias con rangos diferentes', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01.rank = 2;
    state.inventory.relics.relic_02.rank = 1;
    expect(fusionPreview(state, 'relic_01', 'relic_02')).toMatchObject({
      ok: false, reason: 'rank-mismatch',
    });
  });

  it('mantiene oculta una receta desconocida y la descubre permanentemente al fusionar', () => {
    const state = fusionState(2);
    const before = fusionPreview(state, 'relic_01', 'relic_02');
    expect(before).toMatchObject({ ok: true, discovered: false });
    const result = fuse(state, 'relic_01', 'relic_02');
    expect(result.ok).toBe(true);
    expect(result.newlyDiscovered).toBe(true);
    expect(result.forge.fusion.discoveredRecipes).toContain('fusion_recipe_01');
    expect(fusionPreview(result, 'relic_02', 'relic_01')).toMatchObject({
      discovered: true,
      reason: 'already-owned',
    });
  });

  it('trata A+B igual que B+A y diferencia incompatibles de combinaciones futuras', () => {
    expect(fusionRecipeStatus('relic_01', 'relic_02').definition.id).toBe('fusion_01');
    expect(fusionRecipeStatus('relic_02', 'relic_01').definition.id).toBe('fusion_01');
    expect(fusionRecipeStatus('relic_01', 'relic_07').definition.id).toBe('fusion_06');
    expect(fusionRecipeStatus('relic_02', 'relic_07').definition.id).toBe('fusion_07');
    expect(fusionRecipeStatus('relic_05', 'relic_07').definition).toMatchObject({
      id: 'fusion_08',
      name: 'Anillo del Antojo Roto',
      image: 'relics/fusion_08_anillo_antojo_roto.webp',
    });
    expect(fusionRecipeStatus('relic_02', 'relic_05').status).toBe('incompatible');
    expect(fusionRecipeStatus('relic_04', 'relic_06').status).toBe('incompatible');
    expect(fusionRecipeStatus('relic_03', 'relic_06').status).toBe('incompatible');
    expect(fusionRecipeStatus('relic_01', 'relic_03')).toMatchObject({
      status: 'available', definition: { id: 'fusion_09' },
    });
    expect(fusionRecipeStatus('relic_01', 'relic_01').status).toBe('same-relic');
  });

  it.each([
    ['fusion_09', 'relic_01', 'relic_03'],
    ['fusion_10', 'relic_01', 'relic_05'],
    ['fusion_11', 'relic_01', 'relic_06'],
    ['fusion_12', 'relic_02', 'relic_03'],
    ['fusion_13', 'relic_02', 'relic_04'],
    ['fusion_14', 'relic_02', 'relic_06'],
    ['fusion_15', 'relic_04', 'relic_05'],
    ['fusion_16', 'relic_05', 'relic_06'],
  ])('fusiona la receta nueva %s y conserva ambos efectos',
    (fusionId, leftId, rightId) => {
      const result = fuse(fusionState(7), leftId, rightId, `new-${fusionId}`);
      expect(result.ok).toBe(true);
      expect(result.inventory.relics[fusionId]).toMatchObject({
        kind: 'fusion',
        ingredientIds: expect.arrayContaining([leftId, rightId]),
        inheritedEffects: {
          [leftId]: expect.any(Number),
          [rightId]: expect.any(Number),
        },
      });
    });

  it('consume ingredientes, entrega el resultado y conserva valores históricos sin reroll', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 3, affixes: ['vitality'], bossIndex: 0,
    };
    state.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'mythic', rank: 3, affixes: ['arcane', 'vitality'], bossIndex: 1,
    };
    const result = fuse(state, 'relic_01', 'relic_02');
    expect(result.inventory.relics.relic_01).toBeUndefined();
    expect(result.inventory.relics.relic_02).toBeUndefined();
    expect(result.inventory.relics.fusion_01).toMatchObject({
      kind: 'fusion',
      rank: 3,
      rarity: 'mythic',
      inheritedEffects: { relic_01: 10, relic_02: 10 },
      affixes: ['vitality', 'arcane'],
    });
    expect(result.economy).toMatchObject({ coins: 900, bossBlood: 19 });
    expect(result.forge.fusion.history.at(-1).ingredients.relic_01.rank).toBe(3);
    const restored = normalizeLootState(JSON.parse(JSON.stringify(result)));
    expect(restored.inventory.relics.fusion_01.inheritedEffects).toEqual({
      relic_01: 10, relic_02: 10,
    });
    const equipped = equipRelic(restored, 'fusion_01');
    expect(equippedRelicEffectSources(equipped, 'relic_01')[0].value).toBe(10);
    expect(equippedRelicEffectSources(equipped, 'relic_02')[0].value).toBe(10);
    expect(equippedRelicBonuses(equipped)).toMatchObject({ maxHpPercent: 5, maxManaPercent: 5 });
  });

  it('la Daga del Antojo conserva ataque y poder mágico de sus dos ingredientes', () => {
    const state = fusionState(6);
    state.inventory.relics.relic_03.rank = 2;
    state.inventory.relics.relic_05.rank = 2;
    const result = fuse(state, 'relic_03', 'relic_05', 'combat-stats');
    const equipped = equipRelic(result, 'fusion_04');

    expect(equippedRelicBonuses(equipped)).toMatchObject({
      physicalAttack: 2,
      magicAttack: 2,
      defense: 0,
    });
  });

  it('garantiza la rareza mayor y asciende según los efectos extras únicos', () => {
    const complementary = fusionState(2);
    complementary.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 1, affixes: ['vitality'],
    };
    complementary.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'legendary', rank: 1, affixes: ['arcane'],
    };
    expect(fusionPreview(complementary, 'relic_01', 'relic_02')).toMatchObject({
      resultRarity: 'mythic', resultAffixes: ['vitality', 'arcane'],
    });
    const mythic = fuse(complementary, 'relic_01', 'relic_02', 'rarity-complementary');
    expect(mythic.fusedRelic).toMatchObject({
      rarity: 'mythic', affixes: ['vitality', 'arcane'],
    });

    const duplicated = fusionState(2);
    duplicated.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 1, affixes: ['vitality'],
    };
    duplicated.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'legendary', rank: 1, affixes: ['vitality'],
    };
    const legendary = fuse(duplicated, 'relic_01', 'relic_02', 'rarity-duplicate');
    expect(legendary.fusedRelic).toMatchObject({
      rarity: 'legendary', affixes: ['vitality'],
    });
  });

  it('es idempotente y no modifica recursos si faltan ingredientes o se repite la operación', () => {
    const first = fuse(fusionState(2), 'relic_01', 'relic_02', 'same');
    const repeated = fuse(first, 'relic_01', 'relic_02', 'same');
    expect(repeated.reason).toBe('duplicate-operation');
    expect(repeated.economy).toEqual(first.economy);
    expect(repeated.inventory.relics.fusion_01).toEqual(first.inventory.relics.fusion_01);
    const missing = fuseRelics({
      state: fusionState(1), leftId: 'relic_01', rightId: 'relic_02', operationId: 'missing',
    });
    expect(missing.reason).toBe('missing-ingredients');
    expect(missing.economy.coins).toBe(1000);
    expect(missing.inventory.relics.relic_01).toBeDefined();
  });

  it('aumenta de 70 a 85 y 100 por ciento sin consumir reliquias ni Sangre al fallar', () => {
    const initial = fusionState(2);
    const first = fuseRelics({
      state: initial, leftId: 'relic_01', rightId: 'relic_02',
      operationId: 'fusion-fail-1', randomValue: 0.99, nowTimestamp: 10,
    });
    expect(first).toMatchObject({
      ok: true, success: false, spentCoins: 100, spentBossBlood: 0, nextProbability: 85,
    });
    expect(first.inventory.relics.relic_01).toBeDefined();
    expect(first.inventory.relics.relic_02).toBeDefined();
    expect(first.inventory.relics.fusion_01).toBeUndefined();
    expect(first.economy).toMatchObject({ coins: 900, bossBlood: 20 });
    expect(fusionPreview(first, 'relic_01', 'relic_02').successProbability).toBe(85);

    const second = fuseRelics({
      state: first, leftId: 'relic_01', rightId: 'relic_02',
      operationId: 'fusion-fail-2', randomValue: 0.99, nowTimestamp: 11,
    });
    expect(second).toMatchObject({ success: false, nextProbability: 100 });
    expect(second.economy).toMatchObject({ coins: 800, bossBlood: 20 });
    expect(fusionPreview(second, 'relic_01', 'relic_02').successProbability).toBe(100);

    const third = fuseRelics({
      state: second, leftId: 'relic_01', rightId: 'relic_02',
      operationId: 'fusion-success-3', randomValue: 0.99, nowTimestamp: 12,
    });
    expect(third).toMatchObject({ ok: true, success: true, spentBossBlood: 1 });
    expect(third.inventory.relics.relic_01).toBeUndefined();
    expect(third.inventory.relics.relic_02).toBeUndefined();
    expect(third.inventory.relics.fusion_01).toBeDefined();
    expect(third.economy).toMatchObject({ coins: 700, bossBlood: 19 });
    expect(third.forge.fusion.attempts).not.toHaveProperty('fusion_01');
  });

  it('exportar, importar y restaurar conserva rango global y potencias individuales', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01.rank = 3;
    state.inventory.relics.relic_02.rank = 3;
    const result = fuse(state, 'relic_01', 'relic_02', 'persistent-ranks');
    result.inventory.relics.fusion_01.futureField = { preserved: true };
    const completeState = { ...result, config: { journeyMode: 'reduction' }, days: {} };
    const imported = importBackup(
      { config: {}, days: {} },
      exportBackup(completeState),
    );
    const restored = normalizeLootState(JSON.parse(JSON.stringify(imported)));
    expect(restored.inventory.relics.fusion_01).toMatchObject({
      rank: 3,
      inheritedEffects: { relic_01: 10, relic_02: 10 },
      ingredientSnapshots: {
        relic_01: { rank: 3, effectValue: 10 },
        relic_02: { rank: 3, effectValue: 10 },
      },
      futureField: { preserved: true },
    });
  });

  it('migra una fusión anterior igualando ambos componentes al rango máximo', () => {
    const legacy = emptyLootState();
    legacy.inventory.relics.fusion_01 = {
      unlocked: true,
      kind: 'fusion',
      recipeId: 'fusion_recipe_01',
      rarity: 'legendary',
      rank: 1,
      affixes: ['vitality'],
      ingredientSnapshots: {
        relic_01: { rarity: 'legendary', rank: 3, affixes: ['vitality'], effectValue: 10 },
        relic_02: { rarity: 'rare', rank: 1, affixes: [], effectValue: 5 },
      },
      inheritedEffects: { relic_01: 10, relic_02: 5 },
    };
    const migrated = normalizeLootState(legacy).inventory.relics.fusion_01;
    expect(migrated.rank).toBe(3);
    expect(migrated.inheritedEffects).toEqual({ relic_01: 10, relic_02: 10 });
    expect(migrated.ingredientSnapshots).toMatchObject({
      relic_01: { rank: 3, effectValue: 10 },
      relic_02: { rank: 3, effectValue: 10 },
    });
  });


  it('conserva en la colección los ingredientes sacrificados y distingue posesión', () => {
    const result = fuse(fusionState(2), 'relic_01', 'relic_02');
    expect(Object.keys(result.inventory.collection)).toEqual(
      expect.arrayContaining(['relic_01', 'relic_02', 'fusion_01']),
    );
    expect(result.inventory.collection.relic_01.lastOwnedRecord).toBeDefined();
    expect(result.inventory.relics.relic_01).toBeUndefined();
  });
});

describe('Tienda tras una Fusión', () => {
  it('excluye reliquias poseídas y reintroduce ingredientes consumidos en la rotación', () => {
    const initial = fusionState(2);
    expect(shopOffers(ensureShopRotation(initial, 100), 100)).toEqual([]);
    const fused = fuse(initial, 'relic_01', 'relic_02');
    const offers = shopOffers(ensureShopRotation(fused, 100), 100);
    expect(offers.map((offer) => offer.relicId).sort()).toEqual(['relic_01', 'relic_02']);
    expect(offers.every((offer) => offer.source === 'fusion-consumed')).toBe(true);
  });

  it('renueva rango, rareza y efectos, y suma los extras de precio', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 2, affixes: ['vitality'], bossIndex: 0,
    };
    state.inventory.relics.relic_02.rank = 2;
    const fused = fuse(state, 'relic_01', 'relic_02');
    const offer = shopOffers(ensureShopRotation(fused, 100), 100)
      .find((item) => item.relicId === 'relic_01');
    expect(shopPriceForRelic('relic_01', 'fusion-consumed')).toEqual({
      coinPrice: 188,
      bloodPrice: 1,
    });
    expect([1, 2, 3]).toContain(offer.relic.rank);
    expect(offer.relic.rarity).not.toBe('legendary');
    expect(offer.relic.affixes).toHaveLength(RARITIES[offer.relic.rarity].affixCount);
    expect(offer.coinPrice).toBe(
      shopPriceForRelic(
        'relic_01', 'fusion-consumed', offer.relic.rarity, offer.relic.rank,
      ).coinPrice,
    );
    const bought = purchaseShopRelic({
      state: ensureShopRotation(fused, 100), relicId: 'relic_01', operationId: 'buy', nowTimestamp: 100,
    });
    expect(bought.ok).toBe(true);
    expect(bought.inventory.relics.relic_01).toMatchObject({
      rarity: offer.relic.rarity, rank: offer.relic.rank, affixes: offer.relic.affixes,
    });
    expect(shopOffers(bought, 100).some((item) => item.relicId === 'relic_01')).toBe(false);
  });
});

describe('Sinergias de Fusión', () => {
  it('permite poseer varias fusionadas pero solo equipar una a la vez', () => {
    let state = fuse(fusionState(5), 'relic_01', 'relic_02');
    state = fuse(state, 'relic_03', 'relic_05', 'fusion-op-2');
    state = equipRelic(state, 'fusion_01');
    const rejected = equipRelic(state, 'fusion_04');
    expect(rejected.ok).toBe(false);
    expect(rejected).toMatchObject({
      reason: 'fusion-equipped-conflict', conflictingRelicId: 'fusion_01',
    });
    const replaced = equipRelic(state, 'fusion_04', 0);
    expect(replaced.ok).toBe(true);
    expect(replaced.inventory.equipped).toEqual(['fusion_04']);
  });

  it('persiste activaciones diarias y no permite repetirlas al recargar', () => {
    let state = fuse(fusionState(2), 'relic_01', 'relic_02');
    state = equipRelic(state, 'fusion_01');
    expect(canActivateFusionDaily(state, 'fusion_01', 'first-habit-mana', '2026-08-14')).toBe(true);
    state = markFusionDaily(state, 'fusion_01', 'first-habit-mana', '2026-08-14');
    const restored = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(canActivateFusionDaily(restored, 'fusion_01', 'first-habit-mana', '2026-08-14')).toBe(false);
  });

  it('concede la XP extraordinaria de lista completa una vez y no permite farming con undo', () => {
    let state = fuse(fusionState(5), 'relic_03', 'relic_05');
    state = equipRelic(state, 'fusion_04');
    const habits = {
      items: [
        { id: 'a', frequency: 'daily', target: 1, active: true },
        { id: 'b', frequency: 'daily', target: 1, active: true },
      ],
      entries: {
        'a|d:2026-08-14': { frequency: 'daily', periodKey: 'd:2026-08-14', count: 1, xpAwarded: 10 },
        'b|d:2026-08-14': { frequency: 'daily', periodKey: 'd:2026-08-14', count: 1, xpAwarded: 13 },
      },
    };
    const first = awardFusionAllHabitsXp({ state, habitState: habits, dayKey: '2026-08-14' });
    expect(first.xp).toBe(5);
    expect(first.habitState.entries['fusion_04|d:2026-08-14']).toBeUndefined();
    expect(first.forge.fusion.dailyActivations[
      'fusion_04:all-habits:2026-08-14'
    ]).toBe(5);
    const undone = JSON.parse(JSON.stringify(first.habitState));
    undone.entries['b|d:2026-08-14'].count = 0;
    const retry = awardFusionAllHabitsXp({ state: first, habitState: undone, dayKey: '2026-08-14' });
    expect(retry.xp).toBe(0);
  });

  it('no activa el bonus de lista vacía y el descuento nunca hace negativo el coste', () => {
    let state = fuse(fusionState(5), 'relic_03', 'relic_05');
    state = equipRelic(state, 'fusion_04');
    expect(awardFusionAllHabitsXp({
      state, habitState: { items: [], entries: {} }, dayKey: '2026-08-14',
    }).xp).toBe(0);
    const spell = castSpellEffect({
      game: { mp: 4, hp: 10, buffs: {} },
      spell: { id: 'muro', cost: 2, lvl: 1 },
      level: 1,
      currentWeek: 0,
      today: '2026-08-14',
      manaDiscount: 20,
    });
    expect(spell.spentMana).toBe(0);
    expect(spell.game.mp).toBe(4);
  });

  it.each([
    ['fusion_02', 'relic_01', 'relic_04', 20, 40],
  ])('concede una sola recompensa semanal para %s además de Constancia',
    (_fusionId, leftId, rightId, synergyXp, expectedTotal) => {
      let state = fuse(fusionState(6), leftId, rightId);
      state = equipRelic(state, _fusionId);
      state = syncRelicConstancy(state, {
        cycleId: 'week-1:boss-1', outcomes: [], nowTimestamp: 1,
      });
      const first = activateRelicConstancy({
        state,
        cycleId: 'week-1:boss-1',
        outcomes: ['hit', 'hit', 'hit', 'hit', 'hit', 'hit'],
        bossWon: true,
        nowTimestamp: 10,
      });
      expect(first.activated).toBe(true);
      expect(first.xp).toBe(expectedTotal);
      expect(first.forge.fusion.weeklyActivations).toHaveProperty(
        `${_fusionId}:six-days:week-1:boss-1`,
      );
      const repeated = activateRelicConstancy({
        state: first,
        cycleId: 'week-1:boss-1',
        outcomes: ['hit', 'hit', 'hit', 'hit', 'hit', 'hit'],
        bossWon: true,
      });
      expect(repeated.xp).toBe(0);
      expect(synergyXp).toBeGreaterThan(0);
    });

  it('no concede la sinergia semanal si una fusión con Constancia se equipa tarde', () => {
    let state = fuse(fusionState(6), 'relic_01', 'relic_04');
    state = equipRelic(state, 'fusion_02');
    state = syncRelicConstancy(state, {
      cycleId: 'week-1:boss-1',
      outcomes: ['hit', 'hit', 'hit', 'hit', 'hit'],
      nowTimestamp: 1,
    });
    const result = activateRelicConstancy({
      state,
      cycleId: 'week-1:boss-1',
      outcomes: ['hit', 'hit', 'hit', 'hit', 'hit', 'hit'],
      bossWon: true,
      nowTimestamp: 2,
    });
    expect(result.inventory.constancy.charge).toBe(1);
    expect(result.activated).toBe(false);
    expect(result.xp).toBe(0);
  });
});

describe('compatibilidad de partidas antiguas', () => {
  it('añade colección y estado de Fusión sin alterar reliquias existentes', () => {
    const legacy = fusionState(2);
    delete legacy.inventory.collection;
    delete legacy.forge.fusion;
    const normalized = normalizeLootState(JSON.parse(JSON.stringify(legacy)));
    expect(normalized.inventory.relics).toEqual(legacy.inventory.relics);
    expect(Object.keys(normalized.inventory.collection)).toEqual(['relic_01', 'relic_02']);
    expect(normalized.forge.fusion).toEqual({
      discoveredRecipes: [], history: [], attempts: {}, dailyActivations: {}, weeklyActivations: {},
    });
  });
});
