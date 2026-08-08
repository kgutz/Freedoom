import { bossCountForPlan } from './plan-rules.js';
import { keyOf, parseKey } from './date-utils.js';
import {
  DEFAULT_DAY_START_TIME,
  logicalDayDate,
} from './day-boundary-rules.js';

export const JOURNEY_MODE_REDUCTION = 'reduction';
export const JOURNEY_MODE_SMOKE_FREE = 'smoke_free';
export const JOURNEY_MODE_CONTROLLED = 'controlled';
export const SMOKE_FREE_EVOLUTION_BOSSES = 3;
export const CONTROLLED_EVOLUTION_BOSSES = 3;
export const DEFAULT_CONTROLLED_DAYS = [5, 6, 0];
export const DEFAULT_CONTROLLED_WEEKLY_LIMIT = 3;
export const CONTROLLED_TRANSITION_REPAIR_VERSION = 2;

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

export function journeyDayDate(config, now = new Date()) {
  const calendarDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const pending = config?.pendingJourneyTransition;
  const pendingControlled =
    normalizeJourneyMode(pending?.journeyMode) === JOURNEY_MODE_CONTROLLED &&
    pending?.effectiveDate &&
    pending.effectiveDate <= keyOf(calendarDate);
  const controlled =
    pendingControlled ||
    journeyModeForDate(config, calendarDate) === JOURNEY_MODE_CONTROLLED;

  if (controlled) return calendarDate;
  return logicalDayDate(
    now,
    config?.dayStartTime || DEFAULT_DAY_START_TIME,
  );
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
  const historicalTransition = historicalControlledTransitionForDate(
    config,
    transitions,
    dateKey,
  );
  if (historicalTransition) return JOURNEY_MODE_CONTROLLED;
  return mode;
}

function historicalControlledTransitionForDate(config, transitions, dateKey) {
  const historyStart = config?.controlledHistoryStartDate;
  if (!historyStart || dateKey < historyStart) return null;
  const firstControlled = transitions.find(
    (transition) =>
      normalizeJourneyMode(transition.journeyMode) ===
      JOURNEY_MODE_CONTROLLED,
  );
  if (!firstControlled || dateKey >= firstControlled.effectiveDate) return null;
  const date = parseKey(dateKey);
  return controlledDaysOf(firstControlled).includes(date.getDay())
    ? firstControlled
    : null;
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
  const historicalTransition = historicalControlledTransitionForDate(
    config,
    transitions,
    dateKey,
  );
  if (historicalTransition) {
    result = {
      ...result,
      journeyMode: JOURNEY_MODE_CONTROLLED,
      controlledDays: [...controlledDaysOf(historicalTransition)],
      controlledWeeklyLimit: controlledWeeklyLimitOf(historicalTransition),
    };
  }
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
      requestedDate: effectiveDate,
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
  if (!pending) {
    return { config, applied: false };
  }
  const effectiveDate =
    normalizeJourneyMode(pending.journeyMode) === JOURNEY_MODE_CONTROLLED
      ? [pending.effectiveDate, dateKey].filter(Boolean).sort()[0]
      : pending.effectiveDate;
  if (effectiveDate > dateKey) return { config, applied: false };
  const nextConfig = {
    ...config,
    journeyOriginMode:
      config.journeyOriginMode ||
      normalizeJourneyMode(config.journeyMode),
    journeyTransitions: [
      ...(config.journeyTransitions || []),
      {
        effectiveDate,
        ...(pending.requestedDate
          ? { requestedDate: pending.requestedDate }
          : {}),
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

export function repairLegacyControlledTransitionStart(config, days = {}) {
  if (!config || config.pendingJourneyTransition) {
    return { config, changed: false, repaired: false };
  }

  const alreadyChecked =
    config.controlledTransitionRepairVersion >=
    CONTROLLED_TRANSITION_REPAIR_VERSION;
  let repaired = false;
  const transitions = Array.isArray(config.journeyTransitions)
    ? config.journeyTransitions.map((transition) => {
        if (
          normalizeJourneyMode(transition?.journeyMode) !==
            JOURNEY_MODE_CONTROLLED ||
          !transition.effectiveDate ||
          transition.requestedDate
        ) {
          return transition;
        }

        const controlledDays = controlledDaysOf(transition);
        let correctedDate = parseKey(transition.effectiveDate);
        while (true) {
          const previousDate = new Date(correctedDate);
          previousDate.setDate(previousDate.getDate() - 1);
          const previousKey = keyOf(previousDate);
          if (
            previousKey < (config.startDate || previousKey) ||
            !controlledDays.includes(previousDate.getDay()) ||
            smokeFreeStatusOf(days[previousKey]) !==
              SMOKE_FREE_STATUS_SUCCESS
          ) {
            break;
          }
          correctedDate = previousDate;
        }

        const correctedKey = keyOf(correctedDate);
        if (correctedKey === transition.effectiveDate) return transition;
        repaired = true;
        return {
          ...transition,
          effectiveDate: correctedKey,
          repairedFromDate: transition.effectiveDate,
        };
      })
    : config.journeyTransitions;

  let controlledHistoryStartDate = config.controlledHistoryStartDate;
  let historyAdded = false;
  const hasControlledTransition = Array.isArray(transitions) &&
    transitions.some(
      (transition) =>
        normalizeJourneyMode(transition?.journeyMode) ===
        JOURNEY_MODE_CONTROLLED,
    );
  if (
    !controlledHistoryStartDate &&
    hasControlledTransition &&
    normalizeJourneyMode(config.journeyOriginMode) === JOURNEY_MODE_SMOKE_FREE &&
    config.startDate
  ) {
    const previousDate = parseKey(config.startDate);
    previousDate.setDate(previousDate.getDate() - 1);
    controlledHistoryStartDate = keyOf(previousDate);
    historyAdded = true;
  }

  return {
    config: {
      ...config,
      ...(Array.isArray(transitions) ? { journeyTransitions: transitions } : {}),
      ...(controlledHistoryStartDate
        ? { controlledHistoryStartDate }
        : {}),
      controlledTransitionRepairVersion:
        CONTROLLED_TRANSITION_REPAIR_VERSION,
    },
    changed: repaired || historyAdded || !alreadyChecked,
    repaired,
  };
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
