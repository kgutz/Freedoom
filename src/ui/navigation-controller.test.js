import { describe, expect, it, vi } from 'vitest';
import { resetSheetScroll, showSheet, VIEW_BY_NAVIGATION } from './navigation-controller.js';

describe('mapa de navegación', () => {
  it('mantiene cada botón asociado a su pantalla', () => {
    expect(VIEW_BY_NAVIGATION).toEqual({
      navHoy: 'view-hoy',
      navHabits: 'view-habits',
      navHero: 'view-hero',
      navCal: 'view-cal',
    });
  });

  it('reinicia el panel y sus cuerpos desplazables antes de mostrar una hoja', () => {
    const inner = { scrollTop: 87 };
    const panel = {
      scrollTop: 142,
      querySelectorAll: () => [inner],
    };
    const sheet = {
      querySelector: () => panel,
      classList: { add: vi.fn() },
    };
    const document = { getElementById: () => sheet };

    showSheet(document, 'sheetRelicDetail');

    expect(panel.scrollTop).toBe(0);
    expect(inner.scrollTop).toBe(0);
    expect(sheet.classList.add).toHaveBeenCalledWith('show');
  });

  it('tolera hojas sin panel interior', () => {
    expect(() => resetSheetScroll({ querySelector: () => null })).not.toThrow();
  });
});
