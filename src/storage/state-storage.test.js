import { describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEY,
  createBrowserStore,
  exportBackup,
  importBackup,
  mergeState,
  parseState,
} from './state-storage.js';

const defaultState = () => ({
  config: {
    startDate: '2026-07-17',
    startLimit: 20,
    wakeTime: '09:00',
    sleepTime: '23:00',
    pillsGoal: 3,
    takesPills: true,
    tracksBeer: true,
  },
  days: {},
  seeded: false,
  seededV: 0,
  game: { cls: null },
  onboarded: false,
});

const v34State = {
  config: {
    startDate: '2026-07-20',
    startLimit: 18,
    wakeTime: '07:00',
    sleepTime: '23:30',
    pillsGoal: 2,
    takesPills: true,
    tracksBeer: false,
  },
  days: {
    '2026-07-20': { c: 12, p: 2, t: '21:14', b: 1, s: 3, sx: 8 },
  },
  seeded: true,
  seededV: 3,
  game: {
    cls: 'paladin',
    name: 'Kike',
    hp: 96,
    mp: 42,
    bonusXp: 25,
    pardons: [],
    judgmentDays: [],
  },
  onboarded: true,
};

describe('compatibilidad del estado', () => {
  it('carga una partida v34 conservando datos y nuevos valores por defecto', () => {
    const loaded = mergeState(defaultState(), v34State);

    expect(loaded).toEqual(v34State);
    expect(loaded.config.wakeTime).toBe('07:00');
    expect(loaded.days['2026-07-20'].sx).toBe(8);
    expect(loaded.game.cls).toBe('paladin');
  });

  it('conserva valores por defecto cuando faltan campos antiguos', () => {
    const loaded = mergeState(defaultState(), {
      config: { startLimit: 15 },
      days: {},
    });

    expect(loaded.config.startLimit).toBe(15);
    expect(loaded.config.wakeTime).toBe('09:00');
    expect(loaded.game).toEqual({ cls: null });
  });
});

describe('copias de seguridad', () => {
  it('hace un recorrido exportar/importar sin perder información', () => {
    const backup = exportBackup(v34State);
    const restored = importBackup(defaultState(), backup);

    expect(restored).toEqual(v34State);
  });

  it('rechaza texto y objetos que no son copias de Freedoom', () => {
    expect(() => importBackup(defaultState(), 'no es json')).toThrow();
    expect(() => importBackup(defaultState(), '{"foo":"bar"}')).toThrow(
      'Formato de copia no válido',
    );
  });

  it('analiza correctamente el código exportado', () => {
    expect(parseState(exportBackup(v34State))).toEqual(v34State);
  });
});

describe('adaptador del navegador', () => {
  it('usa localStorage inmediatamente en la aplicación web', async () => {
    const values = new Map();
    const localStorage = {
      getItem: vi.fn((key) => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
    };
    const store = createBrowserStore({ localStorage });

    store.set(STORAGE_KEY, '{"ok":true}');

    expect(store.usesExternalStorage).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      '{"ok":true}',
    );
    await expect(store.get(STORAGE_KEY)).resolves.toEqual({
      key: STORAGE_KEY,
      value: '{"ok":true}',
    });
  });

  it('mantiene compatibilidad con window.storage', async () => {
    const storage = {
      get: vi.fn(async (key) => ({ key, value: '{}' })),
      set: vi.fn(async (key, value) => ({ key, value })),
    };
    const store = createBrowserStore({ storage, localStorage: null });

    await store.set(STORAGE_KEY, '{}');

    expect(store.usesExternalStorage).toBe(true);
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEY, '{}');
  });
});
