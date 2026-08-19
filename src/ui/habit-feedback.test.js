import { describe, expect, it } from 'vitest';
import { habitRewardToast } from './habit-feedback.js';

describe('resumen de recompensas de hábitos', () => {
  it('muestra únicamente los totales de XP y oro', () => {
    expect(habitRewardToast('Hábito completado', { xpDelta: 21, coinDelta: 7 }))
      .toBe('Hábito completado · +21 XP · +7 🪙');
  });

  it('resume también las correcciones con cantidades negativas', () => {
    expect(habitRewardToast('Progreso corregido', { xpDelta: -6, coinDelta: -3 }))
      .toBe('Progreso corregido · -6 XP · -3 🪙');
  });

  it('conserva el mensaje inicial cuando no cambia ninguna recompensa', () => {
    expect(habitRewardToast('Límite de recompensas alcanzado')).toBe('Límite de recompensas alcanzado');
  });
});
