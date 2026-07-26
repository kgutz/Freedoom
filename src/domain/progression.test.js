import { describe, expect, it } from 'vitest';
import { classMaxes, levelFromXp } from './progression.js';

describe('levelFromXp', () => {
  it('mantiene el nivel 1 hasta alcanzar el primer umbral', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(34)).toBe(1);
    expect(levelFromXp(35)).toBe(2);
  });

  it('usa los umbrales cuadráticos del juego', () => {
    expect(levelFromXp(140)).toBe(3);
    expect(levelFromXp(315)).toBe(4);
  });

  it('protege contra XP negativa', () => {
    expect(levelFromXp(-100)).toBe(1);
  });
});

describe('classMaxes', () => {
  it('aplica el crecimiento propio de cada clase', () => {
    expect(classMaxes('knight', 3)).toEqual({ maxHp: 116, maxMp: 104 });
    expect(classMaxes('sorcerer', 3)).toEqual({ maxHp: 104, maxMp: 116 });
  });

  it('usa crecimiento equilibrado para una clase desconocida', () => {
    expect(classMaxes('unknown', 2)).toEqual({ maxHp: 105, maxMp: 105 });
  });
});
