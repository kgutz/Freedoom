export const POTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'fortune', name: 'Poción de Fortuna', price: 20, symbol: '¤', tone: 'gold',
    shortEffect: 'Triplica las monedas de hábitos durante 30 min.',
    detail: 'Añade hasta 30 monedas extra. No afecta al bonus de lista completa.',
  }),
  Object.freeze({
    id: 'experience', name: 'Poción de Experiencia', price: 20, symbol: '✦', tone: 'violet',
    shortEffect: '+50% XP de hábitos durante 30 min.',
    detail: 'Añade hasta 10 XP fuera del tope diario de hábitos.',
  }),
  Object.freeze({
    id: 'life', name: 'Poción de Vida', price: 6, symbol: '♥', tone: 'red',
    shortEffect: 'Recupera 20 puntos de Salud.',
    detail: 'Uso instantáneo. Máximo dos usos al día.',
  }),
  Object.freeze({
    id: 'mana', name: 'Poción de Maná', price: 8, symbol: '◆', tone: 'blue',
    shortEffect: 'Recupera 25 puntos de Maná.',
    detail: 'Uso instantáneo. Máximo dos usos al día.',
  }),
  Object.freeze({
    id: 'blood', name: 'Poción de Sangre', price: 25, symbol: '♦', tone: 'blood',
    shortEffect: 'Mejora la próxima extracción de Sangre.',
    detail: 'Hasta tres por jefe: +20%, +10% y +5%.',
  }),
]);

export const POTION_BY_ID = Object.freeze(Object.fromEntries(
  POTION_DEFINITIONS.map((definition) => [definition.id, definition]),
));

export const POTION_FUTURE_SLOTS = 3;
export const POTION_DURATION_MS = 30 * 60 * 1000;
export const POTION_BONUS_CAPS = Object.freeze({ fortune: 30, experience: 10 });
export const POTION_DAILY_LIMITS = Object.freeze({
  fortune: 1, experience: 1, life: 2, mana: 2,
});
export const POTION_BLOOD_CHANCES = Object.freeze([20, 10, 5]);
