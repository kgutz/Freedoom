import { describe, expect, it } from 'vitest';
import {
  logicalDayDate,
  logicalDayKey,
  logicalClockMinutes,
  logicalTimeMinutes,
  timestampForLogicalDayTime,
} from './day-boundary-rules.js';

describe('día lógico configurable', () => {
  it('mantiene la madrugada dentro del día anterior', () => {
    const now = new Date(2026, 6, 30, 1, 15);

    expect(logicalDayKey(now, '04:00')).toBe('2026-07-29');
    expect(logicalDayDate(now, '04:00').getDate()).toBe(29);
    expect(logicalTimeMinutes(now, '04:00')).toBe(1515);
  });

  it('empieza el nuevo día al alcanzar la hora de cambio', () => {
    expect(logicalDayKey(new Date(2026, 6, 30, 3, 59), '04:00')).toBe(
      '2026-07-29',
    );
    expect(logicalDayKey(new Date(2026, 6, 30, 4, 0), '04:00')).toBe(
      '2026-07-30',
    );
  });

  it('sitúa una hora de madrugada al final del día lógico', () => {
    const timestamp = timestampForLogicalDayTime({
      dayKey: '2026-07-29',
      time: '01:10',
      dayStartTime: '04:00',
    });
    const result = new Date(timestamp);

    expect(result.getDate()).toBe(30);
    expect(result.getHours()).toBe(1);
    expect(result.getMinutes()).toBe(10);
    expect(logicalClockMinutes(60, '04:00')).toBe(1500);
  });
});
