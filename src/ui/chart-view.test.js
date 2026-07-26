import { describe, expect, it } from 'vitest';
import { createChartModel } from './chart-view.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
};

describe('modelo de gráficas', () => {
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
});
