// Fixed encounter tuning. Never depends on the player's class or inventory.
const encounter = (attack, hp, defense, rendPercent = 0) => Object.freeze({ rendPercent, all: Object.freeze({ attack, hp, defense }) });

export const HUNT_BALANCE_TUNING = Object.freeze({
  'fields-of-mist': Object.freeze({
    easy: encounter(0.8, 1, 1),
    medium: encounter(1.6, 0.6, 0.4),
    hard: Object.freeze({
      rendPercent: 30,
      all: Object.freeze({ attack: 1.3, hp: 0.6, defense: 0 }),
      'blighted-harvester': Object.freeze({ attack: 1.3, hp: 0.9, defense: 0 }),
      'spore-overseer': Object.freeze({ attack: 1.3, hp: 0.6, defense: 0 }),
      'mist-mother': Object.freeze({ attack: 1.3, hp: 0.46, defense: 0 }),
    }),
  }),
  'dead-hours-bunker': Object.freeze({
    easy: encounter(1, 1, 1),
    medium: encounter(1.5, 1, 0),
    hard: Object.freeze({
      rendPercent: 30,
      all: Object.freeze({ attack: 1.15, hp: 0.6, defense: 0 }),
      'the-consumed': Object.freeze({ attack: 1.15, hp: 0.39, defense: 0 }),
      'embedded-guardian': Object.freeze({ attack: 1.15, hp: 0.53, defense: 0 }),
      'dead-hours-puppeteer': Object.freeze({ attack: 1.15, hp: 0.825, defense: 0, guardPercent: 49 }),
    }),
  }),
  'nuncabasta-peaks': Object.freeze({
    easy: encounter(1.15, 1, 0.8),
    medium: encounter(1.5, 1.1, 0),
    hard: Object.freeze({
      rendPercent: 30,
      all: Object.freeze({ attack: 1.5, hp: 0.6, defense: 0 }),
      'filled-smile': Object.freeze({ attack: 1.2, hp: 0.83, defense: 0 }),
    }),
  }),
});
