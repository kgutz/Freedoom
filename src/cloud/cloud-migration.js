import {
  checksumOf,
  stateInformationProfile,
  validateImportedState,
} from '../storage/state-storage.js';

export const CLOUD_STATE_SCHEMA_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => (
    `${JSON.stringify(key)}:${canonicalStringify(value[key])}`
  )).join(',')}}`;
}

function createIdentifier(cryptoImpl) {
  if (typeof cryptoImpl?.randomUUID === 'function') return cryptoImpl.randomUUID();
  throw new Error('Este dispositivo no puede crear un identificador seguro');
}

export function ensureCloudIdentity(state, { cryptoImpl = globalThis.crypto } = {}) {
  const existing = state?.cloudIdentity?.lineageId;
  if (typeof existing === 'string' && UUID_PATTERN.test(existing)) return state;
  return {
    ...state,
    cloudIdentity: {
      ...(state?.cloudIdentity || {}),
      lineageId: createIdentifier(cryptoImpl),
    },
  };
}

export function createMigrationPlan(state, {
  cryptoImpl = globalThis.crypto,
  deviceId = null,
} = {}) {
  validateImportedState(state);
  // Match the exact JSON value Postgres receives. In-memory optional fields
  // with `undefined` are omitted by JSON transport and must not change the hash.
  const cloudState = JSON.parse(JSON.stringify(state));
  const canonical = canonicalStringify(cloudState);
  const profile = stateInformationProfile(cloudState);
  return Object.freeze({
    state: cloudState,
    schemaVersion: CLOUD_STATE_SCHEMA_VERSION,
    checksum: checksumOf(canonical),
    migrationId: UUID_PATTERN.test(cloudState.cloudIdentity?.lineageId || '')
      ? cloudState.cloudIdentity.lineageId
      : createIdentifier(cryptoImpl),
    deviceId: deviceId || createIdentifier(cryptoImpl),
    summary: Object.freeze({
      hero: state.game?.name || 'Sin elegir',
      days: profile.dayCount,
      habits: profile.habitCount,
      meaningful: profile.meaningful,
    }),
  });
}

export function verifyCloudSave(row, plan) {
  if (!row || !plan) return false;
  if (row.state_schema_version !== plan.schemaVersion) return false;
  if (row.checksum !== plan.checksum) return false;
  if (row.migration_id !== plan.migrationId) return false;
  return checksumOf(canonicalStringify(row.state)) === plan.checksum;
}

export function verifyStoredCloudSave(row) {
  if (!row || !row.state || row.state_schema_version !== CLOUD_STATE_SCHEMA_VERSION) return false;
  return checksumOf(canonicalStringify(row.state)) === row.checksum;
}
