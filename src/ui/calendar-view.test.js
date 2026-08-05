import { describe, expect, it } from 'vitest';
import {
  createCalendarModel,
  createWeeksModel,
} from './calendar-view.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
};

describe('modelo del calendario', () => {
  it('muestra cada fecha con el camino que tenía al registrarse', () => {
    const transitionedConfig = {
      ...config,
      journeyMode: 'controlled',
      journeyOriginMode: 'smoke_free',
      journeyTransitions: [
        {
          effectiveDate: '2026-07-24',
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 3,
        },
      ],
    };
    const model = createCalendarModel({
      cursor: new Date(2026, 6, 1),
      now: new Date(2026, 6, 25, 12),
      config: transitionedConfig,
      days: {
        '2026-07-23': { sf: 'success' },
        '2026-07-24': { c: 1 },
      },
    });

    expect(model.entries.find((entry) => entry.day === 23)).toMatchObject({
      smokeFreeMode: true,
      controlledMode: false,
    });
    expect(model.entries.find((entry) => entry.day === 24)).toMatchObject({
      smokeFreeMode: false,
      controlledMode: true,
      controlledAllowed: true,
    });
  });

  it('representa los tres estados del camino sin fumar', () => {
    const model = createCalendarModel({
      cursor: new Date(2026, 6, 1),
      now: new Date(2026, 6, 19, 12),
      config: { ...config, journeyMode: 'smoke_free' },
      days: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'smoked' },
      },
    });

    expect(model.smokeFreeMode).toBe(true);
    expect(model.entries.find((entry) => entry.day === 17).smokeFreeStatus).toBe('success');
    expect(model.entries.find((entry) => entry.day === 18).smokeFreeStatus).toBe('smoked');
    expect(model.entries.find((entry) => entry.day === 19).smokeFreeStatus).toBe('pending');
  });
  it('coloca correctamente un mes y marca hoy, futuro y exceso', () => {
    const model = createCalendarModel({
      cursor: new Date(2026, 6, 1),
      now: new Date(2026, 6, 26, 12),
      config,
      days: {
        '2026-07-25': { c: 20, p: 2, b: 1 },
      },
    });
    const day25 = model.entries.find((entry) => entry.day === 25);
    const day26 = model.entries.find((entry) => entry.day === 26);
    const day27 = model.entries.find((entry) => entry.day === 27);

    expect(model.title).toBe('julio 2026');
    expect(model.offset).toBe(2);
    expect(day25).toMatchObject({
      cigarettes: 20,
      pills: 2,
      beers: 1,
      overLimit: true,
      isFuture: false,
    });
    expect(day26.isToday).toBe(true);
    expect(day27.isFuture).toBe(true);
  });
});

describe('modelo de semanas', () => {
  it('conserva el tipo de cada semana después de cambiar de camino', () => {
    const transitionedConfig = {
      ...config,
      journeyMode: 'controlled',
      journeyOriginMode: 'smoke_free',
      journeyTransitions: [
        {
          effectiveDate: '2026-07-24',
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 3,
        },
      ],
    };
    const model = createWeeksModel({
      now: new Date(2026, 6, 25, 12),
      config: transitionedConfig,
      days: {},
    });
    expect(model.weeks[0]).toMatchObject({
      smokeFreeMode: true,
      controlledMode: false,
    });
    expect(model.weeks[1]).toMatchObject({
      smokeFreeMode: false,
      controlledMode: true,
    });
  });

  it('resume totales y días superados sin contar fechas futuras', () => {
    const model = createWeeksModel({
      now: new Date(2026, 6, 26, 12),
      config,
      days: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 21 },
        '2026-07-24': { c: 10 },
        '2026-07-25': { c: 20 },
      },
    });

    expect(model.weeks).toHaveLength(2);
    expect(model.weeks[0]).toMatchObject({
      total: 41,
      daysOverLimit: 1,
      statusClass: 'bad',
    });
    expect(model.weeks[1]).toMatchObject({
      total: 30,
      daysOverLimit: 1,
      statusClass: 'curr',
    });
  });
});
