import { describe, expect, it } from 'vitest';
import { passwordStrength, passwordValidation } from './auth-preview-controller.js';

describe('pantallas de cuenta', () => {
  it('calcula la fortaleza sin almacenar ni transformar la contraseña', () => {
    expect(passwordStrength('corta')).toBe(0);
    expect(passwordStrength('Freedom2026!')).toBe(4);
  });

  it('exige longitud, variedad y confirmación coincidente', () => {
    expect(passwordValidation('Corta1!', 'Corta1!')).toContain('10 caracteres');
    expect(passwordValidation('solamentetexto', 'solamentetexto')).toContain('Combina');
    expect(passwordValidation('Freedom2026!', 'Freedom2026?')).toContain('no coinciden');
    expect(passwordValidation('Freedom2026!', 'Freedom2026!')).toBe('');
  });
});
