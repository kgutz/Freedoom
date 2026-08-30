import { describe, expect, it } from 'vitest';
import { deathExperiencePenalty } from './death-rules.js';

describe('deathExperiencePenalty', () => {
  it('pierde el 10% del tramo del nivel y no de la XP total', () => {
    const result = deathExperiencePenalty({ xp: 84388, level: 50 });

    expect(result.levelXp).toBe(3465);
    expect(result.xpLost).toBe(347);
    expect(result.xpAfter).toBe(84041);
    expect(result.levelAfter).toBe(50);
  });

  it('puede bajar un nivel si la barra apenas había comenzado', () => {
    const result = deathExperiencePenalty({ xp: 84035, level: 50 });

    expect(result.xpLost).toBe(347);
    expect(result.levelAfter).toBe(49);
  });

  it('protege los niveles uno a cuatro', () => {
    const result = deathExperiencePenalty({ xp: 400, level: 4 });

    expect(result.protected).toBe(true);
    expect(result.xpLost).toBe(0);
    expect(result.levelAfter).toBe(4);
  });

  it('nunca permite perder más de un nivel', () => {
    const result = deathExperiencePenalty({
      xp: 84035,
      level: 50,
      lossPercent: 1000,
    });

    expect(result.xpAfter).toBe(35 * 48 * 48);
    expect(result.levelAfter).toBe(49);
  });
});
