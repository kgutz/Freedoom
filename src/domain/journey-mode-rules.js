import { bossCountForPlan } from './plan-rules.js';

export const JOURNEY_MODE_REDUCTION = 'reduction';
export const JOURNEY_MODE_SMOKE_FREE = 'smoke_free';
export const SMOKE_FREE_EVOLUTION_BOSSES = 3;

export const SMOKE_FREE_STATUS_PENDING = 'pending';
export const SMOKE_FREE_STATUS_SUCCESS = 'success';
export const SMOKE_FREE_STATUS_SMOKED = 'smoked';

export function normalizeJourneyMode(mode) {
  return mode === JOURNEY_MODE_SMOKE_FREE
    ? JOURNEY_MODE_SMOKE_FREE
    : JOURNEY_MODE_REDUCTION;
}

export function isSmokeFreeMode(config) {
  return normalizeJourneyMode(config?.journeyMode) === JOURNEY_MODE_SMOKE_FREE;
}

export function smokeFreeStatusOf(record) {
  if (record?.sf === SMOKE_FREE_STATUS_SUCCESS) {
    return SMOKE_FREE_STATUS_SUCCESS;
  }
  if (record?.sf === SMOKE_FREE_STATUS_SMOKED) {
    return SMOKE_FREE_STATUS_SMOKED;
  }
  return SMOKE_FREE_STATUS_PENDING;
}

export function bossCountForJourney(config, availableBosses = 21) {
  if (isSmokeFreeMode(config)) return Math.max(1, availableBosses);
  return bossCountForPlan(config?.startLimit, availableBosses);
}

export function journeyEvolutionUnlocked({ config, bossesDown = 0 }) {
  const requiredBosses = isSmokeFreeMode(config)
    ? SMOKE_FREE_EVOLUTION_BOSSES
    : bossCountForJourney(config, 21);
  return Math.max(0, bossesDown) >= requiredBosses;
}
