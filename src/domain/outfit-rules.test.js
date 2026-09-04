import { describe, expect, it } from 'vitest';
import { emptyLootState } from './loot-rules.js';
import {
  acknowledgeFiberCatchupNotice,
  bossFiberBase,
  bossInkBase,
  grantBossFiberReward,
  pendingFiberCatchupNotice,
  paintFrame,
  reconcileHistoricalBossFibers,
  weaveOutfit,
} from './outfit-rules.js';

function stateWithGame() {
  return { ...emptyLootState(), game: { cls: 'paladin', outfit: 'original' } };
}

describe('Fibras Arcanas y tejido de outfits', () => {
  it('escala la recompensa base de los jefes por bloques de cuatro', () => {
    expect([0, 3, 4, 7, 8, 11, 12, 30].map(bossFiberBase)).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
    expect([0, 3, 4, 7, 8, 11, 12, 30].map(bossInkBase)).toEqual([2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('entrega la Fibra del jefe una sola vez por ciclo', () => {
    const first = grantBossFiberReward({ state: stateWithGame(), cycleId: 'week-2:boss-2', bossIndex: 2, randomValue: 0.1 });
    expect(first.granted).toBe(4);
    expect(first.inkGranted).toBe(2);
    expect(first.economy.arcaneFibers).toBe(4);
    expect(first.economy.arcaneInks).toBe(2);
    const duplicate = grantBossFiberReward({ state: { ...stateWithGame(), ...first }, cycleId: 'week-2:boss-2', bossIndex: 2, randomValue: 0.9 });
    expect(duplicate.granted).toBe(0);
    expect(duplicate.inkGranted).toBe(0);
    expect(duplicate.economy.arcaneFibers).toBe(4);
    expect(duplicate.economy.arcaneInks).toBe(2);
    const sameBossDifferentCycle = grantBossFiberReward({
      state: { ...stateWithGame(), ...first },
      cycleId: 'retroactive:boss-2',
      bossIndex: 2,
      randomValue: 0,
    });
    expect(sameBossDifferentCycle.granted).toBe(0);
    expect(sameBossDifferentCycle.economy.arcaneFibers).toBe(4);
  });

  it('concilia las Fibras de jefes históricos sin depender del saldo actual', () => {
    const initial = stateWithGame();
    const first = reconcileHistoricalBossFibers({
      state: initial,
      bossesDown: 3,
      randomValues: [0.9, 0.9, 0.9],
      nowTimestamp: 100,
    });
    expect(first.granted).toBe(9);
    expect(first.inkGranted).toBe(6);
    expect(first.bossCount).toBe(3);
    expect(first.economy.arcaneFibers).toBe(9);
    expect(first.economy.arcaneInks).toBe(6);
    expect(pendingFiberCatchupNotice(first)).toMatchObject({
      arcaneFibers: 9,
      arcaneInks: 6,
      bossCount: 3,
      acknowledged: false,
    });

    first.economy.arcaneFibers = 0;
    const repeated = reconcileHistoricalBossFibers({
      state: first,
      bossesDown: 3,
      randomValues: [0, 0, 0],
      nowTimestamp: 200,
    });
    expect(repeated.granted).toBe(0);
    expect(repeated.inkGranted).toBe(0);
    expect(repeated.economy.arcaneFibers).toBe(0);
    expect(repeated.economy.arcaneInks).toBe(6);
  });

  it('entrega retroactivamente la Tinta de los jefes que ya habían dado Fibra', () => {
    const initial = stateWithGame();
    initial.loot.bossFiberOutcomes['week-0:boss-0'] = {
      cycleId: 'week-0:boss-0', bossIndex: 0, base: 3, bonus: 0, granted: 3, notifiedAt: 10,
    };
    const result = reconcileHistoricalBossFibers({ state: initial, bossesDown: 1, nowTimestamp: 20 });
    expect(result).toMatchObject({ granted: 0, inkGranted: 2, bossCount: 1 });
    expect(result.economy.arcaneFibers).toBe(0);
    expect(result.economy.arcaneInks).toBe(2);
    expect(result.loot.bossFiberOutcomes['week-0:boss-0'].arcaneInks).toBe(2);
    expect(pendingFiberCatchupNotice(result)).toMatchObject({ arcaneFibers: 0, arcaneInks: 2 });
  });

  it('solo entrega las Fibras pendientes y permite cerrar su aviso', () => {
    const initial = stateWithGame();
    const previous = grantBossFiberReward({
      state: initial,
      cycleId: 'week-0:boss-0',
      bossIndex: 0,
      randomValue: 0.9,
      nowTimestamp: 10,
    });
    previous.economy.arcaneFibers = 0;
    const catchup = reconcileHistoricalBossFibers({
      state: previous,
      bossesDown: 2,
      randomValues: [0, 0.9],
      nowTimestamp: 20,
    });
    expect(catchup.granted).toBe(3);
    expect(catchup.bossCount).toBe(1);
    const notice = pendingFiberCatchupNotice(catchup);
    const acknowledged = acknowledgeFiberCatchupNotice(catchup, notice.id);
    expect(pendingFiberCatchupNotice(acknowledged)).toBeNull();
  });

  it('teje una vez, descuenta el coste y conserva la propiedad', () => {
    const initial = stateWithGame();
    initial.economy.coins = 380;
    initial.economy.arcaneFibers = 22;
    const result = weaveOutfit({ state: initial, outfitId: 'arcane-weave-01', operationId: 'weave-1', nowTimestamp: 20 });
    expect(result.ok).toBe(true);
    expect(result.economy.coins).toBe(60);
    expect(result.economy.arcaneFibers).toBe(2);
    expect(result.game.outfits.owned['arcane-weave-01'].source).toBe('woven');
    const repeated = weaveOutfit({ state: { ...initial, ...result }, outfitId: 'arcane-weave-01', operationId: 'weave-2' });
    expect(repeated.ok).toBe(false);
    expect(repeated.reason).toBe('owned');
  });

  it('mantiene el mismo coste para Forjador del Crisol que para Operador del Nexo', () => {
    const initial = stateWithGame();
    initial.economy.coins = 320;
    initial.economy.arcaneFibers = 20;
    const result = weaveOutfit({ state: initial, outfitId: 'arcane-weave-02', operationId: 'weave-2', nowTimestamp: 30 });
    expect(result.ok).toBe(true);
    expect(result.economy.coins).toBe(0);
    expect(result.economy.arcaneFibers).toBe(0);
    expect(result.game.outfits.owned['arcane-weave-02'].source).toBe('woven');
  });

  it('pinta Santuario del Crisol por 20 Tintas y 320 de oro', () => {
    const initial = stateWithGame();
    initial.economy.coins = 320;
    initial.economy.arcaneInks = 20;
    const result = paintFrame({ state: initial, frameId: 'welder-beta', operationId: 'paint-1', nowTimestamp: 40 });
    expect(result.ok).toBe(true);
    expect(result.economy).toMatchObject({ coins: 0, arcaneInks: 0 });
    expect(result.game.frames.owned['welder-beta']).toMatchObject({ source: 'painted' });
    const repeated = paintFrame({ state: { ...initial, ...result }, frameId: 'welder-beta', operationId: 'paint-2' });
    expect(repeated).toMatchObject({ ok: false, reason: 'owned' });
  });

  it('permite comprar el conjunto y el fondo celestiales publicados', () => {
    const outfitState = stateWithGame();
    outfitState.economy = { ...outfitState.economy, coins: 320, arcaneFibers: 20 };
    const outfit = weaveOutfit({ state: outfitState, outfitId: 'celestial-rhythm-master', operationId: 'celestial-outfit' });
    expect(outfit).toMatchObject({ ok: true, economy: { coins: 0, arcaneFibers: 0 } });
    expect(outfit.game.outfits.owned['celestial-rhythm-master']).toMatchObject({ source: 'woven' });

    const frameState = stateWithGame();
    frameState.economy = { ...frameState.economy, coins: 350, arcaneInks: 35 };
    const frame = paintFrame({ state: frameState, frameId: 'celestial-music-studio', operationId: 'celestial-frame' });
    expect(frame).toMatchObject({ ok: true, economy: { coins: 0, arcaneInks: 0 } });
    expect(frame.game.frames.owned['celestial-music-studio']).toMatchObject({ source: 'painted' });
  });
});
