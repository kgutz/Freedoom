export const RESET_CONFIRMATION_PHRASE = 'REINICIAR SESIÓN';

export function matchesResetConfirmation(value) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('es-ES') === RESET_CONFIRMATION_PHRASE;
}
