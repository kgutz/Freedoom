import { describe, expect, it, vi } from 'vitest';
import {
  createImagePreloader,
  scheduleImagePreloadPhases,
  startupImagePhases,
} from './startup-image-preloader.js';

describe('precarga de imágenes por fases', () => {
  it('prioriza el héroe actual y retrasa cacería y modales', () => {
    const phases = startupImagePhases({ cls: 'paladin', outfit: 'original', frame: 'original' });
    expect(phases.map((phase) => phase.id)).toEqual([
      'current-hero', 'hero-details', 'hunt', 'customization', 'inventory', 'bosses',
    ]);
    expect(phases[0].assets).toContain('sprites/paladin_happy.webp');
    expect(phases[0].assets).toContain('hero_background/paladin_today_bg.webp');
    expect(phases.find((phase) => phase.id === 'hunt').delay).toBe(3_500);
    expect(phases.find((phase) => phase.id === 'inventory').assets).toContain('shop/callejon-oficios.webp');
    expect(phases.at(-1).delay).toBeLessThanOrEqual(15_000);
  });

  it('limita descargas simultáneas y no repite recursos', async () => {
    const images = [];
    class FakeImage {
      constructor() { images.push(this); }
      set src(value) { this.value = value; }
      decode() { return Promise.resolve(); }
    }
    const preloader = createImagePreloader({ window: { Image: FakeImage }, concurrency: 2 });
    preloader.enqueue(['a.webp', 'b.webp', 'a.webp', 'c.webp']);
    expect(images.map((image) => image.value)).toEqual(['a.webp', 'b.webp']);
    images[0].onload();
    await Promise.resolve();
    await Promise.resolve();
    expect(images.map((image) => image.value)).toEqual(['a.webp', 'b.webp', 'c.webp']);
    expect(preloader.snapshot().queued).toBe(3);
  });

  it('programa cada grupo en su instante y permite cancelar', () => {
    const callbacks = new Map();
    let id = 0;
    const window = {
      setTimeout(callback, delay) { callbacks.set(++id, { callback, delay }); return id; },
      clearTimeout: vi.fn((key) => callbacks.delete(key)),
      requestIdleCallback(callback) { callback(); },
    };
    const preloader = { enqueue: vi.fn(), cancel: vi.fn() };
    const phases = [
      { id: 'first', delay: 0, assets: ['a.webp'] },
      { id: 'second', delay: 2_000, assets: ['b.webp'] },
    ];
    const cancel = scheduleImagePreloadPhases({ window, phases, preloader });
    expect([...callbacks.values()].map((entry) => entry.delay)).toEqual([0, 2_000]);
    callbacks.get(1).callback();
    expect(preloader.enqueue).toHaveBeenCalledWith(['a.webp']);
    cancel();
    expect(preloader.cancel).toHaveBeenCalled();
  });
});
