import { describe, expect, it } from 'vitest';
import { keyOf } from '../domain/date-utils.js';
import { createChartModel } from './chart-view.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
};

describe('modelo de gráficas', () => {
  it('abre gráficas semanales con el camino histórico correcto', () => {
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
    const oldWeek = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 25, 12),
      config: transitionedConfig,
      records: {},
    });
    const newWeek = createChartModel({
      mode: 'semana',
      weekIndex: 1,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 25, 12),
      config: transitionedConfig,
      records: {},
    });
    expect(oldWeek.smokeFreeMode).toBe(true);
    expect(newWeek.controlledMode).toBe(true);
  });

  it('resume confirmados, fumados y pendientes sin usar cigarros', () => {
    const model = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 19, 12),
      config: { ...config, journeyMode: 'smoke_free' },
      records: {
        '2026-07-17': { sf: 'success' },
        '2026-07-18': { sf: 'smoked' },
      },
    });

    expect(model).toMatchObject({
      smokeFreeMode: true,
      smokeFreeDays: 1,
      smokedDays: 1,
      pendingDays: 1,
      successRate: 50,
    });
  });
  it('resume una semana usando solo días vividos dentro del plan', () => {
    const model = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 19, 12),
      config,
      records: {
        '2026-07-17': { c: 20 },
        '2026-07-18': { c: 10 },
        '2026-07-19': { c: 15 },
        '2026-07-20': { c: 99 },
      },
    });

    expect(model.title).toBe('Semana 1 · 17 jul – 23 jul');
    expect(model.peak.cigarettes).toBe(20);
    expect(model.minimum.cigarettes).toBe(10);
    expect(model.average).toBe(15);
    expect(model.points.find((point) => point.cigarettes === 99).tracked).toBe(
      false,
    );
  });

  it('calcula el mínimo solo con días anteriores ya cerrados', () => {
    const model = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 19, 12),
      config,
      records: {
        '2026-07-17': { c: 12 },
        '2026-07-18': { c: 8 },
        '2026-07-19': { c: 1 },
      },
    });

    expect(model.minimum.cigarettes).toBe(8);
    expect(model.minimum.isToday).toBe(false);
  });

  it('genera todos los días de un mes y una escala suficiente', () => {
    const model = createChartModel({
      mode: 'mes',
      weekIndex: 0,
      month: new Date(2026, 6, 1),
      now: new Date(2026, 6, 31, 12),
      config,
      records: {
        '2026-07-25': { c: 30 },
      },
    });

    expect(model.points).toHaveLength(31);
    expect(model.title).toBe('julio 2026');
    expect(model.yMax).toBeGreaterThan(30);
  });

  it('cierra en verde un día permitido sin consumo y mantiene hoy en curso', () => {
    const controlledConfig = {
      startDate: '2026-08-02',
      startLimit: 21,
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 5,
    };
    const model = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 7, 1),
      now: new Date(2026, 7, 8, 12),
      config: controlledConfig,
      records: {
        '2026-08-02': { c: 2 },
        '2026-08-07': { c: 0 },
        '2026-08-08': { c: 1 },
      },
    });

    expect(model.points.find((point) => keyOf(point.date) === '2026-08-07')).toMatchObject({
      controlledAllowed: true,
      settled: true,
      cigarettes: 0,
    });
    expect(model.points.find((point) => keyOf(point.date) === '2026-08-08')).toMatchObject({
      controlledAllowed: true,
      isToday: true,
      settled: false,
      cigarettes: 1,
    });
    expect(model.completedDays).toBe(2);
  });

  it('marca como fallidos todos los días permitidos cuando se supera el máximo semanal', () => {
    const model = createChartModel({
      mode: 'semana',
      weekIndex: 0,
      month: new Date(2026, 7, 1),
      now: new Date(2026, 7, 8, 12),
      config: {
        startDate: '2026-08-02',
        startLimit: 21,
        journeyMode: 'controlled',
        controlledDays: [5, 6, 0],
        controlledWeeklyLimit: 5,
      },
      records: {
        '2026-08-02': { c: 2 },
        '2026-08-07': { c: 3 },
        '2026-08-08': { c: 1 },
      },
    });

    const allowedPoints = model.points.filter(
      (point) => point.tracked && point.controlledAllowed,
    );
    expect(allowedPoints).toHaveLength(3);
    expect(allowedPoints.every((point) => point.controlledBudgetExceeded)).toBe(true);
    expect(model.completedDays).toBe(0);
    expect(model.failedDays).toBe(3);
  });
});
