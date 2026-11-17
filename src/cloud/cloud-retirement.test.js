import { describe, expect, it } from 'vitest';
import { readCloudConfig } from './cloud-config.js';
import {
  CLOUD_RETIRED_KEY, clearCloudAuthTokens, isCloudRetired, markCloudRetired, retirementPlan,
  verifyLocalCopyBeforeRetirement,
} from './cloud-retirement.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    dump: () => Object.fromEntries(data),
  };
}

describe('Retirada de la nube', () => {
  it('verifica la copia exacta antes de permitir desvincular, sin borrar la sesión', async () => {
    const storage = fakeStorage({ 'freedom-auth': 'session' });
    const store = { set(key, value) { storage.setItem(key, value); return { verified: true }; } };
    await expect(verifyLocalCopyBeforeRetirement({ store, storage, key: 'save', value: 'current' })).resolves.toEqual({ verified: true });
    expect(storage.getItem('freedom-auth')).toBe('session');
    expect(isCloudRetired(storage)).toBe(false);
  });

  it.each([
    { blocked: true, verified: false },
    { blocked: false, verified: false, degraded: true },
    { verified: true },
    undefined,
  ])('no acepta un guardado fallido o una relectura distinta: %j', async (result) => {
    const storage = fakeStorage({ 'freedom-auth': 'session', save: 'older' });
    const store = { set: async () => result };
    await expect(verifyLocalCopyBeforeRetirement({ store, storage, key: 'save', value: 'current' })).rejects.toThrow('No se pudo verificar');
    expect(storage.getItem('freedom-auth')).toBe('session');
    expect(storage.getItem('save')).toBe('older');
    expect(isCloudRetired(storage)).toBe(false);
  });

  it('propaga el fallo de escritura sin borrar datos o marcar la retirada', async () => {
    const storage = fakeStorage({ 'freedom-auth': 'session' });
    const store = { set: async () => { throw new Error('quota'); } };
    await expect(verifyLocalCopyBeforeRetirement({ store, storage, key: 'save', value: 'current' })).rejects.toThrow('quota');
    expect(storage.getItem('freedom-auth')).toBe('session');
    expect(isCloudRetired(storage)).toBe(false);
  });

  it('marca el navegador como retirado y lo recuerda', () => {
    const storage = fakeStorage();
    expect(isCloudRetired(storage)).toBe(false);
    expect(markCloudRetired(storage)).toBe(true);
    expect(storage.getItem(CLOUD_RETIRED_KEY)).toBe('1');
    expect(isCloudRetired(storage)).toBe(true);
  });

  it('un almacenamiento bloqueado no rompe nada y cuenta como no retirado', () => {
    const blocked = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
    expect(isCloudRetired(blocked)).toBe(false);
    expect(markCloudRetired(blocked)).toBe(false);
    expect(clearCloudAuthTokens(blocked)).toBe(0);
    expect(isCloudRetired(null)).toBe(false);
  });

  it('borra la sesión y el verificador de Google pero deja intacta la partida', () => {
    const storage = fakeStorage({
      'freedom-auth': '{"access_token":"x"}',
      'freedom-auth-code-verifier': 'abc',
      'freedom-auth-clean-test': 'x',
      'registro-dejar-fumar': '{"partida":true}',
      'registro-dejar-fumar:meta': '{}',
      'freedoom:feature-discovery-seen:v1:hunt-tab': '1',
    });
    expect(clearCloudAuthTokens(storage)).toBe(3);
    expect(Object.keys(storage.dump()).sort()).toEqual([
      'freedoom:feature-discovery-seen:v1:hunt-tab', 'registro-dejar-fumar', 'registro-dejar-fumar:meta',
    ]);
  });

  it('decide el arranque: sin sesión y con partida se retira sin pantallas; sin nada se ofrece recuperar', () => {
    const base = { retirement: true, retired: false, hasSession: false, hasLocalGame: false };
    expect(retirementPlan({ ...base, retirement: false })).toBe('legacy');
    expect(retirementPlan({ ...base, retired: true, hasSession: true })).toBe('retired');
    expect(retirementPlan({ ...base, hasSession: true })).toBe('adopt-cloud');
    expect(retirementPlan({ ...base, hasSession: true, hasLocalGame: true })).toBe('adopt-cloud');
    expect(retirementPlan({ ...base, hasLocalGame: true })).toBe('retire-local');
    expect(retirementPlan(base)).toBe('offer-recovery');
  });

  it('la configuración pública solo activa la retirada cuando se pide expresamente', () => {
    const config = { enabled: true, url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example' };
    expect(readCloudConfig({ FREEDOM_CLOUD_CONFIG: config }).retirement).toBeUndefined();
    expect(readCloudConfig({ FREEDOM_CLOUD_CONFIG: { ...config, retirement: 'sí' } }).retirement).toBeUndefined();
    expect(readCloudConfig({ FREEDOM_CLOUD_CONFIG: { ...config, retirement: true } }).retirement).toBe(true);
    expect(readCloudConfig({ FREEDOM_CLOUD_CONFIG: { enabled: false, retirement: true } })).toEqual({ enabled: false });
  });
});
