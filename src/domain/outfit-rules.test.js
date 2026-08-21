import { describe, expect, it } from 'vitest';
import { emptyLootState } from './loot-rules.js';
import {
  acknowledgeFiberCatchupNotice,
  bossFiberBase,
  grantBossFiberReward,
  pendingFiberCatchupNotice,
  reconcileHistoricalBossFibers,
  resolveHabitFiberDrop,
  weaveOutfit,
} from './outfit-rules.js';

function stateWithGame() {
  return { ...emptyLootState(), game: { cls: 'paladin', outfit: 'original' } };
}

describe('Fibras Arcanas y tejido de outfits', () => {
  it('escala la recompensa base de los jefes por bloques de cuatro', () => {
    expect([0, 3, 4, 7, 8, 11, 12, 30].map(bossFiberBase)).toEqual([3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('guarda también los fallos de hábito para impedir rerolls', () => {
    const initial = stateWithGame();
    const failed = resolveHabitFiberDrop({
      state: initial,
      habit: { id: 'water', difficulty: 'hard' },
      periodKey: 'd:2026-08-21',
      becameCompleted: true,
      randomValue: 0.9,
      nowTimestamp: 10,
    });
    expect(failed.granted).toBe(0);
    expect(failed.loot.habitFiberOutcomes['water|d:2026-08-21'].granted).toBe(0);
    const retry = resolveHabitFiberDrop({
      state: { ...initial, ...failed },
      habit: { id: 'water', difficulty: 'hard' },
      periodKey: 'd:2026-08-21',
      becameCompleted: true,
      randomValue: 0,
    });
    expect(retry.granted).toBe(0);
    expect(retry.economy.arcaneFibers).toBe(0);
  });

  it('entrega la Fibra del jefe una sola vez por ciclo', () => {
    const first = grantBossFiberReward({ state: stateWithGame(), cycleId: 'week-2:boss-2', bossIndex: 2, randomValue: 0.1 });
    expect(first.granted).toBe(4);
    expect(first.economy.arcaneFibers).toBe(4);
    const duplicate = grantBossFiberReward({ state: { ...stateWithGame(), ...first }, cycleId: 'week-2:boss-2', bossIndex: 2, randomValue: 0.9 });
    expect(duplicate.granted).toBe(0);
    expect(duplicate.economy.arcaneFibers).toBe(4);
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
    expect(first.bossCount).toBe(3);
    expect(first.economy.arcaneFibers).toBe(9);
    expect(pendingFiberCatchupNotice(first)).toMatchObject({
      arcaneFibers: 9,
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
    expect(repeated.economy.arcaneFibers).toBe(0);
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
    initial.economy.coins = 140;
    initial.economy.arcaneFibers = 7;
    const result = weaveOutfit({ state: initial, outfitId: 'arcane-weave-01', operationId: 'weave-1', nowTimestamp: 20 });
    expect(result.ok).toBe(true);
    expect(result.economy.coins).toBe(60);
    expect(result.economy.arcaneFibers).toBe(2);
    expect(result.game.outfits.owned['arcane-weave-01'].source).toBe('woven');
    const repeated = weaveOutfit({ state: { ...initial, ...result }, outfitId: 'arcane-weave-01', operationId: 'weave-2' });
    expect(repeated.ok).toBe(false);
    expect(repeated.reason).toBe('owned');
  });
});
