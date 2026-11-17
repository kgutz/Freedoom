/* Retirada de la nube: el juego deja de usar cuentas de Google y Supabase. Cada jugador conserva su última
   partida en este navegador; una sola vez se trae la de su cuenta (si es más reciente), se cierra la sesión
   y se marca el navegador como "retirado" para que no vuelva a aparecer ninguna pantalla de acceso. */

export const CLOUD_RETIRED_KEY = 'freedom:cloud-retired:v1';
const AUTH_STORAGE_PREFIX = 'freedom-auth';

/* Retirement must not trust a fulfilled storage promise alone: the store can
   preserve an older recovery copy while returning blocked/degraded. Verify the
   exact current state in the primary browser slot before discarding any auth. */
export async function verifyLocalCopyBeforeRetirement({ store, storage, key, value }) {
  const saved = await store.set(key, value);
  if (saved?.blocked || saved?.verified !== true || storage.getItem(key) !== value) {
    throw new Error('No se pudo verificar tu partida en este navegador. No se ha desvinculado la cuenta. Exporta una copia y vuelve a intentarlo.');
  }
  return saved;
}

export function isCloudRetired(storage) {
  try {
    return storage?.getItem(CLOUD_RETIRED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markCloudRetired(storage) {
  try {
    storage?.setItem(CLOUD_RETIRED_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/* Borra la sesión y el verificador de Google que guarda Supabase (`freedom-auth…`). No toca la partida. */
export function clearCloudAuthTokens(storage) {
  let removed = 0;
  try {
    const keys = [];
    for (let index = 0; index < (storage?.length || 0); index += 1) {
      const key = storage.key(index);
      if (typeof key === 'string' && key.startsWith(AUTH_STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => { storage.removeItem(key); removed += 1; });
  } catch {
    /* almacenamiento bloqueado: no hay nada que limpiar */
  }
  return removed;
}

/* Qué hacer al arrancar en modo retirada, sin pantallas de acceso para quien ya jugó aquí:
   - retired: este navegador ya está desvinculado → solo local.
   - adopt-cloud: hay sesión → se compara con la partida local, se conserva la más reciente y se retira.
   - retire-local: sin sesión pero con partida en este navegador → se retira y se sigue con esa partida.
   - offer-recovery: navegador sin partida ni sesión → ofrecer recuperar con Google o empezar de nuevo. */
export function retirementPlan({ retirement, retired, hasSession, hasLocalGame }) {
  if (!retirement) return 'legacy';
  if (retired) return 'retired';
  if (hasSession) return 'adopt-cloud';
  return hasLocalGame ? 'retire-local' : 'offer-recovery';
}
