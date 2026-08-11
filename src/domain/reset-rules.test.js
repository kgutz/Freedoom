import { describe, expect, it } from 'vitest';
import {
  RESET_CONFIRMATION_PHRASE,
  matchesResetConfirmation,
} from './reset-rules.js';

describe('confirmación reforzada del reinicio', () => {
  it('solo acepta la frase completa', () => {
    expect(matchesResetConfirmation(RESET_CONFIRMATION_PHRASE)).toBe(true);
    expect(matchesResetConfirmation('reiniciar sesión')).toBe(true);
    expect(matchesResetConfirmation('  REINICIAR SESIÓN  ')).toBe(true);
    expect(matchesResetConfirmation('reiniciar')).toBe(false);
    expect(matchesResetConfirmation('cerrar sesión')).toBe(false);
    expect(matchesResetConfirmation('')).toBe(false);
  });
});
