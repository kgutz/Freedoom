import { describe, expect, it } from 'vitest';
import { createSettingsModel } from './settings-view.js';

describe('modelo de ajustes', () => {
  it('refleja configuración y nombre del héroe', () => {
    expect(
      createSettingsModel({
        config: {
          startDate: '2026-07-17',
          startLimit: 20,
          wakeTime: '07:00',
          sleepTime: '23:30',
          dayStartTime: '04:30',
          pillsGoal: 2,
          tracksBeer: false,
        },
        game: { name: 'Kike' },
      }),
    ).toEqual({
      startDate: '2026-07-17',
      startLimit: 20,
      wakeTime: '07:00',
      sleepTime: '23:30',
      dayStartTime: '04:30',
      pillsGoal: 2,
      heroName: 'Kike',
      tracksBeer: false,
      smokeFreeMode: false,
    });
  });
});
