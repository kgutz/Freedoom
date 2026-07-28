export const INTOXICATION_LEVELS = [10, 25, 45, 70, 85];
export const INTOXICATION_DURATIONS = [30, 45, 60, 75, 90];
export const MAX_INTOXICATION = 85;

const CONTRIBUTIONS = [10, 15, 20, 25, 15];

export function activeIntoxicationEffects(effects = [], nowTimestamp) {
  return effects.filter(
    (effect) =>
      effect &&
      Number.isFinite(effect.expiresAt) &&
      effect.expiresAt > nowTimestamp &&
      Number.isFinite(effect.potency),
  );
}

export function intoxicationStatus(effects = [], nowTimestamp = Date.now()) {
  const activeEffects = activeIntoxicationEffects(effects, nowTimestamp);
  const level = Math.min(
    MAX_INTOXICATION,
    activeEffects.reduce((total, effect) => total + effect.potency, 0),
  );
  const soberAt = activeEffects.reduce(
    (latest, effect) => Math.max(latest, effect.expiresAt),
    nowTimestamp,
  );

  return {
    effects: activeEffects,
    activeBeers: activeEffects.length,
    level,
    activeFailureChance: level / 100,
    passiveReduction: level / 100,
    passiveMultiplier: (100 - level) / 100,
    soberAt,
    remainingMinutes:
      level > 0 ? Math.max(1, Math.ceil((soberAt - nowTimestamp) / 60_000)) : 0,
  };
}

export function addBeerIntoxication(
  effects = [],
  nowTimestamp = Date.now(),
) {
  const current = intoxicationStatus(effects, nowTimestamp);
  const curveIndex = Math.min(
    current.activeBeers,
    INTOXICATION_DURATIONS.length - 1,
  );
  const effect = {
    id: `${nowTimestamp}-${current.activeBeers}`,
    potency: CONTRIBUTIONS[curveIndex],
    startedAt: nowTimestamp,
    expiresAt:
      nowTimestamp + INTOXICATION_DURATIONS[curveIndex] * 60_000,
  };
  const nextEffects = [...current.effects, effect];

  return {
    effect,
    effects: nextEffects,
    status: intoxicationStatus(nextEffects, nowTimestamp),
  };
}

export function removeBeerIntoxication(
  effects = [],
  effectId,
  nowTimestamp = Date.now(),
) {
  const activeEffects = activeIntoxicationEffects(effects, nowTimestamp);
  if (!effectId) return activeEffects;
  return activeEffects.filter((effect) => effect.id !== effectId);
}

export function beerUndoEffects(entry) {
  if (typeof entry === 'number') {
    return { damage: entry, intoxicationEffectId: null };
  }
  return {
    damage: entry?.d || 0,
    intoxicationEffectId: entry?.i || null,
  };
}

export function scalePassiveAmount(amount, passiveMultiplier) {
  return Math.max(0, Math.round(amount * passiveMultiplier));
}

export function scalePassiveUpgrade(
  baseAmount,
  upgradedAmount,
  passiveMultiplier,
) {
  return (
    baseAmount +
    Math.round((upgradedAmount - baseAmount) * passiveMultiplier)
  );
}

export function passiveActivates(
  passiveMultiplier,
  randomValue = Math.random(),
) {
  return randomValue < passiveMultiplier;
}
