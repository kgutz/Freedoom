import { describe, expect, it, vi } from 'vitest';
import { scheduleStartupPreload } from './startup-render-scheduler.js';

describe('precarga escalonada del arranque', () => {
  it('prepara primero las vistas frecuentes y después las pesadas', () => {
    const pending = [];
    const window = {
      requestIdleCallback(callback, options) {
        pending.push({ callback, timeout: options.timeout });
        return pending.length;
      },
      cancelIdleCallback: vi.fn(),
    };
    const order = [];

    scheduleStartupPreload({
      window,
      renderSecondary: () => order.push('secondary'),
      afterSecondary: () => order.push('checkpoint'),
      renderHeavy: () => order.push('heavy'),
    });

    expect(pending.map((task) => task.timeout)).toEqual([250]);
    pending.shift().callback();
    expect(order).toEqual(['secondary', 'checkpoint']);
    expect(pending.map((task) => task.timeout)).toEqual([1_000]);
    pending.shift().callback();
    expect(order).toEqual(['secondary', 'checkpoint', 'heavy']);
  });

  it('usa temporizadores compatibles y permite cancelar la precarga', () => {
    const callbacks = new Map();
    let nextId = 0;
    const window = {
      setTimeout(callback) {
        nextId += 1;
        callbacks.set(nextId, callback);
        return nextId;
      },
      clearTimeout: vi.fn((id) => callbacks.delete(id)),
    };
    const renderSecondary = vi.fn();
    const cancel = scheduleStartupPreload({
      window,
      renderSecondary,
      renderHeavy: vi.fn(),
    });

    cancel();
    callbacks.forEach((callback) => callback());
    expect(renderSecondary).not.toHaveBeenCalled();
    expect(window.clearTimeout).toHaveBeenCalled();
  });
});
