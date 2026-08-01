export const STORAGE_KEY = 'registro-dejar-fumar';

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

export function createBrowserStore(browserWindow) {
  const externalStorage = browserWindow.storage;
  const localStorage = browserWindow.localStorage;
  const usesExternalStorage = Boolean(
    externalStorage?.get && externalStorage?.set,
  );

  return {
    usesExternalStorage,

    async get(key) {
      if (usesExternalStorage) return externalStorage.get(key);
      const value = localStorage.getItem(key);
      return value !== null ? { key, value } : null;
    },

    set(key, value) {
      if (usesExternalStorage) return externalStorage.set(key, value);
      localStorage.setItem(key, value);
      return { key, value };
    },
  };
}
