import { describe, expect, it } from 'vitest';
import { emptyLootState } from './loot-rules.js';
import { adjustHabitProgress, emptyHabitState } from './habit-rules.js';
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

  it('limita el Bolso a cuatro tipos de poción y permite apilar un tipo existente', () => {
    const state = richState();
    state.economy.coins = 500;
    state.inventory.potions = { owned: { fortune: 1, experience: 1, life: 1, mana: 1 } };
    const blocked = purchasePotion({
      inventory: state.inventory, economy: state.economy,
      potionId: 'blood', operationId: 'fifth-type',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('bag_full');
    expect(blocked.economy.coins).toBe(500);

    const stacked = purchasePotion({
      inventory: state.inventory, economy: state.economy,
      potionId: 'life', quantity: 2, operationId: 'stack-existing',
    });
    expect(stacked.ok).toBe(true);
    expect(stacked.inventory.potions.owned.life).toBe(3);
  });

  it('libera el hueco al gastar la última poción de un tipo', () => {
    const state = richState();
    state.economy.coins = 500;
    state.inventory.potions = { owned: { fortune: 1, experience: 1, life: 1, mana: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId: 'life', dayKey: DAY });
    expect(used.inventory.potions.owned.life).toBe(0);
    const purchased = purchasePotion({
      inventory: used.inventory, economy: state.economy,
      potionId: 'blood', operationId: 'freed-slot',
    });
    expect(purchased.ok).toBe(true);
    expect(purchased.inventory.potions.owned.blood).toBe(1);
  });

  it('limita Fortuna a una vez al día y bloquea otra temporal activa', () => {
    const state = richState();
    state.inventory.potions = { owned: { fortune: 2, experience: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId: 'fortune', dayKey: DAY, nowTimestamp: 1000 });
    expect(used.ok).toBe(true);
    expect(usePotion({ inventory: used.inventory, potionId: 'experience', dayKey: DAY, nowTimestamp: 2000 }).reason).toBe('active');
    expect(usePotion({ inventory: used.inventory, potionId: 'fortune', dayKey: DAY, nowTimestamp: 2_000_000 }).reason).toBe('limit');
  });

  it('permite usar Vida y Maná sin límite diario mientras queden unidades', () => {
    const state = richState();
    state.inventory.potions = { owned: { life: 3, mana: 3 } };
    const life1 = usePotion({ inventory: state.inventory, potionId: 'life', dayKey: DAY });
    const life2 = usePotion({ inventory: life1.inventory, potionId: 'life', dayKey: DAY });
    const life3 = usePotion({ inventory: life2.inventory, potionId: 'life', dayKey: DAY });
    const mana1 = usePotion({ inventory: life3.inventory, potionId: 'mana', dayKey: DAY });
    const mana2 = usePotion({ inventory: mana1.inventory, potionId: 'mana', dayKey: DAY });
    const mana3 = usePotion({ inventory: mana2.inventory, potionId: 'mana', dayKey: DAY });
    expect(life3.ok).toBe(true);
    expect(mana3.ok).toBe(true);
    expect(mana3.inventory.potions.owned).toMatchObject({ life: 0, mana: 0 });
    expect(mana3.inventory.potions.dailyUses[DAY]).toBeUndefined();
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

  it.each([
    ['fortune', 'coinDelta', 4],
    ['experience', 'xpDelta', 2],
  ])('revierte exactamente el bono de %s al quitar y volver a poner el hábito', (potionId, deltaField, bonus) => {
    const state = richState();
    state.inventory.potions = { owned: { [potionId]: 1 } };
    const used = usePotion({ inventory: state.inventory, potionId, dayKey: DAY, nowTimestamp: 1000 });

    const added = adjustHabitProgress({
      habitState: emptyHabitState(), habit: easy, delta: 1, date: DATE, planStartDate: DAY,
    });
    const rewarded = reconcilePotionHabitBonus({
      inventory: used.inventory, habitState: added.habitState, economy: state.economy,
      habit: easy, date: DATE, planStartDate: DAY, previousCount: 0, nowTimestamp: 2000,
    });
    expect(rewarded[deltaField]).toBe(bonus);

    const removed = adjustHabitProgress({
      habitState: rewarded.habitState, habit: easy, delta: -1, date: DATE, planStartDate: DAY,
    });
    const reversed = reconcilePotionHabitBonus({
      inventory: rewarded.inventory, habitState: removed.habitState, economy: rewarded.economy,
      habit: easy, date: DATE, planStartDate: DAY, previousCount: 1, nowTimestamp: 2500,
    });
    expect(reversed[deltaField]).toBe(-bonus);

    const restored = adjustHabitProgress({
      habitState: reversed.habitState, habit: easy, delta: 1, date: DATE, planStartDate: DAY,
    });
    const rewardedAgain = reconcilePotionHabitBonus({
      inventory: reversed.inventory, habitState: restored.habitState, economy: reversed.economy,
      habit: easy, date: DATE, planStartDate: DAY, previousCount: 0, nowTimestamp: 3000,
    });
    expect(rewardedAgain[deltaField]).toBe(bonus);
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
