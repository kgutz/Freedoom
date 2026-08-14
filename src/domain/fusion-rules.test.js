import { describe, expect, it } from 'vitest';
import { castSpellEffect } from './spell-rules.js';
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
  return fuseRelics({ state, leftId, rightId, operationId, nowTimestamp: 10 });
}

describe('Fusión de reliquias', () => {
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
    expect(fusionRecipeStatus('relic_03', 'relic_06').status).toBe('incompatible');
    expect(fusionRecipeStatus('relic_01', 'relic_03').status).toBe('not-designed');
    expect(fusionRecipeStatus('relic_01', 'relic_01').status).toBe('same-relic');
  });

  it('consume ingredientes, entrega el resultado y conserva valores históricos sin reroll', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 2, affixes: ['vitality'], bossIndex: 0,
    };
    state.inventory.relics.relic_02 = {
      unlocked: true, rarity: 'mythic', rank: 3, affixes: ['arcane', 'vitality'], bossIndex: 1,
    };
    const result = fuse(state, 'relic_01', 'relic_02');
    expect(result.inventory.relics.relic_01).toBeUndefined();
    expect(result.inventory.relics.relic_02).toBeUndefined();
    expect(result.inventory.relics.fusion_01).toMatchObject({
      kind: 'fusion',
      rarity: 'mythic',
      inheritedEffects: { relic_01: 7, relic_02: 10 },
      affixes: ['vitality', 'arcane'],
    });
    expect(result.economy).toMatchObject({ coins: 900, bossBlood: 19 });
    expect(result.forge.fusion.history.at(-1).ingredients.relic_01.rank).toBe(2);
    const restored = normalizeLootState(JSON.parse(JSON.stringify(result)));
    expect(restored.inventory.relics.fusion_01.inheritedEffects).toEqual({
      relic_01: 7, relic_02: 10,
    });
    const equipped = equipRelic(restored, 'fusion_01');
    expect(equippedRelicEffectSources(equipped, 'relic_01')[0].value).toBe(7);
    expect(equippedRelicEffectSources(equipped, 'relic_02')[0].value).toBe(10);
    expect(equippedRelicBonuses(equipped)).toMatchObject({ maxHp: 5, maxMana: 5 });
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
    const missing = fuseRelics({
      state: fusionState(1), leftId: 'relic_01', rightId: 'relic_02', operationId: 'missing',
    });
    expect(missing.reason).toBe('missing-ingredients');
    expect(missing.economy.coins).toBe(1000);
    expect(missing.inventory.relics.relic_01).toBeDefined();
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

  it('aplica +25% solo al oro y recompra exactamente la misma rareza y efectos', () => {
    const state = fusionState(2);
    state.inventory.relics.relic_01 = {
      unlocked: true, rarity: 'legendary', rank: 2, affixes: ['vitality'], bossIndex: 0,
    };
    const fused = fuse(state, 'relic_01', 'relic_02');
    const offer = shopOffers(ensureShopRotation(fused, 100), 100)
      .find((item) => item.relicId === 'relic_01');
    expect(shopPriceForRelic('relic_01', 'fusion-consumed')).toEqual({
      coinPrice: 188,
      bloodPrice: 1,
    });
    expect(offer.relic).toMatchObject({ rarity: 'legendary', rank: 2, affixes: ['vitality'] });
    const bought = purchaseShopRelic({
      state: ensureShopRotation(fused, 100), relicId: 'relic_01', operationId: 'buy', nowTimestamp: 100,
    });
    expect(bought.ok).toBe(true);
    expect(bought.inventory.relics.relic_01).toMatchObject({
      rarity: 'legendary', rank: 2, affixes: ['vitality'],
    });
    expect(shopOffers(bought, 100).some((item) => item.relicId === 'relic_01')).toBe(false);
  });
});

describe('Sinergias de Fusión', () => {
  it('impide equipar dos reliquias del mismo tipo y permite sustituir la del mismo slot', () => {
    let state = fuse(fusionState(6), 'relic_04', 'relic_06');
    state.inventory.relics.relic_04 = {
      unlocked: true, kind: 'base', rarity: 'rare', rank: 1, affixes: [],
    };
    state = equipRelic(state, 'relic_04');
    state = equipRelic(state, 'relic_01');
    const rejected = equipRelic(state, 'fusion_05', 1);
    expect(rejected.ok).toBe(false);
    expect(rejected).toMatchObject({
      reason: 'equipment-type-conflict', equipmentType: 'helmet', conflictingRelicId: 'relic_04',
    });
    const replaced = equipRelic(state, 'fusion_05', 0);
    expect(replaced.ok).toBe(true);
    expect(replaced.inventory.equipped).toEqual(['fusion_05', 'relic_01']);
  });

  it('persiste activaciones diarias y no permite repetirlas al recargar', () => {
    let state = fuse(fusionState(2), 'relic_01', 'relic_02');
    state = equipRelic(state, 'fusion_01');
    expect(canActivateFusionDaily(state, 'fusion_01', 'first-habit-mana', '2026-08-14')).toBe(true);
    state = markFusionDaily(state, 'fusion_01', 'first-habit-mana', '2026-08-14');
    const restored = normalizeLootState(JSON.parse(JSON.stringify(state)));
    expect(canActivateFusionDaily(restored, 'fusion_01', 'first-habit-mana', '2026-08-14')).toBe(false);
  });

  it('concede la XP de todos los hábitos una vez, respeta el cap y no permite farming con undo', () => {
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
    expect(first.xp).toBe(2);
    expect(first.habitState.entries['fusion_04|d:2026-08-14'].xpAwarded).toBe(2);
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
    ['fusion_02', 'relic_01', 'relic_04', 20, 35],
    ['fusion_05', 'relic_04', 'relic_06', 25, 40],
  ])('concede una sola recompensa semanal para %s además de Constancia',
    (_fusionId, leftId, rightId, synergyXp, expectedTotal) => {
      let state = fuse(fusionState(6), leftId, rightId);
      state = equipRelic(state, _fusionId);
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
      discoveredRecipes: [], history: [], dailyActivations: {}, weeklyActivations: {},
    });
  });
});
