import { describe, expect, it } from 'vitest';
import { createOnboardingResult } from './onboarding-controller.js';

describe('resultado del onboarding', () => {
  it('construye configuración y héroe con los valores introducidos', () => {
    expect(
      createOnboardingResult({
        startDate: '2026-07-26',
        startLimit: '18',
        wakeTime: '07:00',
        sleepTime: '23:30',
        dayStartTime: '04:30',
        takesPills: true,
        pillsGoal: '2',
        tracksBeer: false,
        classId: 'paladin',
        heroName: ' Kike ',
      }),
    ).toEqual({
      config: {
        journeyMode: 'reduction',
        startDate: '2026-07-26',
        startLimit: 18,
        wakeTime: '07:00',
        sleepTime: '23:30',
        dayStartTime: '04:30',
        takesPills: true,
        pillsGoal: 2,
        tracksBeer: false,
      },
      game: { cls: 'paladin', name: 'Kike' },
      onboarded: true,
    });
  });

  it('crea una campaña sin fumar sin depender del contador inicial', () => {
    const result = createOnboardingResult({
      startDate: '2026-08-01',
      startLimit: '7',
      takesPills: false,
      tracksBeer: true,
      classId: 'druid',
      heroName: 'Broto',
      journeyMode: 'smoke_free',
    });

    expect(result.config).toMatchObject({
      journeyMode: 'smoke_free',
      startDate: '2026-08-01',
      startLimit: 21,
    });
  });

  it('crea un camino de consumo controlado con bolsa semanal', () => {
    const result = createOnboardingResult({
      startDate: '2026-08-03',
      startLimit: '20',
      takesPills: false,
      tracksBeer: false,
      classId: 'knight',
      heroName: 'Bran',
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: '3',
    });

    expect(result.config).toMatchObject({
      journeyMode: 'controlled',
      startLimit: 21,
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    });
  });

  it('desactiva la meta de pastillas y usa nombres predeterminados seguros', () => {
    const result = createOnboardingResult({
      startDate: '2026-07-26',
      startLimit: '',
      wakeTime: '',
      sleepTime: '',
      dayStartTime: '',
      takesPills: false,
      pillsGoal: '9',
      tracksBeer: true,
      classId: 'desconocida',
      heroName: ' ',
    });

    expect(result.config).toMatchObject({
      startLimit: 20,
      wakeTime: '09:00',
      sleepTime: '23:00',
      dayStartTime: '04:00',
      pillsGoal: 0,
    });
    expect(result.game).toEqual({ cls: 'knight', name: 'Caballero' });
  });
});
