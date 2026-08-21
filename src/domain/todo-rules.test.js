import { describe, expect, it } from 'vitest';
import {
  adjustTodoCompletion,
  adjustTodoProgress,
  nextTodoOrder,
  normalizeTodoInput,
  reorderTodos,
  sortTodos,
  todoReward,
} from './todo-rules.js';

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
    expect(normalizeTodoInput({ title: '  Comprar pan  ', notes: '  Hoy  ', difficulty: 'medium', target: 3 }))
      .toEqual({ title: 'Comprar pan', notes: 'Hoy', difficulty: 'medium', target: 3 });
  });

  it('concede y revierte la recompensa en cada fase, como un hábito repetible', () => {
    const initial = { items: [{ id: 'task', difficulty: 'medium', target: 3, count: 0, active: true }] };
    const first = adjustTodoProgress(initial, 'task', 1, 10);
    expect(first).toMatchObject({ changed: true, xpDelta: 6, coinDelta: 3 });
    expect(first.item).toMatchObject({ count: 1, completed: false, xpAwarded: 6, coinsAwarded: 3 });
    const completed = adjustTodoProgress(first.todoState, 'task', 2, 20);
    expect(completed).toMatchObject({ xpDelta: 12, coinDelta: 6 });
    expect(completed.item).toMatchObject({ count: 3, completed: true, xpAwarded: 18, coinsAwarded: 9 });
    const reverted = adjustTodoProgress(completed.todoState, 'task', -1, 30);
    expect(reverted).toMatchObject({ xpDelta: -6, coinDelta: -3 });
    expect(reverted.item).toMatchObject({ count: 2, completed: false, xpAwarded: 12, coinsAwarded: 6 });
  });

  it('revierte el valor histórico de la fase aunque después cambie la dificultad', () => {
    const initial = { items: [{ id: 'task', difficulty: 'easy', target: 2, count: 0, active: true }] };
    const first = adjustTodoProgress(initial, 'task', 1, 10);
    const edited = {
      ...first.todoState,
      items: first.todoState.items.map((todo) => ({ ...todo, difficulty: 'hard' })),
    };
    const reverted = adjustTodoProgress(edited, 'task', -1, 20);
    expect(reverted).toMatchObject({ xpDelta: -3, coinDelta: -2 });
    expect(reverted.item).toMatchObject({ count: 0, xpAwarded: 0, coinsAwarded: 0, progressAwards: [] });
  });

  it('guarda el orden manual de las tareas', () => {
    const initial = { items: [
      { id: 'a', title: 'Primera', active: true, createdAt: 1 },
      { id: 'b', title: 'Segunda', active: true, createdAt: 2 },
      { id: 'c', title: 'Tercera', active: true, createdAt: 3 },
    ] };
    const reordered = reorderTodos(initial, ['c', 'a', 'b']);
    expect(sortTodos(reordered.items).map((todo) => todo.id)).toEqual(['c', 'a', 'b']);
    expect(nextTodoOrder(reordered)).toBe(3);
  });
});
