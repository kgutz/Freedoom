import { describe, expect, it, vi } from 'vitest';
import {
  createCalendarModel,
  createDayEditorModel,
  createWeeksModel,
  renderWeeksView,
} from './calendar-view.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
};

describe('modelo del calendario', () => {
  it('solo muestra en el editor los registros activados por el usuario', () => {
    expect(
      createDayEditorModel({
        config: {
          ...config,
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          takesPills: false,
          pillsGoal: 0,
          tracksBeer: false,
        },
        date: new Date(2026, 7, 8),
      }),
    ).toEqual({
      showCigarettes: true,
      showSmokeFreeStatus: false,
      showPills: false,
      showBeers: false,
    });

    expect(
      createDayEditorModel({
        config: {
          ...config,
          journeyMode: 'smoke_free',
          takesPills: true,
          pillsGoal: 3,
          tracksBeer: true,
        },
        date: new Date(2026, 7, 8),
      }),
    ).toEqual({
      showCigarettes: false,
      showSmokeFreeStatus: true,
      showPills: true,
      showBeers: true,
    });
  });

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

  it('combina correctamente una semana cuyo camino cambia hoy', () => {
    const mixedConfig = {
      ...config,
      startDate: '2026-08-02',
      journeyMode: 'controlled',
      journeyOriginMode: 'smoke_free',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 5,
      journeyTransitions: [
        {
          effectiveDate: '2026-08-08',
          journeyMode: 'controlled',
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 5,
        },
      ],
    };
    const model = createWeeksModel({
      now: new Date(2026, 7, 8, 20),
      config: mixedConfig,
      days: {
        '2026-08-03': { sf: 'success' },
        '2026-08-04': { sf: 'success' },
        '2026-08-05': { sf: 'success' },
        '2026-08-06': { sf: 'success' },
        '2026-08-07': { sf: 'success' },
        '2026-08-08': { c: 1 },
      },
    });

    expect(model.weeks[0]).toMatchObject({
      controlledMode: true,
      smokeFreeMode: false,
      controlledCompliantDays: 6,
      controlledWeekUsed: 1,
      controlledBudgetExceeded: false,
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
      index: 1,
      total: 30,
      daysOverLimit: 1,
      statusClass: 'curr',
    });
  });

  it('abre directamente la gráfica de la semana pulsada', () => {
    const rows = [];
    const list = {
      innerHTML: '',
      appendChild: (element) => rows.push(element),
    };
    const document = {
      getElementById: () => list,
      createElement: (tagName) => ({
        tagName,
        dataset: {},
        setAttribute: vi.fn(),
        addEventListener(name, listener) {
          this[name] = listener;
        },
      }),
    };
    const onWeekClick = vi.fn();

    renderWeeksView({
      document,
      now: new Date(2026, 6, 26, 12),
      config,
      days: {},
      onWeekClick,
    });

    expect(rows[0].tagName).toBe('button');
    expect(rows[0].dataset.weekIndex).toBe('0');
    rows[0].click();
    expect(onWeekClick).toHaveBeenCalledWith(0);
  });
});
