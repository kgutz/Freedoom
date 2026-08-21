import { describe, expect, it } from 'vitest';
import { adjustTodoCompletion, normalizeTodoInput, todoReward } from './todo-rules.js';

describe('reglas de To Do List', () => {
  it('usa las mismas recompensas base que un hábito diario', () => {
    expect(todoReward({ difficulty: 'easy' })).toEqual({ xp: 3, coins: 2 });
    expect(todoReward({ difficulty: 'medium' })).toEqual({ xp: 6, coins: 3 });
    expect(todoReward({ difficulty: 'hard' })).toEqual({ xp: 10, coins: 5 });
  });

  it('guarda y revierte exactamente la recompensa concedida', () => {
    const initial = { items: [{ id: 'task', title: 'Llamar', difficulty: 'hard', active: true }] };
    const completed = adjustTodoCompletion(initial, 'task', true, 100);
    expect(completed.xpDelta).toBe(10);
    expect(completed.coinDelta).toBe(5);
    expect(completed.item).toMatchObject({ completed: true, xpAwarded: 10, coinsAwarded: 5 });

    const reverted = adjustTodoCompletion(completed.todoState, 'task', false, 200);
    expect(reverted.xpDelta).toBe(-10);
    expect(reverted.coinDelta).toBe(-5);
    expect(reverted.item).toMatchObject({ completed: false, xpAwarded: 0, coinsAwarded: 0 });
  });

  it('normaliza el texto y la dificultad', () => {
    expect(normalizeTodoInput({ title: '  Comprar pan  ', notes: '  Hoy  ', difficulty: 'medium' }))
      .toEqual({ title: 'Comprar pan', notes: 'Hoy', difficulty: 'medium' });
  });
});
