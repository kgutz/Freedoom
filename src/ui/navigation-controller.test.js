import { describe, expect, it } from 'vitest';
import { VIEW_BY_NAVIGATION } from './navigation-controller.js';

describe('mapa de navegación', () => {
  it('mantiene cada botón asociado a su pantalla', () => {
    expect(VIEW_BY_NAVIGATION).toEqual({
      navHoy: 'view-hoy',
      navHero: 'view-hero',
      navCal: 'view-cal',
      navGraf: 'view-graf',
    });
  });
});
