import { describe, expect, it, vi } from 'vitest';
import { commitLootOperation } from './persisted-loot-operation.js';
import { emptyLootState, fuseRelics, grantBossRewards } from '../domain/loot-rules.js';

describe('persistencia atómica de operaciones de loot', () => {
  it('conserva la mutación solo cuando el guardado se confirma', async () => {
    let state = { coins: 100 };
    const applyState = vi.fn((next) => { state = next; });
    const result = await commitLootOperation({
      previousState: state,
      nextState: { coins: 50 },
      applyState,
      persist: vi.fn().mockResolvedValue({ verified: true }),
    });
    expect(result.ok).toBe(true);
    expect(state).toEqual({ coins: 50 });
    expect(applyState).toHaveBeenCalledOnce();
  });

  it.each([
    ['excepción', () => Promise.reject(new Error('sin espacio'))],
    ['guardado bloqueado', () => Promise.resolve({ blocked: true })],
  ])('revierte toda la mutación ante %s', async (_case, persist) => {
    const previousState = { coins: 100, blood: 2, rank: 1, pity: 0, history: [] };
    const nextState = { coins: 50, blood: 1, rank: 2, pity: 0, history: ['attempt'] };
    let state = previousState;
    const result = await commitLootOperation({
      previousState,
      nextState,
      applyState: (next) => { state = next; },
      persist,
    });
    expect(result.ok).toBe(false);
    expect(state).toEqual(previousState);
  });

  it('restaura ingredientes y recursos si no puede persistir una Fusión', async () => {
    const previousState = grantBossRewards({
      state: emptyLootState(), bossesDown: 2, source: 'retroactive', seed: 'rollback', nowTimestamp: 1,
    });
    previousState.economy.coins = 200;
    previousState.economy.bossBlood = 2;
    const nextState = fuseRelics({
      state: previousState,
      leftId: 'relic_01',
      rightId: 'relic_02',
      operationId: 'rollback-fusion',
      nowTimestamp: 2,
    });
    let applied = previousState;
    const result = await commitLootOperation({
      previousState,
      nextState,
      applyState: (next) => { applied = next; },
      persist: () => Promise.reject(new Error('sin espacio')),
    });
    expect(result.ok).toBe(false);
    expect(applied.inventory.relics.relic_01).toBeDefined();
    expect(applied.inventory.relics.relic_02).toBeDefined();
    expect(applied.inventory.relics.fusion_01).toBeUndefined();
    expect(applied.economy).toMatchObject({ coins: 200, bossBlood: 2 });
  });
});
