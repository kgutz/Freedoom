import { describe, expect, it, vi } from 'vitest';
import {
  RECOVERY_MODE_TAP_COUNT,
  createRecoveryModeController,
} from './recovery-mode-controller.js';

function clickableLogo() {
  const listeners = new Map();
  return {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    click: () => listeners.get('click')?.({ type: 'click' }),
  };
}

describe('modo de recuperación de emergencia', () => {
  it('permanece oculto durante seis taps y se activa exactamente en el séptimo', () => {
    const logo = clickableLogo();
    const emergencySection = { hidden: false };
    const showToast = vi.fn();
    const controller = createRecoveryModeController({ logo, emergencySection, showToast });

    expect(emergencySection.hidden).toBe(true);
    for (let index = 0; index < RECOVERY_MODE_TAP_COUNT - 1; index += 1) logo.click();
    expect(controller.isActive()).toBe(false);
    expect(emergencySection.hidden).toBe(true);
    expect(showToast).not.toHaveBeenCalled();

    logo.click();
    expect(controller.isActive()).toBe(true);
    expect(emergencySection.hidden).toBe(false);
    expect(showToast).toHaveBeenCalledOnce();
    expect(showToast).toHaveBeenCalledWith('Modo de recuperación activado', 'heal');
  });

  it('no añade pistas al logo y una nueva sesión vuelve a estar desactivada', () => {
    const logo = clickableLogo();
    const originalKeys = Object.keys(logo).sort();
    const emergencySection = { hidden: false };
    const gameState = { config: { startLimit: 20 }, forge: { seed: 'save-seed' } };
    const serializedBefore = JSON.stringify(gameState);
    const first = createRecoveryModeController({ logo, emergencySection, showToast: vi.fn() });
    for (let index = 0; index < RECOVERY_MODE_TAP_COUNT; index += 1) logo.click();
    expect(first.isActive()).toBe(true);
    first.destroy();

    const nextSession = createRecoveryModeController({
      logo,
      emergencySection,
      showToast: vi.fn(),
    });
    expect(nextSession.isActive()).toBe(false);
    expect(emergencySection.hidden).toBe(true);
    expect(Object.keys(logo).sort()).toEqual(originalKeys);
    expect(JSON.stringify(gameState)).toBe(serializedBefore);
    expect(serializedBefore).not.toContain('recoveryMode');
  });

});
