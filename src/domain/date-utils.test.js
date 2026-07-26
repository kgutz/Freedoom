import { describe, expect, it } from 'vitest';
import {
  daysBetween,
  keyOf,
  minutesOf,
  parseKey,
  todayKey
} from './date-utils.js';

describe('date-utils', () => {
  it('convierte fechas locales a claves estables', () => {
    expect(keyOf(new Date(2026, 6, 26))).toBe('2026-07-26');
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('recupera una fecha local desde su clave', () => {
    const date = parseKey('2026-07-26');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6);
    expect(date.getDate()).toBe(26);
  });

  it('cuenta días naturales sin depender de cambios horarios', () => {
    expect(daysBetween(new Date(2026, 2, 28), new Date(2026, 2, 29))).toBe(1);
    expect(daysBetween(new Date(2026, 2, 29), new Date(2026, 2, 30))).toBe(1);
    expect(daysBetween(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2);
  });

  it('convierte una hora a minutos desde medianoche', () => {
    expect(minutesOf('07:01')).toBe(421);
    expect(minutesOf('23:45')).toBe(1425);
  });
});
