export const ATTRIBUTE_IDS = Object.freeze([
  'strength',
  'defense',
  'dexterity',
  'power',
  'constitution',
]);

export const ATTRIBUTE_POINTS_PER_LEVEL = 3;

export const CLASS_BASE_ATTRIBUTES = Object.freeze({
  knight: Object.freeze({ strength: 8, defense: 10, dexterity: 5, power: 3, constitution: 9 }),
  paladin: Object.freeze({ strength: 7, defense: 7, dexterity: 9, power: 5, constitution: 7 }),
  sorcerer: Object.freeze({ strength: 3, defense: 4, dexterity: 7, power: 11, constitution: 5 }),
  druid: Object.freeze({ strength: 4, defense: 6, dexterity: 6, power: 9, constitution: 9 }),
});

const FALLBACK_BASE_ATTRIBUTES = Object.freeze({
  strength: 6,
  defense: 6,
  dexterity: 6,
  power: 6,
  constitution: 6,
});

function safeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function normalizeAttributeAllocation(allocation) {
  return Object.fromEntries(
    ATTRIBUTE_IDS.map((id) => [id, safeInteger(allocation?.[id])]),
  );
}

export function earnedAttributePoints(level) {
  return safeInteger(level) * ATTRIBUTE_POINTS_PER_LEVEL;
}

export function spentAttributePoints(allocation) {
  return Object.values(normalizeAttributeAllocation(allocation))
    .reduce((total, value) => total + value, 0);
}

export function availableAttributePoints({ level, allocation }) {
  return Math.max(0, earnedAttributePoints(level) - spentAttributePoints(allocation));
}

export function attributeSheet({ classId, level, allocation }) {
  const base = CLASS_BASE_ATTRIBUTES[classId] || FALLBACK_BASE_ATTRIBUTES;
  const normalized = normalizeAttributeAllocation(allocation);
  const attributes = Object.fromEntries(
    ATTRIBUTE_IDS.map((id) => [id, base[id] + normalized[id]]),
  );

  return {
    base: { ...base },
    allocation: normalized,
    attributes,
    earnedPoints: earnedAttributePoints(level),
    spentPoints: spentAttributePoints(normalized),
    availablePoints: availableAttributePoints({ level, allocation: normalized }),
  };
}

export function allocateAttributePoint({ classId, level, allocation, attributeId, amount = 1 }) {
  if (!ATTRIBUTE_IDS.includes(attributeId)) {
    return { ok: false, reason: 'unknown-attribute', sheet: attributeSheet({ classId, level, allocation }) };
  }

  const points = Math.max(1, safeInteger(amount));
  const current = attributeSheet({ classId, level, allocation });
  if (current.availablePoints < points) {
    return { ok: false, reason: 'insufficient-points', sheet: current };
  }

  const nextAllocation = {
    ...current.allocation,
    [attributeId]: current.allocation[attributeId] + points,
  };
  return {
    ok: true,
    reason: null,
    sheet: attributeSheet({ classId, level, allocation: nextAllocation }),
  };
}

export function resetAttributeAllocation() {
  return normalizeAttributeAllocation();
}

export const HEALING_PERCENT_PER_POWER_POINT = 0.5;
export const HEALING_PERCENT_PER_SECONDARY_POINT = 0.25;

/* Atributo extra que potencia la curación de cada clase, además del Poder. Los híbridos usan el
   atributo en el que más invierten: el Caballero su Defensa y el Paladín su Destreza. */
export const HEALING_SECONDARY_ATTRIBUTE = Object.freeze({
  knight: 'defense',
  paladin: 'dexterity',
  sorcerer: null,
  druid: null,
});
export const HEALING_POWER_CLASSES = Object.freeze(Object.keys(HEALING_SECONDARY_ATTRIBUTE));

/* Todas las clases curan más con cada punto de Poder invertido (+0,5%); Caballero y Paladín suman
   además +0,25% por punto de Defensa o Destreza. Solo cuentan los puntos asignados por el jugador. */
export function healingPowerMultiplier({ classId, allocation } = {}) {
  if (!HEALING_POWER_CLASSES.includes(classId)) return 1;
  const points = normalizeAttributeAllocation(allocation);
  const secondary = HEALING_SECONDARY_ATTRIBUTE[classId];
  const percent = points.power * HEALING_PERCENT_PER_POWER_POINT
    + (secondary ? points[secondary] * HEALING_PERCENT_PER_SECONDARY_POINT : 0);
  return 1 + percent / 100;
}
