export const POTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'fortune', name: 'Poción de Fortuna', price: 20, symbol: '¤', tone: 'gold',
    shortEffect: 'Triplica el oro de tus hábitos y añade +50% al oro de Cacería durante 30 min.',
    detail: 'Añade hasta 50 de oro extra en total.',
  }),
  Object.freeze({
    id: 'experience', name: 'Poción de Experiencia', price: 20, symbol: '✦', tone: 'violet',
    shortEffect: '+50% XP de tus hábitos diarios durante 30 min.',
    detail: 'Añade hasta 10 XP extra.',
  }),
  Object.freeze({
    id: 'life', name: 'Poción de Vida', price: 6, symbol: '♥', tone: 'red',
    shortEffect: 'Recupera 20 puntos de Salud.',
    detail: 'Uso instantáneo. Sin límite diario.',
  }),
  Object.freeze({
    id: 'mana', name: 'Poción de Maná', price: 8, symbol: '◆', tone: 'blue',
    shortEffect: 'Recupera 25 puntos de Maná.',
    detail: 'Uso instantáneo. Sin límite diario.',
  }),
  Object.freeze({
    id: 'energy', name: 'Poción de Vigor', price: 60, symbol: 'ϟ', tone: 'energy',
    energyRestore: 5,
    shortEffect: 'Recupera 5, 3 y 2 puntos de Energía de Cacería en el primer, segundo y tercer uso.',
    detail: 'Hasta tres usos al día. Se reinicia al comenzar tu día. Necesitas espacio para recuperar toda la energía de cada dosis.',
  }),
  Object.freeze({
    id: 'blood', name: 'Poción de Sangre', price: 25, symbol: '♦', tone: 'blood',
    shortEffect: 'Aumenta la probabilidad de obtener +1 Sangre de Jefe adicional.',
    detail: 'Hasta tres por jefe: +20%, +10% y +5% de probabilidad.',
  }),
]);

export const POTION_BY_ID = Object.freeze(Object.fromEntries(
  POTION_DEFINITIONS.map((definition) => [definition.id, definition]),
));

export const POTION_FUTURE_SLOTS = 6;
export const POTION_BAG_SLOT_LIMIT = 4;
export const POTION_DURATION_MS = 30 * 60 * 1000;
export const POTION_BONUS_CAPS = Object.freeze({ fortune: 50, experience: 10 });
export const POTION_DAILY_LIMITS = Object.freeze({
  fortune: 1, experience: 1, energy: 3,
});
export const POTION_ENERGY_RESTORES = Object.freeze([5, 3, 2]);
export const POTION_BLOOD_CHANCES = Object.freeze([20, 10, 5]);
