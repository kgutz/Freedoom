import { describe, expect, it } from 'vitest';
import { setTextWithResourceIcons } from './resource-icons.js';

describe('iconos de recursos', () => {
  it('convierte oro, fibra y sangre en los iconos visuales compartidos', () => {
    const element = { textContent: '', innerHTML: '' };
    Object.defineProperty(element, 'textContent', {
      get() { return this.innerHTML; },
      set(value) { this.innerHTML = String(value); },
    });

    setTextWithResourceIcons(element, '🪙 14 · 🧵 1 · 🩸 1');

    expect(element.innerHTML).toContain('resource-icon--coin');
    expect(element.innerHTML).toContain('resource-icon--arcane-fiber');
    expect(element.innerHTML).toContain('resource-icon--boss-blood');
    expect(element.innerHTML).not.toMatch(/[🪙🧵🩸]/u);
  });
});
