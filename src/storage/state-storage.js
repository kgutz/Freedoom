export const STORAGE_KEY = 'registro-dejar-fumar';
export const STORAGE_SCHEMA_VERSION = 2;
export const RECOVERY_SLOT_COUNT = 3;
export const ACTION_LOG_LIMIT = 50;

const META_SUFFIX = ':meta';
const SLOT_SUFFIX = ':recovery:';
const ACTION_SUFFIX = ':actions';
const DAILY_SUFFIX = ':daily';
const WEEKLY_SUFFIX = ':weekly';
const LAST_INFO_SUFFIX = ':last-info';
const DATABASE_NAME = 'freedoom-recovery';
const DATABASE_STORE = 'snapshots';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  const bossesDown = Math.max(0, Number(combat.legacyBossesDown) || 0) +
    Math.max(0, Number(combat.defeated) || 0);
  const bossHistoryCount = Array.isArray(combat.history)
    ? combat.history.length
    : 0;
  const hasHero = typeof game.cls === 'string' && game.cls.length > 0;
  const onboarded = safeState.onboarded === true;
  const score =
    (onboarded ? 40 : 0) +
    (hasHero ? 80 : 0) +
    Math.min(240, dayCount * 4) +
    Math.min(120, habitCount * 15) +
    Math.min(120, habitEntryCount * 3) +
    Math.min(180, bossesDown * 40) +
    Math.min(80, bossHistoryCount * 10);

  return {
    score,
    onboarded,
    hasHero,
    dayCount,
    habitCount,
    habitEntryCount,
    bossesDown,
    bossHistoryCount,
    meaningful:
      (onboarded && hasHero) ||
      dayCount > 0 ||
      habitCount > 0 ||
      habitEntryCount > 0 ||
      bossesDown > 0,
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
  const scoreCollapsed =
    reference.score >= 120 && candidate.score <= reference.score * 0.35;

  return scoreCollapsed ||
    (daysCollapsed && (habitsCollapsed || bossesCollapsed || candidate.score < 120));
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
    localStorage.setItem(storageKey, JSON.stringify(protectedEnvelope));
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
    localStorage.setItem(storageKey, JSON.stringify(protectedEnvelope));
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

    get generation() {
      return currentGeneration;
    },
  };
}
