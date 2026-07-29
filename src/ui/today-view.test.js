import { describe, expect, it } from 'vitest';
import { createPaceModel, createTodayModel } from './today-view.js';

const config = {
  startDate: '2026-07-17',
  startLimit: 20,
  wakeTime: '07:00',
  sleepTime: '23:00',
  takesPills: true,
  tracksBeer: true,
};

describe('barra de ritmo', () => {
  it('considera correcto empezar el día a las 7:01 sin cigarrillos', () => {
    const pace = createPaceModel({
      now: new Date(2026, 6, 26, 7, 1),
      smoked: 0,
      limit: 19,
      config,
      record: { c: 0, p: 0 },
    });

    expect(pace.statusClass).toBe('g');
    expect(pace.status).toBe('Vas bien');
  });

  it('distingue antes de levantarse y límite superado', () => {
    expect(
      createPaceModel({
        now: new Date(2026, 6, 26, 6, 59),
        smoked: 1,
        limit: 19,
        config,
        record: { c: 1 },
      }),
    ).toMatchObject({ statusClass: 'o', status: 'Antes de hora' });
    expect(
      createPaceModel({
        now: new Date(2026, 6, 26, 20),
        smoked: 20,
        limit: 19,
        config,
        record: { c: 20 },
      }),
    ).toMatchObject({ statusClass: 'r', status: 'Límite superado' });
  });

  it('mantiene el ritmo del día anterior durante la madrugada', () => {
    const pace = createPaceModel({
      now: new Date(2026, 6, 27, 1, 0),
      smoked: 5,
      limit: 19,
      config: { ...config, dayStartTime: '04:00' },
      record: { c: 5, w: '08:15' },
    });

    expect(pace.status).toBe('Vas bien');
  });
});

describe('modelo de Hoy', () => {
  it('combina contadores, semana y estado del héroe', () => {
    const model = createTodayModel({
      now: new Date(2026, 6, 26, 12),
      config,
      days: {
        '2026-07-26': { c: 5, p: 2, b: 1 },
      },
      game: { cls: 'paladin', name: 'Kike', hp: 75 },
      stats: { maxHp: 100 },
      intoxication: { level: 45, remainingMinutes: 52 },
    });

    expect(model).toMatchObject({
      weekNumber: 2,
      limit: 19,
      remaining: 14,
      frameCount: 19,
      hero: {
        name: 'Kike',
        className: 'Paladin',
        hpClass: 'hp-hi',
      },
      intoxication: { level: 45, remainingMinutes: 52 },
    });
  });

  it('usa la fecha lógica y el despertar guardado para ese día', () => {
    const model = createTodayModel({
      now: new Date(2026, 6, 27, 1, 0),
      currentDate: new Date(2026, 6, 26, 1, 0),
      config: { ...config, dayStartTime: '04:00' },
      days: {
        '2026-07-26': { c: 5, p: 1, w: '08:15', we: 1 },
        '2026-07-27': { c: 0, p: 0 },
      },
      game: null,
      stats: null,
      intoxication: null,
    });

    expect(model.record.c).toBe(5);
    expect(model.wakeTime).toBe('08:15');
    expect(model.wakeEstimated).toBe(true);
    expect(model.dateLabel).toContain('26/Jul');
  });
});
