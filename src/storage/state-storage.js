import LZString from 'lz-string';

export const STORAGE_KEY = 'registro-dejar-fumar';
export const STORAGE_SCHEMA_VERSION = 2;
export const RECOVERY_SLOT_COUNT = 3;
export const ACTION_LOG_LIMIT = 50;
export const BACKUP_FORMAT = 'freedoom-backup';
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_CHARACTERS = 4 * 1024 * 1024;

const META_SUFFIX = ':meta';
const SLOT_SUFFIX = ':recovery:';
const ACTION_SUFFIX = ':actions';
const DAILY_SUFFIX = ':daily';
const WEEKLY_SUFFIX = ':weekly';
const LAST_INFO_SUFFIX = ':last-info';
const TEMPORAL_SLOT_COUNT = 5;
const TEMPORAL_INTERVAL = 20 * 60 * 1000;

export function selectTemporalRecoveries(candidates, now = Date.now()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const previousDay = localDateKey(yesterday.getTime());
  const valid = candidates.filter(item => item.savedAt > 0 && item.savedAt <= now);
  const newest = items => [...items].sort((a, b) => b.savedAt - a.savedAt)[0] || null;
  return {
    daily: newest(valid.filter(item => localDateKey(item.savedAt) === previousDay)),
    hourly: newest(valid.filter(item => localDateKey(item.savedAt) === localDateKey(now) && item.savedAt <= now - 3600000)),
  };
}
const DATABASE_NAME = 'freedoom-recovery';
const DATABASE_STORE = 'snapshots';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_IMPORT_DEPTH = 40;
const MAX_IMPORT_NODES = 100000;
const MAX_IMPORT_ARRAY_ITEMS = 10000;
const MAX_IMPORT_OBJECT_KEYS = 20000;
const MAX_IMPORT_STRING_LENGTH = 512 * 1024;

function assertStringField(value, name, maximum, { allowEmpty = true } = {}) {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length > maximum || (!allowEmpty && value.length === 0)) {
    throw new Error(`Campo no válido en la copia: ${name}`);
  }
}

function assertBoundedCollection(value, name, maximum) {
  if (value === undefined) return;
  const size = Array.isArray(value) ? value.length : isObject(value) ? Object.keys(value).length : -1;
  if (size < 0 || size > maximum) throw new Error(`Colección no válida en la copia: ${name}`);
}

function validateObjectGraph(root) {
  const pending = [{ value: root, depth: 0 }];
  const seen = new Set();
  let nodes = 0;
  while (pending.length) {
    const { value, depth } = pending.pop();
    nodes += 1;
    if (nodes > MAX_IMPORT_NODES || depth > MAX_IMPORT_DEPTH) {
      throw new Error('La copia es demasiado grande o compleja');
    }
    if (typeof value === 'string') {
      if (value.length > MAX_IMPORT_STRING_LENGTH) throw new Error('La copia contiene un texto demasiado largo');
      continue;
    }
    if (value === null || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > MAX_IMPORT_ARRAY_ITEMS) throw new Error('La copia contiene demasiados elementos');
      value.forEach(item => pending.push({ value: item, depth: depth + 1 }));
      continue;
    }
    const entries = Object.entries(value);
    if (entries.length > MAX_IMPORT_OBJECT_KEYS) throw new Error('La copia contiene demasiadas propiedades');
    entries.forEach(([key, child]) => {
      if (FORBIDDEN_OBJECT_KEYS.has(key) || key.length > 512) {
        throw new Error('La copia contiene una propiedad no permitida');
      }
      pending.push({ value: child, depth: depth + 1 });
    });
  }
}

export function validateImportedState(state) {
  if (!isObject(state) || (!isObject(state.days) && !isObject(state.config))) {
    throw new Error('Formato de copia no válido');
  }
  validateObjectGraph(state);
  if (state.config !== undefined && !isObject(state.config)) throw new Error('Configuración no válida en la copia');
  assertBoundedCollection(state.days, 'days', 10000);
  if (state.game !== undefined && !isObject(state.game)) throw new Error('Héroe no válido en la copia');
  assertStringField(state.game?.name, 'game.name', 64);
  if (state.game?.cls !== undefined && state.game.cls !== null &&
      !['knight', 'paladin', 'sorcerer', 'druid'].includes(state.game.cls)) {
    throw new Error('Clase no válida en la copia');
  }
  if (state.habits !== undefined && !isObject(state.habits)) throw new Error('Hábitos no válidos en la copia');
  assertBoundedCollection(state.habits?.items, 'habits.items', 500);
  assertBoundedCollection(state.habits?.entries, 'habits.entries', 50000);
  (state.habits?.items || []).forEach((habit, index) => {
    if (!isObject(habit)) throw new Error(`Hábito no válido en la copia: ${index}`);
    assertStringField(habit.id, `habits.items[${index}].id`, 128, { allowEmpty: false });
    assertStringField(habit.title, `habits.items[${index}].title`, 200, { allowEmpty: false });
    assertStringField(habit.notes, `habits.items[${index}].notes`, 2000);
  });
  if (state.todos !== undefined && !isObject(state.todos)) throw new Error('Tareas no válidas en la copia');
  assertBoundedCollection(state.todos?.items, 'todos.items', 1000);
  (state.todos?.items || []).forEach((todo, index) => {
    if (!isObject(todo)) throw new Error(`Tarea no válida en la copia: ${index}`);
    assertStringField(todo.id, `todos.items[${index}].id`, 128, { allowEmpty: false });
    assertStringField(todo.title, `todos.items[${index}].title`, 200, { allowEmpty: false });
    assertStringField(todo.notes, `todos.items[${index}].notes`, 2000);
  });
  if (state.economy !== undefined && !isObject(state.economy)) throw new Error('Economía no válida en la copia');
  ['coins', 'bossBlood', 'arcaneFibers', 'arcaneInks'].forEach((key) => {
    const value = state.economy?.[key];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > 1000000000)) {
      throw new Error(`Recurso no válido en la copia: ${key}`);
    }
  });
  assertBoundedCollection(state.economy?.transactions, 'economy.transactions', 2000);
  assertBoundedCollection(state.inventory?.relics, 'inventory.relics', 5000);
  assertBoundedCollection(state.inventory?.collection, 'inventory.collection', 5000);
  return state;
}

function collectionSize(value) {
  return isObject(value) ? Object.keys(value).length : 0;
}

export function stateInformationProfile(state) {
  const safeState = isObject(state) ? state : {};
  const game = isObject(safeState.game) ? safeState.game : {};
  const combat = isObject(game.bossCombat) ? game.bossCombat : {};
  const habits = isObject(safeState.habits) ? safeState.habits : {};
  const dayCount = collectionSize(safeState.days);
  const habitCount = Array.isArray(habits.items) ? habits.items.length : 0;
  const habitEntryCount = collectionSize(habits.entries);
  const economy = isObject(safeState.economy) ? safeState.economy : {};
  const loot = isObject(safeState.loot) ? safeState.loot : {};
  const inventory = isObject(safeState.inventory) ? safeState.inventory : {};
  const forge = isObject(safeState.forge) ? safeState.forge : {};
  const relicCount = collectionSize(inventory.relics);
  const discoveredRelicCount = collectionSize(inventory.collection);
  const claimedRewardCount = Array.isArray(loot.claimedBossRewards)
    ? loot.claimedBossRewards.length
    : 0;
  const earlyVictoryOutcomeCount = collectionSize(loot.earlyVictoryOutcomes);
  const economyValue = Math.max(0, Number(economy.coins) || 0) +
    Math.max(0, Number(economy.bossBlood) || 0) * 25 +
    Math.max(0, Number(economy.arcaneFibers) || 0) * 20;
  const forgeHistoryCount = Array.isArray(forge.history)
    ? forge.history.length
    : 0;
  const fusionHistoryCount = Array.isArray(forge.fusion?.history)
    ? forge.fusion.history.length
    : 0;
  const weavingHistoryCount = Array.isArray(forge.weaving?.history)
    ? forge.weaving.history.length
    : 0;
  const ownedOutfitCount = collectionSize(game.outfits?.owned);
  const bossesDown = Math.max(0, Number(combat.legacyBossesDown) || 0) +
    Math.max(0, Number(combat.defeated) || 0);
  const bossHistoryCount = Array.isArray(combat.history)
    ? combat.history.length
    : 0;
  const hasHero = typeof game.cls === 'string' && game.cls.length > 0;
  const onboarded = safeState.onboarded === true;
  // Spendable currency is intentionally excluded from structuralScore: coins/bossBlood/
  // arcaneFibers are meant to go up and down through normal play (shop purchases, forging),
  // so a drop there must never by itself look like catastrophic data loss.
  const economyScore = Math.min(80, Math.floor(economyValue / 10));
  const structuralScore =
    (onboarded ? 40 : 0) +
    (hasHero ? 80 : 0) +
    Math.min(240, dayCount * 4) +
    Math.min(120, habitCount * 15) +
    Math.min(120, habitEntryCount * 3) +
    Math.min(180, bossesDown * 40) +
    Math.min(80, bossHistoryCount * 10) +
    Math.min(180, relicCount * 30) +
    Math.min(180, discoveredRelicCount * 25) +
    Math.min(120, claimedRewardCount * 20) +
    Math.min(60, earlyVictoryOutcomeCount * 10) +
    Math.min(40, forgeHistoryCount * 5) +
    Math.min(80, fusionHistoryCount * 10) +
    Math.min(60, weavingHistoryCount * 15) +
    Math.min(60, ownedOutfitCount * 20);
  const score = structuralScore + economyScore;

  return {
    score,
    structuralScore,
    onboarded,
    hasHero,
    dayCount,
    habitCount,
    habitEntryCount,
    bossesDown,
    bossHistoryCount,
    relicCount,
    discoveredRelicCount,
    claimedRewardCount,
    earlyVictoryOutcomeCount,
    economyValue,
    forgeHistoryCount,
    fusionHistoryCount,
    weavingHistoryCount,
    ownedOutfitCount,
    meaningful:
      (onboarded && hasHero) ||
      dayCount > 0 ||
      habitCount > 0 ||
      habitEntryCount > 0 ||
      bossesDown > 0 ||
      relicCount > 0 ||
      discoveredRelicCount > 0 ||
      claimedRewardCount > 0 ||
      earlyVictoryOutcomeCount > 0 ||
      economyValue > 0 ||
      forgeHistoryCount > 0 ||
      fusionHistoryCount > 0 ||
      weavingHistoryCount > 0 ||
      ownedOutfitCount > 0,
  };
}

export function isCatastrophicStateRegression(candidateState, referenceState) {
  const candidate = stateInformationProfile(candidateState);
  const reference = stateInformationProfile(referenceState);
  if (!reference.meaningful) return false;
  if (reference.onboarded && reference.hasHero &&
      (!candidate.onboarded || !candidate.hasHero)) return true;

  const daysCollapsed =
    reference.dayCount >= 4 &&
    candidate.dayCount <= Math.max(1, Math.floor(reference.dayCount * 0.25));
  const habitsCollapsed =
    reference.habitCount >= 2 && candidate.habitCount === 0;
  const bossesCollapsed =
    reference.bossesDown >= 1 && candidate.bossesDown === 0;
  const lootCollapsed =
    (reference.relicCount >= 1 && candidate.relicCount === 0) ||
    (reference.discoveredRelicCount >= 1 && candidate.discoveredRelicCount === 0) ||
    (reference.fusionHistoryCount >= 1 && candidate.fusionHistoryCount === 0) ||
    (reference.claimedRewardCount >= 1 && candidate.claimedRewardCount === 0) ||
    (reference.earlyVictoryOutcomeCount >= 1 && candidate.earlyVictoryOutcomeCount === 0);
  // Uses structuralScore (excludes spendable currency) so a normal purchase or forging
  // cost can never by itself look like the catastrophic loss this guard exists to catch.
  const scoreCollapsed =
    reference.structuralScore >= 120 &&
    candidate.structuralScore <= reference.structuralScore * 0.35;

  return lootCollapsed || scoreCollapsed ||
    (daysCollapsed && (habitsCollapsed || bossesCollapsed || candidate.structuralScore < 120));
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localWeekKey(timestamp) {
  const date = new Date(timestamp);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return localDateKey(date.getTime());
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function parseState(serialized) {
  const data = JSON.parse(serialized);
  if (!isObject(data)) throw new Error('Formato de estado no válido');
  return data;
}

export function mergeState(currentState, savedState) {
  if (!isObject(savedState)) return currentState;

  const nextState = {
    ...currentState,
    config: { ...currentState.config },
    days: currentState.days,
    game: currentState.game,
    habits: currentState.habits,
    todos: currentState.todos,
    economy: currentState.economy,
    loot: currentState.loot,
    inventory: currentState.inventory,
    forge: currentState.forge,
    shop: currentState.shop,
  };

  if (isObject(savedState.config)) {
    nextState.config = { ...nextState.config, ...savedState.config };
  }
  if (isObject(savedState.days)) nextState.days = savedState.days;
  if (savedState.seeded === true) nextState.seeded = true;
  if (savedState.seededV) nextState.seededV = savedState.seededV;
  if (isObject(savedState.game)) nextState.game = savedState.game;
  if (isObject(savedState.habits)) {
    nextState.habits = {
      items: Array.isArray(savedState.habits.items)
        ? savedState.habits.items
        : [],
      entries: isObject(savedState.habits.entries)
        ? savedState.habits.entries
        : {},
      dailyCoinBonuses: isObject(savedState.habits.dailyCoinBonuses)
        ? savedState.habits.dailyCoinBonuses
        : {},
    };
  }
  if (isObject(savedState.todos)) {
    nextState.todos = {
      items: Array.isArray(savedState.todos.items) ? savedState.todos.items : [],
    };
  }
  if (isObject(savedState.economy)) nextState.economy = savedState.economy;
  if (isObject(savedState.loot)) nextState.loot = savedState.loot;
  if (isObject(savedState.inventory)) nextState.inventory = savedState.inventory;
  if (isObject(savedState.forge)) nextState.forge = savedState.forge;
  if (isObject(savedState.shop)) nextState.shop = savedState.shop;
  if (savedState.onboarded === true) nextState.onboarded = true;

  return nextState;
}

export function exportBackup(state) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    state,
  });
}

export function isImportCommand(value) {
  return String(value ?? '').trimStart().startsWith('!');
}

export function importBackup(currentState, backupText) {
  if (isImportCommand(backupText)) {
    throw new Error('Los comandos de importación ya no están permitidos');
  }
  if (typeof backupText !== 'string' || backupText.length > MAX_BACKUP_CHARACTERS) {
    throw new Error('La copia supera el tamaño máximo permitido');
  }
  const parsed = parseState(backupText);
  let savedState = parsed;
  if (parsed.format !== undefined || parsed.schemaVersion !== undefined || parsed.state !== undefined) {
    if (
      parsed.format !== BACKUP_FORMAT ||
      parsed.schemaVersion !== BACKUP_SCHEMA_VERSION ||
      !isObject(parsed.state)
    ) {
      throw new Error('Versión de copia no compatible');
    }
    savedState = parsed.state;
  }
  validateImportedState(savedState);

  return {
    ...mergeState(currentState, savedState),
    seeded: true,
  };
}

export function checksumOf(serialized) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createStateEnvelope(
  state,
  revision,
  savedAt = Date.now(),
  { generation = 0, snapshotType = null, periodKey = null } = {},
) {
  const value = serializeState(state);
  const envelope = {
    format: 'freedoom-state',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    revision: Math.max(1, Math.trunc(Number(revision) || 1)),
    savedAt: Math.max(0, Math.trunc(Number(savedAt) || Date.now())),
    generation: Math.max(0, Math.trunc(Number(generation) || 0)),
    checksum: checksumOf(value),
    state,
  };
  if (snapshotType) envelope.snapshotType = snapshotType;
  if (periodKey) envelope.periodKey = periodKey;
  return envelope;
}

const COMPRESSED_ENVELOPE_PREFIX = 'freedoom-lz1:';

function serializeEnvelope(envelope) {
  const plain = JSON.stringify(envelope);
  if (plain.length < 16384) return plain;
  const compressed = COMPRESSED_ENVELOPE_PREFIX + LZString.compressToUTF16(plain);
  return compressed.length < plain.length ? compressed : plain;
}

export function parseStateEnvelope(serialized) {
  const plain = typeof serialized === 'string' && serialized.startsWith(COMPRESSED_ENVELOPE_PREFIX)
    ? LZString.decompressFromUTF16(serialized.slice(COMPRESSED_ENVELOPE_PREFIX.length))
    : serialized;
  const envelope = JSON.parse(plain);
  if (
    !isObject(envelope) ||
    envelope.format !== 'freedoom-state' ||
    !isObject(envelope.state) ||
    !Number.isFinite(envelope.revision) ||
    !Number.isFinite(envelope.savedAt)
  ) {
    throw new Error('Copia de recuperación no válida');
  }
  const stateText = serializeState(envelope.state);
  if (checksumOf(stateText) !== envelope.checksum) {
    throw new Error('Copia de recuperación dañada');
  }
  return {
    ...envelope,
    generation: Math.max(0, Math.trunc(Number(envelope.generation) || 0)),
  };
}

function safeEnvelope(serialized, source) {
  if (!serialized) return null;
  try {
    return { ...parseStateEnvelope(serialized), source };
  } catch {
    return null;
  }
}

function openRecoveryDatabase(indexedDB) {
  if (!indexedDB?.open) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DATABASE_STORE)) {
        database.createObjectStore(DATABASE_STORE, { keyPath: 'revision' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB no disponible'));
  });
}

function deleteRecoveryDatabase(indexedDB) {
  if (!indexedDB?.deleteDatabase) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error('No se pudo borrar IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB está en uso y no se pudo borrar'));
  });
}

async function readIndexedEnvelopes(indexedDB) {
  const database = await openRecoveryDatabase(indexedDB);
  if (!database) return [];
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, 'readonly');
      const request = transaction.objectStore(DATABASE_STORE).getAll();
      request.onsuccess = () => resolve(
        (request.result || [])
          .map((item) => safeEnvelope(JSON.stringify(item), 'indexeddb'))
          .filter(Boolean),
      );
      request.onerror = () => reject(request.error || new Error('No se pudo leer IndexedDB'));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedEnvelope(indexedDB, envelope) {
  const database = await openRecoveryDatabase(indexedDB);
  if (!database) return false;
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(DATABASE_STORE, 'readwrite');
      const store = transaction.objectStore(DATABASE_STORE);
      store.put(envelope);
      const keysRequest = store.getAllKeys();
      keysRequest.onsuccess = () => {
        const keys = (keysRequest.result || [])
          .map(Number)
          .filter(Number.isFinite)
          .sort((left, right) => right - left);
        keys.slice(RECOVERY_SLOT_COUNT).forEach((key) => store.delete(key));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error || new Error('No se pudo escribir IndexedDB'),
      );
      transaction.onabort = () => reject(
        transaction.error || new Error('IndexedDB canceló el guardado'),
      );
    });
    return true;
  } finally {
    database.close();
  }
}

function localCandidates(localStorage, key) {
  const candidates = [];
  for (const suffix of [':previous-day', ':hour-ago', ...Array.from({length:TEMPORAL_SLOT_COUNT}, (_, i) => `:timeline:${i}`)]) {
    const candidate = safeEnvelope(localStorage.getItem(`${key}${suffix}`), suffix.slice(1));
    if (candidate) candidates.push(candidate);
  }
  const mainValue = localStorage.getItem(key);
  if (mainValue !== null) {
    try {
      parseState(mainValue);
      const metaText = localStorage.getItem(`${key}${META_SUFFIX}`);
      const meta = metaText ? JSON.parse(metaText) : null;
      const validMeta =
        isObject(meta) &&
        Number.isFinite(meta.revision) &&
        Number.isFinite(meta.savedAt) &&
        meta.checksum === checksumOf(mainValue);
      candidates.push({
        state: parseState(mainValue),
        revision: validMeta ? meta.revision : 0,
        savedAt: validMeta ? meta.savedAt : 0,
        generation: validMeta
          ? Math.max(0, Math.trunc(Number(meta.generation) || 0))
          : 0,
        checksum: checksumOf(mainValue),
        source: 'main',
      });
    } catch {
      // La copia principal dañada no impide probar las recuperaciones.
    }
  }
  for (let index = 0; index < RECOVERY_SLOT_COUNT; index += 1) {
    const candidate = safeEnvelope(
      localStorage.getItem(`${key}${SLOT_SUFFIX}${index}`),
      `recovery-${index}`,
    );
    if (candidate) candidates.push(candidate);
  }
  const daily = safeEnvelope(
    localStorage.getItem(`${key}${DAILY_SUFFIX}`),
    'daily',
  );
  if (daily) candidates.push(daily);
  const weekly = safeEnvelope(
    localStorage.getItem(`${key}${WEEKLY_SUFFIX}`),
    'weekly',
  );
  if (weekly) candidates.push(weekly);
  const lastInfo = safeEnvelope(
    localStorage.getItem(`${key}${LAST_INFO_SUFFIX}`),
    'last-info',
  );
  if (lastInfo) candidates.push(lastInfo);
  return candidates;
}

function newestCandidate(candidates) {
  const priorities = { main: 3, indexeddb: 1 };
  const highestGeneration = candidates.reduce(
    (highest, candidate) => Math.max(highest, candidate.generation || 0),
    0,
  );
  const currentGeneration = candidates.filter(
    (candidate) => (candidate.generation || 0) === highestGeneration,
  );
  const sorted = [...currentGeneration].sort((left, right) => {
    if (right.revision !== left.revision) return right.revision - left.revision;
    if (right.savedAt !== left.savedAt) return right.savedAt - left.savedAt;
    return (priorities[right.source] || 2) - (priorities[left.source] || 2);
  });
  const newest = sorted[0] || null;
  if (!newest) return null;

  const richest = [...currentGeneration].sort((left, right) => {
    const scoreDifference =
      stateInformationProfile(right.state).score -
      stateInformationProfile(left.state).score;
    if (scoreDifference) return scoreDifference;
    if (right.revision !== left.revision) return right.revision - left.revision;
    return right.savedAt - left.savedAt;
  })[0];
  return richest && isCatastrophicStateRegression(newest.state, richest.state)
    ? richest
    : newest;
}

function protectedSnapshotDecision(existing, envelope, periodKey) {
  const incomingProfile = stateInformationProfile(envelope.state);
  if (!incomingProfile.meaningful) return false;
  if (!existing) return true;
  if ((existing.generation || 0) !== (envelope.generation || 0)) return true;
  const existingProfile = stateInformationProfile(existing.state);
  if (existing.periodKey !== periodKey) {
    return !isCatastrophicStateRegression(envelope.state, existing.state);
  }
  return incomingProfile.score > existingProfile.score;
}

function updateProtectedSnapshot({
  localStorage,
  key,
  suffix,
  source,
  envelope,
  periodKey,
}) {
  const storageKey = `${key}${suffix}`;
  const existing = safeEnvelope(localStorage.getItem(storageKey), source);
  if (!protectedSnapshotDecision(existing, envelope, periodKey)) {
    return { available: Boolean(existing), updated: false, error: null };
  }
  try {
    const protectedEnvelope = createStateEnvelope(
      envelope.state,
      envelope.revision,
      envelope.savedAt,
      {
        generation: envelope.generation,
        snapshotType: source,
        periodKey,
      },
    );
    localStorage.setItem(storageKey, serializeEnvelope(protectedEnvelope));
    const verified = parseStateEnvelope(localStorage.getItem(storageKey));
    return {
      available: verified.checksum === protectedEnvelope.checksum,
      updated: true,
      error: null,
    };
  } catch (error) {
    return { available: Boolean(existing), updated: false, error };
  }
}

function updateLastInformativeSnapshot({ localStorage, key, envelope }) {
  const storageKey = `${key}${LAST_INFO_SUFFIX}`;
  const existing = safeEnvelope(localStorage.getItem(storageKey), 'last-info');
  const incomingProfile = stateInformationProfile(envelope.state);
  const canReplace =
    incomingProfile.meaningful &&
    (!existing ||
      (existing.generation || 0) !== (envelope.generation || 0) ||
      !isCatastrophicStateRegression(envelope.state, existing.state));
  if (!canReplace) {
    return { available: Boolean(existing), updated: false, error: null };
  }
  try {
    const protectedEnvelope = createStateEnvelope(
      envelope.state,
      envelope.revision,
      envelope.savedAt,
      {
        generation: envelope.generation,
        snapshotType: 'last-info',
        periodKey: localDateKey(envelope.savedAt),
      },
    );
    localStorage.setItem(storageKey, serializeEnvelope(protectedEnvelope));
    const verified = parseStateEnvelope(localStorage.getItem(storageKey));
    return {
      available: verified.checksum === protectedEnvelope.checksum,
      updated: true,
      error: null,
    };
  } catch (error) {
    return { available: Boolean(existing), updated: false, error };
  }
}

// Compact only valid recovery copies, in place, without deleting any history.
// localStorage replacement is atomic: a failed write leaves the old copy intact.
function compactRecoveryCopies(localStorage, key) {
  const suffixes = [DAILY_SUFFIX, WEEKLY_SUFFIX, LAST_INFO_SUFFIX, ':previous-day', ':hour-ago',
    ...Array.from({length:RECOVERY_SLOT_COUNT}, (_, i) => `${SLOT_SUFFIX}${i}`),
    ...Array.from({length:TEMPORAL_SLOT_COUNT}, (_, i) => `:timeline:${i}`)];
  for (const suffix of suffixes) {
    try {
      const stored = localStorage.getItem(`${key}${suffix}`);
      if (!stored || stored.startsWith(COMPRESSED_ENVELOPE_PREFIX)) continue;
      const packed = serializeEnvelope(parseStateEnvelope(stored));
      if (packed.length < stored.length) {
        parseStateEnvelope(packed); // Validate the lossless round trip before replacing.
        localStorage.setItem(`${key}${suffix}`, packed);
      }
    } catch {
      // Preserve unreadable or unwritable copies; normal save reports write failures.
    }
  }
}

export function createBrowserStore(browserWindow) {
  const externalStorage = browserWindow.storage;
  const localStorage = browserWindow.localStorage;
  const indexedDB = browserWindow.indexedDB;
  const usesExternalStorage = Boolean(
    externalStorage?.get && externalStorage?.set,
  );
  let currentRevision = 0;
  let currentSavedAt = 0;
  let currentGeneration = 0;
  let pendingGenerationAdvance = false;

  const recoveryList = async (key = STORAGE_KEY) => {
    if (usesExternalStorage || !localStorage) return [];
    let candidates = localCandidates(localStorage, key);
    try {
      candidates = candidates.concat(await readIndexedEnvelopes(indexedDB));
    } catch {
      // Las copias locales siguen siendo válidas aunque falle IndexedDB.
    }
    const unique = new Map();
    candidates.forEach((candidate) => {
      const protectedSource =
        candidate.source === 'daily' ||
        candidate.source === 'weekly' ||
        candidate.source === 'last-info';
      const identity = protectedSource
        ? `${candidate.source}:${candidate.generation || 0}:${candidate.revision}`
        : `${candidate.generation || 0}:${candidate.revision}`;
      const previous = unique.get(identity);
      if (!previous || candidate.savedAt > previous.savedAt) {
        unique.set(identity, candidate);
      }
    });
    return [...unique.values()].sort(
      (left, right) =>
        (right.generation || 0) - (left.generation || 0) ||
        right.revision - left.revision ||
        right.savedAt - left.savedAt,
    );
  };

  return {
    usesExternalStorage,

    async get(key) {
      if (usesExternalStorage) return externalStorage.get(key);
      if (!localStorage) return null;
      const candidates = await recoveryList(key);
      const selected = newestCandidate(candidates);
      if (!selected) return null;
      currentRevision = Math.max(0, selected.revision || 0);
      currentSavedAt = Math.max(0, selected.savedAt || 0);
      currentGeneration = Math.max(0, selected.generation || 0);
      const main = candidates.find(
        (candidate) =>
          candidate.source === 'main' &&
          (candidate.generation || 0) === currentGeneration,
      );
      const recovered = selected.source !== 'main' && (
        !main || selected.revision > main.revision ||
        checksumOf(serializeState(selected.state)) !== main.checksum ||
        isCatastrophicStateRegression(main.state, selected.state)
      );
      return {
        key,
        value: serializeState(selected.state),
        revision: currentRevision,
        savedAt: currentSavedAt,
        generation: currentGeneration,
        recovered,
        source: selected.source,
      };
    },

    set(key, value) {
      if (usesExternalStorage) return externalStorage.set(key, value);
      if (!localStorage) throw new Error('Almacenamiento local no disponible');
      const parsedState = parseState(value);
      compactRecoveryCopies(localStorage, key);
      const existingCandidates = localCandidates(localStorage, key).filter(
        (candidate) => (candidate.generation || 0) === currentGeneration,
      );
      const richestExisting = [...existingCandidates].sort(
        (left, right) =>
          stateInformationProfile(right.state).score -
          stateInformationProfile(left.state).score,
      )[0];
      if (
        !pendingGenerationAdvance &&
        richestExisting &&
        isCatastrophicStateRegression(parsedState, richestExisting.state)
      ) {
        return {
          key,
          value,
          revision: currentRevision,
          savedAt: currentSavedAt,
          generation: currentGeneration,
          verified: false,
          recoverySaved: true,
          degraded: false,
          blocked: true,
          protectedSource: richestExisting.source,
        };
      }
      if (pendingGenerationAdvance) {
        currentGeneration += 1;
        pendingGenerationAdvance = false;
      }
      const revision = currentRevision + 1;
      const savedAt = Date.now();
      const envelope = createStateEnvelope(parsedState, revision, savedAt, {
        generation: currentGeneration,
      });
      const envelopeText = serializeEnvelope(envelope);
      // Freeze historical candidates before the rolling/current slots are overwritten.
      // Legacy daily/weekly snapshots remain readable and are never relabelled as yesterday.
      const historical = selectTemporalRecoveries(localCandidates(localStorage, key), savedAt);
      let temporalError = null;
      try {
        for (const [name, snapshot] of [['previous-day', historical.daily], ['hour-ago', historical.hourly]]) {
          if (snapshot) localStorage.setItem(`${key}:${name}`, serializeEnvelope(snapshot));
        }
        if (stateInformationProfile(parsedState).meaningful) {
          const bucket = Math.floor(savedAt / TEMPORAL_INTERVAL);
          const temporalKey = `${key}:timeline:${bucket % TEMPORAL_SLOT_COUNT}`;
          const existing = safeEnvelope(localStorage.getItem(temporalKey), 'timeline');
          // Keep the first save in each bucket, rather than replacing it on every action.
          if (!existing || Math.floor(existing.savedAt / TEMPORAL_INTERVAL) !== bucket) {
            localStorage.setItem(temporalKey, envelopeText);
          }
        }
      } catch (error) {
        temporalError = error;
      }
      const slotKey = `${key}${SLOT_SUFFIX}${revision % RECOVERY_SLOT_COUNT}`;
      let recoverySaved = false;
      let mainSaved = false;
      let recoveryError = null;
      let mainError = null;

      try {
        localStorage.setItem(slotKey, envelopeText);
        const verified = parseStateEnvelope(localStorage.getItem(slotKey));
        recoverySaved = verified.revision === revision;
      } catch (error) {
        recoveryError = error;
      }

      try {
        localStorage.setItem(key, value);
        if (localStorage.getItem(key) !== value) {
          throw new Error('La verificación del guardado principal falló');
        }
        localStorage.setItem(
          `${key}${META_SUFFIX}`,
          JSON.stringify({
            revision,
            savedAt,
            generation: currentGeneration,
            checksum: checksumOf(value),
          }),
        );
        mainSaved = true;
      } catch (error) {
        mainError = error;
      }

      const dailySnapshot = updateProtectedSnapshot({
        localStorage,
        key,
        suffix: DAILY_SUFFIX,
        source: 'daily',
        envelope,
        periodKey: localDateKey(savedAt),
      });
      const weeklySnapshot = updateProtectedSnapshot({
        localStorage,
        key,
        suffix: WEEKLY_SUFFIX,
        source: 'weekly',
        envelope,
        periodKey: localWeekKey(savedAt),
      });
      const lastInformativeSnapshot = updateLastInformativeSnapshot({
        localStorage,
        key,
        envelope,
      });
      const requiresProtectedSnapshots = stateInformationProfile(parsedState).meaningful;

      if (!recoverySaved && !mainSaved &&
          !dailySnapshot.available &&
          !weeklySnapshot.available &&
          !lastInformativeSnapshot.available) {
        throw mainError || recoveryError || new Error('No se pudo guardar la partida');
      }

      currentRevision = revision;
      currentSavedAt = savedAt;
      const mirrorPromise = writeIndexedEnvelope(indexedDB, envelope);
      return {
        key,
        value,
        revision,
        savedAt,
        generation: currentGeneration,
        blocked: false,
        verified: mainSaved,
        recoverySaved,
        dailySnapshot,
        weeklySnapshot,
        lastInformativeSnapshot,
        degraded:
          !mainSaved ||
          !recoverySaved ||
          (requiresProtectedSnapshots &&
            (!dailySnapshot.available ||
              !weeklySnapshot.available ||
              !lastInformativeSnapshot.available)),
        errors: [
          temporalError,
          mainError,
          recoveryError,
          dailySnapshot.error,
          weeklySnapshot.error,
          lastInformativeSnapshot.error,
        ].filter(Boolean),
        mirrorPromise,
      };
    },

    authorizeDestructiveSave() {
      pendingGenerationAdvance = true;
    },

    async listRecoveries(key = STORAGE_KEY) {
      return recoveryList(key);
    },

    async recoveryState(revision, key = STORAGE_KEY, source = null) {
      const candidates = await recoveryList(key);
      return candidates.find(
        (candidate) =>
          candidate.revision === revision &&
          (!source || candidate.source === source),
      )?.state || null;
    },

    recordAction(action, key = STORAGE_KEY) {
      if (usesExternalStorage || !localStorage || !isObject(action)) return false;
      const actionKey = `${key}${ACTION_SUFFIX}`;
      let actions = [];
      try {
        const previous = localStorage.getItem(actionKey);
        actions = previous ? JSON.parse(previous) : [];
        if (!Array.isArray(actions)) actions = [];
      } catch {
        actions = [];
      }
      const type = typeof action.type === 'string' ? action.type.slice(0, 80) : 'unknown';
      actions.push({ type, at: action.at || Date.now() });
      localStorage.setItem(
        actionKey,
        JSON.stringify(actions.slice(-ACTION_LOG_LIMIT)),
      );
      return true;
    },

    actionLog(key = STORAGE_KEY) {
      if (usesExternalStorage || !localStorage) return [];
      try {
        const actions = JSON.parse(
          localStorage.getItem(`${key}${ACTION_SUFFIX}`) || '[]',
        );
        return Array.isArray(actions) ? actions : [];
      } catch {
        return [];
      }
    },

    async purge(key = STORAGE_KEY) {
      if (usesExternalStorage) {
        throw new Error('El almacenamiento externo debe borrar sus datos desde el proveedor');
      }
      if (localStorage?.removeItem) {
        const keys = [];
        if (Number.isFinite(localStorage.length) && typeof localStorage.key === 'function') {
          for (let index = 0; index < localStorage.length; index += 1) {
            const candidate = localStorage.key(index);
            if (candidate?.startsWith(key)) keys.push(candidate);
          }
        } else {
          keys.push(
            key,
            `${key}${META_SUFFIX}`,
            `${key}${ACTION_SUFFIX}`,
            `${key}${DAILY_SUFFIX}`,
            `${key}${WEEKLY_SUFFIX}`,
            `${key}${LAST_INFO_SUFFIX}`,
            `${key}:previous-day`,
            `${key}:hour-ago`,
            ...Array.from({ length: RECOVERY_SLOT_COUNT }, (_, index) => `${key}${SLOT_SUFFIX}${index}`),
            ...Array.from({ length: TEMPORAL_SLOT_COUNT }, (_, index) => `${key}:timeline:${index}`),
          );
        }
        [...new Set(keys)].forEach(candidate => localStorage.removeItem(candidate));
      }
      await deleteRecoveryDatabase(indexedDB);
      currentRevision = 0;
      currentSavedAt = 0;
      currentGeneration = 0;
      pendingGenerationAdvance = false;
      return true;
    },

    get revision() {
      return currentRevision;
    },

    get savedAt() {
      return currentSavedAt;
    },

    get generation() {
      return currentGeneration;
    },
  };
}
