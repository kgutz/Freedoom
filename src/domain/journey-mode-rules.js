import { bossCountForPlan } from './plan-rules.js';
import { keyOf } from './date-utils.js';

export const JOURNEY_MODE_REDUCTION = 'reduction';
export const JOURNEY_MODE_SMOKE_FREE = 'smoke_free';
export const JOURNEY_MODE_CONTROLLED = 'controlled';
export const SMOKE_FREE_EVOLUTION_BOSSES = 3;
export const CONTROLLED_EVOLUTION_BOSSES = 3;
export const DEFAULT_CONTROLLED_DAYS = [5, 6, 0];
export const DEFAULT_CONTROLLED_WEEKLY_LIMIT = 3;

export const SMOKE_FREE_STATUS_PENDING = 'pending';
export const SMOKE_FREE_STATUS_SUCCESS = 'success';
export const SMOKE_FREE_STATUS_SMOKED = 'smoked';

export function normalizeJourneyMode(mode) {
  if (mode === JOURNEY_MODE_SMOKE_FREE) return JOURNEY_MODE_SMOKE_FREE;
  if (mode === JOURNEY_MODE_CONTROLLED) return JOURNEY_MODE_CONTROLLED;
  return JOURNEY_MODE_REDUCTION;
}

export function isSmokeFreeMode(config) {
  return normalizeJourneyMode(config?.journeyMode) === JOURNEY_MODE_SMOKE_FREE;
}

export function isControlledMode(config) {
  return normalizeJourneyMode(config?.journeyMode) === JOURNEY_MODE_CONTROLLED;
}

export function usesSmokeFreeSkills(config) {
  return normalizeJourneyMode(config?.journeyMode) !== JOURNEY_MODE_REDUCTION;
}

export function controlledDaysOf(config) {
  const days = Array.isArray(config?.controlledDays)
    ? config.controlledDays
        .map((day) => Number.parseInt(day, 10))
        .filter((day) => day >= 0 && day <= 6)
    : [];
  return days.length ? [...new Set(days)] : [...DEFAULT_CONTROLLED_DAYS];
}

export function controlledWeeklyLimitOf(config) {
  return Math.max(
    1,
    Number.parseInt(config?.controlledWeeklyLimit, 10) ||
      DEFAULT_CONTROLLED_WEEKLY_LIMIT,
  );
}

export function isControlledSmokingDay(config, date) {
  return isControlledMode(config) && controlledDaysOf(config).includes(date.getDay());
}

export function journeyModeForDate(config, date) {
  const transitions = Array.isArray(config?.journeyTransitions)
    ? [...config.journeyTransitions]
        .filter((transition) => transition?.effectiveDate)
        .sort((left, right) =>
          left.effectiveDate.localeCompare(right.effectiveDate),
        )
    : [];
  if (!transitions.length) return normalizeJourneyMode(config?.journeyMode);
  let mode = normalizeJourneyMode(
    config?.journeyOriginMode || config?.journeyMode,
  );
  const dateKey = typeof date === 'string' ? date : keyOf(date);
  transitions.forEach((transition) => {
    if (transition.effectiveDate <= dateKey) {
      mode = normalizeJourneyMode(transition.journeyMode);
    }
  });
  return mode;
}

export function journeyConfigForDate(config, date) {
  const dateKey = typeof date === 'string' ? date : keyOf(date);
  const transitions = Array.isArray(config?.journeyTransitions)
    ? [...config.journeyTransitions]
        .filter((transition) => transition?.effectiveDate)
        .sort((left, right) =>
          left.effectiveDate.localeCompare(right.effectiveDate),
        )
    : [];
  let result = {
    ...config,
    journeyMode: normalizeJourneyMode(
      transitions.length
        ? config?.journeyOriginMode || config?.journeyMode
        : config?.journeyMode,
    ),
  };
  transitions.forEach((transition) => {
    if (transition.effectiveDate <= dateKey) {
      result = {
        ...result,
        journeyMode: normalizeJourneyMode(transition.journeyMode),
        ...(transition.controlledDays
          ? { controlledDays: [...transition.controlledDays] }
          : {}),
        ...(transition.controlledWeeklyLimit
          ? { controlledWeeklyLimit: transition.controlledWeeklyLimit }
          : {}),
      };
    }
  });
  return result;
}

export function scheduleControlledJourneyTransition({
  config,
  effectiveDate,
  controlledDays,
  controlledWeeklyLimit,
}) {
  return {
    ...config,
    pendingJourneyTransition: {
      journeyMode: JOURNEY_MODE_CONTROLLED,
      effectiveDate,
      controlledDays:
        Array.isArray(controlledDays) && controlledDays.length
          ? [...new Set(controlledDays.map(Number))]
          : [...DEFAULT_CONTROLLED_DAYS],
      controlledWeeklyLimit: Math.max(
        1,
        Number.parseInt(controlledWeeklyLimit, 10) ||
          DEFAULT_CONTROLLED_WEEKLY_LIMIT,
      ),
    },
  };
}

export function applyDueJourneyTransition(config, date) {
  const pending = config?.pendingJourneyTransition;
  const dateKey = typeof date === 'string' ? date : keyOf(date);
  if (!pending || pending.effectiveDate > dateKey) {
    return { config, applied: false };
  }
  const nextConfig = {
    ...config,
    journeyOriginMode:
      config.journeyOriginMode ||
      normalizeJourneyMode(config.journeyMode),
    journeyTransitions: [
      ...(config.journeyTransitions || []),
      {
        effectiveDate: pending.effectiveDate,
        journeyMode: pending.journeyMode,
        controlledDays: [...pending.controlledDays],
        controlledWeeklyLimit: pending.controlledWeeklyLimit,
      },
    ],
    journeyMode: pending.journeyMode,
    controlledDays: [...pending.controlledDays],
    controlledWeeklyLimit: pending.controlledWeeklyLimit,
  };
  delete nextConfig.pendingJourneyTransition;
  return { config: nextConfig, applied: true };
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
  if (isSmokeFreeMode(config) || isControlledMode(config)) {
    return Math.max(1, availableBosses);
  }
  return bossCountForPlan(config?.startLimit, availableBosses);
}

export function journeyEvolutionUnlocked({ config, bossesDown = 0 }) {
  const requiredBosses = isSmokeFreeMode(config)
    ? SMOKE_FREE_EVOLUTION_BOSSES
    : isControlledMode(config)
      ? CONTROLLED_EVOLUTION_BOSSES
      : bossCountForJourney(config, 21);
  return Math.max(0, bossesDown) >= requiredBosses;
}
