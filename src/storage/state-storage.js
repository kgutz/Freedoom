export const STORAGE_KEY = 'registro-dejar-fumar';
export const STORAGE_SCHEMA_VERSION = 2;
export const RECOVERY_SLOT_COUNT = 3;
export const ACTION_LOG_LIMIT = 50;

const META_SUFFIX = ':meta';
const SLOT_SUFFIX = ':recovery:';
const ACTION_SUFFIX = ':actions';
const DATABASE_NAME = 'freedoom-recovery';
const DATABASE_STORE = 'snapshots';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    };
  }
  if (savedState.onboarded === true) nextState.onboarded = true;

  return nextState;
}

export function exportBackup(state) {
  return serializeState(state);
}

export function importBackup(currentState, backupText) {
  const savedState = parseState(backupText);
  if (!isObject(savedState.days) && !isObject(savedState.config)) {
    throw new Error('Formato de copia no válido');
  }

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

export function createStateEnvelope(state, revision, savedAt = Date.now()) {
  const value = serializeState(state);
  return {
    format: 'freedoom-state',
    schemaVersion: STORAGE_SCHEMA_VERSION,
    revision: Math.max(1, Math.trunc(Number(revision) || 1)),
    savedAt: Math.max(0, Math.trunc(Number(savedAt) || Date.now())),
    checksum: checksumOf(value),
    state,
  };
}

export function parseStateEnvelope(serialized) {
  const envelope = JSON.parse(serialized);
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
  return envelope;
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
  return candidates;
}

function newestCandidate(candidates) {
  const priorities = { main: 3, indexeddb: 1 };
  return [...candidates].sort((left, right) => {
    if (right.revision !== left.revision) return right.revision - left.revision;
    if (right.savedAt !== left.savedAt) return right.savedAt - left.savedAt;
    return (priorities[right.source] || 2) - (priorities[left.source] || 2);
  })[0] || null;
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
      const previous = unique.get(candidate.revision);
      if (!previous || candidate.savedAt > previous.savedAt) {
        unique.set(candidate.revision, candidate);
      }
    });
    return [...unique.values()].sort(
      (left, right) => right.revision - left.revision,
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
      const main = candidates.find((candidate) => candidate.source === 'main');
      const recovered = selected.source !== 'main' && (
        !main || selected.revision > main.revision ||
        checksumOf(serializeState(selected.state)) !== main.checksum
      );
      return {
        key,
        value: serializeState(selected.state),
        revision: currentRevision,
        savedAt: currentSavedAt,
        recovered,
        source: selected.source,
      };
    },

    set(key, value) {
      if (usesExternalStorage) return externalStorage.set(key, value);
      if (!localStorage) throw new Error('Almacenamiento local no disponible');
      const parsedState = parseState(value);
      const revision = currentRevision + 1;
      const savedAt = Date.now();
      const envelope = createStateEnvelope(parsedState, revision, savedAt);
      const envelopeText = JSON.stringify(envelope);
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
            checksum: checksumOf(value),
          }),
        );
        mainSaved = true;
      } catch (error) {
        mainError = error;
      }

      if (!recoverySaved && !mainSaved) {
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
        verified: mainSaved,
        recoverySaved,
        degraded: !mainSaved || !recoverySaved,
        errors: [mainError, recoveryError].filter(Boolean),
        mirrorPromise,
      };
    },

    async listRecoveries(key = STORAGE_KEY) {
      return recoveryList(key);
    },

    async recoveryState(revision, key = STORAGE_KEY) {
      const candidates = await recoveryList(key);
      return candidates.find((candidate) => candidate.revision === revision)?.state || null;
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
      actions.push({ ...action, at: action.at || Date.now() });
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

    get revision() {
      return currentRevision;
    },

    get savedAt() {
      return currentSavedAt;
    },
  };
}
