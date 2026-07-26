import { describe, expect, it } from 'vitest';
import { keyOf } from './date-utils.js';
import {
  limitForDate,
  limitForWeek,
  weekIndexFor,
  weekRangeFor,
} from './plan-rules.js';

describe('plan semanal', () => {
  it('empieza la semana en la fecha elegida, aunque no sea lunes', () => {
    const start = '2026-07-17';

    expect(weekIndexFor(start, new Date(2026, 6, 17))).toBe(0);
    expect(weekIndexFor(start, new Date(2026, 6, 23))).toBe(0);
    expect(weekIndexFor(start, new Date(2026, 6, 24))).toBe(1);
  });

  it('crea rangos consecutivos de siete días', () => {
    const [first, last] = weekRangeFor('2026-07-17', 2);

    expect(keyOf(first)).toBe('2026-07-31');
    expect(keyOf(last)).toBe('2026-08-06');
  });

  it('reduce el límite semanal sin bajar de cero', () => {
    expect(limitForWeek(20, 3)).toBe(17);
    expect(limitForWeek(20, 25)).toBe(0);
    expect(
      limitForDate({
        startDate: '2026-07-17',
        startLimit: 20,
        date: new Date(2026, 6, 25),
      }),
    ).toBe(19);
  });
});
