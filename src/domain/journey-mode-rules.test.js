import { describe, expect, it } from 'vitest';
import {
  JOURNEY_MODE_REDUCTION,
  JOURNEY_MODE_SMOKE_FREE,
  SMOKE_FREE_STATUS_PENDING,
  bossCountForJourney,
  journeyEvolutionUnlocked,
  normalizeJourneyMode,
  smokeFreeStatusOf,
} from './journey-mode-rules.js';

describe('modos del viaje', () => {
  it('mantiene reducción como modo compatible por defecto', () => {
    expect(normalizeJourneyMode()).toBe(JOURNEY_MODE_REDUCTION);
    expect(normalizeJourneyMode('otro')).toBe(JOURNEY_MODE_REDUCTION);
    expect(normalizeJourneyMode(JOURNEY_MODE_SMOKE_FREE)).toBe(
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
