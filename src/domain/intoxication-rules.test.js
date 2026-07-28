import { describe, expect, it } from 'vitest';
import {
  INTOXICATION_DURATIONS,
  INTOXICATION_LEVELS,
  addBeerIntoxication,
  beerUndoEffects,
  intoxicationStatus,
  passiveActivates,
  removeBeerIntoxication,
  scalePassiveAmount,
  scalePassiveUpgrade,
} from './intoxication-rules.js';

describe('curva de borrachera', () => {
  it('usa los porcentajes y duraciones acordados', () => {
    expect(INTOXICATION_LEVELS).toEqual([10, 25, 45, 70, 85]);
    expect(INTOXICATION_DURATIONS).toEqual([30, 45, 60, 75, 90]);
  });

  it('acumula 10, 25, 45, 70 y 85 por ciento', () => {
    const now = 1_000_000;
    let effects = [];
    const levels = [];
    const durations = [];
    for (let index = 0; index < 5; index += 1) {
      const added = addBeerIntoxication(effects, now + index);
      effects = added.effects;
      levels.push(added.status.level);
      durations.push(
        Math.round((added.effect.expiresAt - (now + index)) / 60_000),
      );
    }

    expect(levels).toEqual([10, 25, 45, 70, 85]);
    expect(durations).toEqual([30, 45, 60, 75, 90]);
  });

  it('mantiene el máximo del 85% con más cervezas', () => {
    const now = 2_000_000;
    let effects = [];
    for (let index = 0; index < 8; index += 1) {
      effects = addBeerIntoxication(effects, now + index).effects;
    }

    expect(intoxicationStatus(effects, now + 10).level).toBe(85);
  });
});

describe('caducidad y corrección', () => {
  it('elimina cada cerveza cuando vence su tiempo independiente', () => {
    const first = addBeerIntoxication([], 0);
    const second = addBeerIntoxication(first.effects, 10 * 60_000);
    const status = intoxicationStatus(second.effects, 31 * 60_000);

    expect(status.activeBeers).toBe(1);
    expect(status.level).toBe(15);
  });

  it('permite retirar exactamente el efecto de la última cerveza', () => {
    const first = addBeerIntoxication([], 0);
    const second = addBeerIntoxication(first.effects, 1);
    const remaining = removeBeerIntoxication(
      second.effects,
      second.effect.id,
      2,
    );

    expect(intoxicationStatus(remaining, 2).level).toBe(10);
  });

  it('mantiene compatibilidad con registros antiguos de cerveza', () => {
    expect(beerUndoEffects(5)).toEqual({
      damage: 5,
      intoxicationEffectId: null,
    });
    expect(beerUndoEffects({ d: 5, i: 'effect-1' })).toEqual({
      damage: 5,
      intoxicationEffectId: 'effect-1',
    });
  });
});

describe('reducción de pasivas', () => {
  it('reduce cantidades y solo la mejora sobre el valor base', () => {
    expect(scalePassiveAmount(20, 0.55)).toBe(11);
    expect(scalePassiveUpgrade(25, 18, 0.55)).toBe(21);
    expect(scalePassiveUpgrade(15, 20, 0.55)).toBe(18);
  });

  it('convierte pasivas binarias en una comprobación de activación', () => {
    expect(passiveActivates(0.55, 0.54)).toBe(true);
    expect(passiveActivates(0.55, 0.55)).toBe(false);
  });
});
