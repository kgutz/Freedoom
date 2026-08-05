import { describe, expect, it } from 'vitest';
import {
  JOURNEY_MODE_REDUCTION,
  JOURNEY_MODE_SMOKE_FREE,
  JOURNEY_MODE_CONTROLLED,
  SMOKE_FREE_STATUS_PENDING,
  bossCountForJourney,
  journeyEvolutionUnlocked,
  normalizeJourneyMode,
  smokeFreeStatusOf,
  controlledDaysOf,
  controlledWeeklyLimitOf,
  isControlledSmokingDay,
  journeyConfigForDate,
  journeyModeForDate,
  applyDueJourneyTransition,
  scheduleControlledJourneyTransition,
} from './journey-mode-rules.js';

describe('modos del viaje', () => {
  it('mantiene reducción como modo compatible por defecto', () => {
    expect(normalizeJourneyMode()).toBe(JOURNEY_MODE_REDUCTION);
    expect(normalizeJourneyMode('otro')).toBe(JOURNEY_MODE_REDUCTION);
    expect(normalizeJourneyMode(JOURNEY_MODE_SMOKE_FREE)).toBe(
      JOURNEY_MODE_SMOKE_FREE,
    );
    expect(normalizeJourneyMode(JOURNEY_MODE_CONTROLLED)).toBe(
      JOURNEY_MODE_CONTROLLED,
    );
  });

  it('normaliza los días y el máximo semanal controlado', () => {
    const config = {
      journeyMode: JOURNEY_MODE_CONTROLLED,
      controlledDays: [5, 6, 0, 6],
      controlledWeeklyLimit: '4',
    };
    expect(controlledDaysOf(config)).toEqual([5, 6, 0]);
    expect(controlledWeeklyLimitOf(config)).toBe(4);
    expect(isControlledSmokingDay(config, new Date(2026, 7, 7))).toBe(true);
    expect(isControlledSmokingDay(config, new Date(2026, 7, 6))).toBe(false);
  });

  it('conserva el camino histórico antes de una transición', () => {
    const config = {
      journeyMode: JOURNEY_MODE_CONTROLLED,
      journeyOriginMode: JOURNEY_MODE_SMOKE_FREE,
      journeyTransitions: [
        {
          effectiveDate: '2026-08-10',
          journeyMode: JOURNEY_MODE_CONTROLLED,
          controlledDays: [5, 6, 0],
          controlledWeeklyLimit: 3,
        },
      ],
    };
    expect(journeyModeForDate(config, '2026-08-09')).toBe(
      JOURNEY_MODE_SMOKE_FREE,
    );
    expect(journeyModeForDate(config, '2026-08-10')).toBe(
      JOURNEY_MODE_CONTROLLED,
    );
    expect(journeyConfigForDate(config, '2026-08-10')).toMatchObject({
      journeyMode: JOURNEY_MODE_CONTROLLED,
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    });
  });

  it('programa y aplica el cambio solo al llegar la fecha efectiva', () => {
    const scheduled = scheduleControlledJourneyTransition({
      config: { journeyMode: JOURNEY_MODE_SMOKE_FREE },
      effectiveDate: '2026-08-10',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    });
    expect(applyDueJourneyTransition(scheduled, '2026-08-09').applied).toBe(false);
    const applied = applyDueJourneyTransition(scheduled, '2026-08-10');
    expect(applied.applied).toBe(true);
    expect(applied.config).toMatchObject({
      journeyMode: JOURNEY_MODE_CONTROLLED,
      journeyOriginMode: JOURNEY_MODE_SMOKE_FREE,
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    });
    expect(applied.config.pendingJourneyTransition).toBeUndefined();
    expect(journeyModeForDate(applied.config, '2026-08-09')).toBe(
      JOURNEY_MODE_SMOKE_FREE,
    );
  });

  it('trata un día sin decisión como pendiente', () => {
    expect(smokeFreeStatusOf({})).toBe(SMOKE_FREE_STATUS_PENDING);
    expect(smokeFreeStatusOf({ sf: 'success' })).toBe('success');
    expect(smokeFreeStatusOf({ sf: 'smoked' })).toBe('smoked');
  });

  it('mantiene los jefes ligados al plan en reducción y toda la campaña sin fumar', () => {
    expect(bossCountForJourney({ startLimit: 6 }, 21)).toBe(6);
    expect(
      bossCountForJourney(
        { journeyMode: JOURNEY_MODE_SMOKE_FREE, startLimit: 3 },
        21,
      ),
    ).toBe(21);
    expect(
      bossCountForJourney(
        { journeyMode: JOURNEY_MODE_CONTROLLED, startLimit: 3 },
        21,
      ),
    ).toBe(21);
  });

  it('desbloquea la evolución según el camino real del usuario', () => {
    expect(
      journeyEvolutionUnlocked({
        config: { journeyMode: JOURNEY_MODE_SMOKE_FREE },
        bossesDown: 2,
      }),
    ).toBe(false);
    expect(
      journeyEvolutionUnlocked({
        config: { journeyMode: JOURNEY_MODE_SMOKE_FREE },
        bossesDown: 3,
      }),
    ).toBe(true);
    expect(
      journeyEvolutionUnlocked({
        config: { journeyMode: JOURNEY_MODE_CONTROLLED },
        bossesDown: 3,
      }),
    ).toBe(true);
    expect(
      journeyEvolutionUnlocked({
        config: { startLimit: 6 },
        bossesDown: 5,
      }),
    ).toBe(false);
    expect(
      journeyEvolutionUnlocked({
        config: { startLimit: 6 },
        bossesDown: 6,
      }),
    ).toBe(true);
  });
});
