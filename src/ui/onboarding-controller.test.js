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
