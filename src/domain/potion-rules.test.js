import { describe, expect, it } from 'vitest';
import { emptyLootState } from './loot-rules.js';
import { emptyHabitState } from './habit-rules.js';
import {
  consumePreparedBlood,
  potionBloodChance,
  purchasePotion,
  reconcilePotionHabitBonus,
  usePotion,
} from './potion-rules.js';

const DAY = '2026-08-17';
const DATE = new Date(2026, 7, 17, 12);
const easy = { id: 'water', title: 'Agua', difficulty: 'easy', frequency: 'daily', target: 1 };

function richState() {
  const state = emptyLootState();
  state.economy.coins = 100;
  return state;
}

describe('pociones', () => {
  it('compra de forma idempotente y descuenta el precio una sola vez', () => {
    const state = richState();
    const first = purchasePotion({ inventory: state.inventory, economy: state.economy, potionId: 'fortune', operationId: 'one' });
    const repeated = purchasePotion({ inventory: first.inventory, economy: first.economy, potionId: 'fortune', operationId: 'one' });
    expect(repeated.inventory.potions.owned.fortune).toBe(1);
    expect(repeated.economy.coins).toBe(80);
  });

  it('permite comprar varias pociones en una sola operación sin perder idempotencia', () => {
    const state = richState();
    const first = purchasePotion({ inventory: state.inventory, economy: state.economy, potionId: 'life', quantity: 4, operationId: 'bulk' });
    const repeated = purchasePotion({ inventory: first.inventory, economy: first.economy, potionId: 'life', quantity: 4, operationId: 'bulk' });
    expect(repeated.inventory.potions.owned.life).toBe(4);
    expect(repeated.economy.coins).toBe(76);
  });

  it('rechaza la compra múltiple completa si no alcanza el oro', () => {
    const state = richState();
    const result = purchasePotion({ inventory: state.inventory, economy: state.economy, potionId: 'fortune', quantity: 6, operationId: 'too-many' });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('coins');
    expect(result.inventory.potions.owned.fortune).toBe(0);
    expect(result.economy.coins).toBe(100);
  });

  it('limita Fortuna a una vez al día y bloquea otra temporal activa', () => {
    const state = richState();
    state.inventory.potions = { owned: { fortune: 2, experience: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId: 'fortune', dayKey: DAY, nowTimestamp: 1000 });
    expect(used.ok).toBe(true);
    expect(usePotion({ inventory: used.inventory, potionId: 'experience', dayKey: DAY, nowTimestamp: 2000 }).reason).toBe('active');
    expect(usePotion({ inventory: used.inventory, potionId: 'fortune', dayKey: DAY, nowTimestamp: 2_000_000 }).reason).toBe('limit');
  });

  it('limita Vida y Maná a dos usos al día', () => {
    const state = richState();
    state.inventory.potions = { owned: { life: 3, mana: 3 } };
    const life1 = usePotion({ inventory: state.inventory, potionId: 'life', dayKey: DAY });
    const life2 = usePotion({ inventory: life1.inventory, potionId: 'life', dayKey: DAY });
    expect(usePotion({ inventory: life2.inventory, potionId: 'life', dayKey: DAY }).reason).toBe('limit');
  });

  it('Fortuna concede el doble adicional y lo revierte al deshacer', () => {
    const state = richState();
    state.inventory.potions = { owned: { fortune: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId: 'fortune', dayKey: DAY, nowTimestamp: 1000 });
    const habitState = { ...emptyHabitState(), entries: { [`water|d:${DAY}`]: { habitId: 'water', periodKey: `d:${DAY}`, frequency: 'daily', count: 1 } } };
    const reward = reconcilePotionHabitBonus({ inventory: used.inventory, habitState, economy: state.economy, habit: easy, date: DATE, planStartDate: DAY, previousCount: 0, nowTimestamp: 2000 });
    expect(reward.coinDelta).toBe(4);
    const undoneState = { ...reward.habitState, entries: { ...reward.habitState.entries, [`water|d:${DAY}`]: { ...reward.habitState.entries[`water|d:${DAY}`], count: 0 } } };
    const undone = reconcilePotionHabitBonus({ inventory: reward.inventory, habitState: undoneState, economy: reward.economy, habit: easy, date: DATE, planStartDate: DAY, previousCount: 1, nowTimestamp: 9_999_999 });
    expect(undone.coinDelta).toBe(-4);
  });

  it('Experiencia concede 50% redondeado hacia arriba fuera del premio normal', () => {
    const state = richState();
    state.inventory.potions = { owned: { experience: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId: 'experience', dayKey: DAY, nowTimestamp: 1000 });
    const habitState = { ...emptyHabitState(), entries: { [`water|d:${DAY}`]: { habitId: 'water', periodKey: `d:${DAY}`, frequency: 'daily', count: 1 } } };
    const reward = reconcilePotionHabitBonus({ inventory: used.inventory, habitState, economy: state.economy, habit: easy, date: DATE, planStartDate: DAY, previousCount: 0, nowTimestamp: 2000 });
    expect(reward.xpDelta).toBe(2);
    expect(reward.habitState.entries[`water|d:${DAY}`].potionXpAwarded).toBe(2);
  });

  it('Sangre acumula 20, 10 y 5 por jefe y se consume al resolverlo', () => {
    const state = richState();
    state.inventory.potions = { owned: { blood: 4 } };
    const one = usePotion({ inventory: state.inventory, potionId: 'blood', dayKey: DAY, bossKey: 'boss-1' });
    const two = usePotion({ inventory: one.inventory, potionId: 'blood', dayKey: DAY, bossKey: 'boss-1' });
    const three = usePotion({ inventory: two.inventory, potionId: 'blood', dayKey: DAY, bossKey: 'boss-1' });
    expect(potionBloodChance(three.inventory.potions, 'boss-1')).toBe(35);
    expect(usePotion({ inventory: three.inventory, potionId: 'blood', dayKey: DAY, bossKey: 'boss-1' }).reason).toBe('limit');
    expect(potionBloodChance(consumePreparedBlood(three.inventory, ['boss-1']).potions, 'boss-1')).toBe(0);
  });
});
