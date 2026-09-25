import { describe, expect, it } from 'vitest';
import { canonicalStringify, createMigrationPlan, ensureCloudIdentity, verifyCloudSave, verifyStoredCloudSave, verifyUpdatedCloudSave } from './cloud-migration.js';

const state = {
  config: { mode: 'gradual' },
  days: { '2026-09-23': { cigarettes: 0 } },
  game: { name: 'Ayla', cls: 'druid' },
  habits: { items: [], entries: {} },
};

const cryptoImpl = {
  values: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
  randomUUID() { return this.values.shift(); },
};

describe('cloud migration', () => {
  it('mantiene un identificador permanente para impedir vincular una partida a dos cuentas', () => {
    const localCrypto = {
      values: ['99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
      randomUUID() { return this.values.shift(); },
    };
    const identified = ensureCloudIdentity(state, { cryptoImpl: localCrypto });
    const first = createMigrationPlan(identified, { cryptoImpl: localCrypto });
    const second = createMigrationPlan(identified, { cryptoImpl: localCrypto });
    expect(first.migrationId).toBe('99999999-9999-4999-8999-999999999999');
    expect(second.migrationId).toBe(first.migrationId);
    expect(state.cloudIdentity).toBeUndefined();
  });

  it('produce la misma representación aunque cambie el orden de las claves', () => {
    expect(canonicalStringify({ b: 2, a: 1 })).toBe(canonicalStringify({ a: 1, b: 2 }));
  });

  it('crea y verifica un plan idempotente sin modificar el estado local', () => {
    const plan = createMigrationPlan(state, { cryptoImpl });
    expect(plan.summary).toMatchObject({ hero: 'Ayla', days: 1, habits: 0, meaningful: true });
    expect(verifyCloudSave({
      state: structuredClone(state),
      state_schema_version: plan.schemaVersion,
      checksum: plan.checksum,
      migration_id: plan.migrationId,
    }, plan)).toBe(true);
    expect(state.game.name).toBe('Ayla');
  });

  it('rechaza una respuesta remota alterada', () => {
    const localCrypto = {
      values: ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
      randomUUID() { return this.values.shift(); },
    };
    const plan = createMigrationPlan(state, { cryptoImpl: localCrypto });
    expect(verifyCloudSave({
      state: { ...state, days: {} },
      state_schema_version: plan.schemaVersion,
      checksum: plan.checksum,
      migration_id: plan.migrationId,
    }, plan)).toBe(false);
  });

  it('verifica una partida existente al descargarla en otro navegador', () => {
    const localCrypto = {
      values: ['77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888'],
      randomUUID() { return this.values.shift(); },
    };
    const plan = createMigrationPlan(state, { cryptoImpl: localCrypto });
    expect(verifyStoredCloudSave({
      state: structuredClone(plan.state),
      state_schema_version: plan.schemaVersion,
      checksum: plan.checksum,
      migration_id: 'an-existing-migration',
    })).toBe(true);
    expect(verifyStoredCloudSave({
      state: { ...plan.state, game: { ...plan.state.game, name: 'Alterado' } },
      state_schema_version: plan.schemaVersion,
      checksum: plan.checksum,
    })).toBe(false);
  });

  it('verifica un guardado normal aunque el servidor conserve el linaje original', () => {
    const localCrypto = {
      values: ['12121212-1212-4212-8212-121212121212', '34343434-3434-4434-8434-343434343434'],
      randomUUID() { return this.values.shift(); },
    };
    const migrationPlan = createMigrationPlan(state, { cryptoImpl: localCrypto });
    const updatePlan = { ...migrationPlan, migrationId: null };
    expect(verifyUpdatedCloudSave({
      state: structuredClone(updatePlan.state),
      state_schema_version: updatePlan.schemaVersion,
      checksum: updatePlan.checksum,
      migration_id: migrationPlan.migrationId,
    }, updatePlan)).toBe(true);
  });

  it('calcula la huella sobre el mismo JSON que llega a la nube', () => {
    const localCrypto = {
      values: ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'],
      randomUUID() { return this.values.shift(); },
    };
    const localState = { ...state, optional: undefined, nested: { kept: true, removed: undefined } };
    const plan = createMigrationPlan(localState, { cryptoImpl: localCrypto });
    expect(plan.state).toEqual({ ...state, nested: { kept: true } });
    expect(verifyCloudSave({
      state: structuredClone(plan.state),
      state_schema_version: plan.schemaVersion,
      checksum: plan.checksum,
      migration_id: plan.migrationId,
    }, plan)).toBe(true);
    expect(Object.hasOwn(localState, 'optional')).toBe(true);
  });
});
