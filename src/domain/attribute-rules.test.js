import { describe, expect, it } from 'vitest';
import {
  allocateAttributePoint,
  attributeSheet,
  availableAttributePoints,
  clampAttributePointAmount,
  earnedAttributePoints,
  healingPowerMultiplier,
  resetAttributeAllocation,
} from './attribute-rules.js';

describe('attribute rules', () => {
  it('concede tres puntos desde el primer nivel', () => {
    expect(earnedAttributePoints(1)).toBe(3);
    expect(earnedAttributePoints(5)).toBe(15);
    expect(earnedAttributePoints(20)).toBe(60);
  });

  it('combina la identidad de clase con la asignación del jugador', () => {
    const sheet = attributeSheet({ classId: 'knight', level: 3, allocation: { strength: 2, power: 1 } });
    expect(sheet.attributes.strength).toBe(10);
    expect(sheet.attributes.defense).toBe(10);
    expect(sheet.attributes.power).toBe(4);
    expect(sheet.availablePoints).toBe(6);
  });

  it('impide gastar más puntos de los ganados', () => {
    const result = allocateAttributePoint({
      classId: 'sorcerer', level: 2, allocation: { power: 6 }, attributeId: 'dexterity',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-points');
    expect(availableAttributePoints({ level: 2, allocation: { power: 6 } })).toBe(0);
  });

  it('devuelve todos los atributos asignados a cero al resetear', () => {
    expect(resetAttributeAllocation()).toEqual({
      strength: 0,
      defense: 0,
      dexterity: 0,
      power: 0,
      constitution: 0,
    });
  });

  it('el Caballero suma +0,25% por punto de Defensa y el Paladín por punto de Destreza, además del Poder', () => {
    expect(healingPowerMultiplier({ classId: 'knight', allocation: { defense: 30, power: 8 } })).toBeCloseTo(1 + (30 * 0.25 + 8 * 0.5) / 100);
    expect(healingPowerMultiplier({ classId: 'knight', allocation: { defense: 30, power: 8 } })).toBeCloseTo(1.115);
    expect(healingPowerMultiplier({ classId: 'knight', allocation: { dexterity: 40, strength: 10 } })).toBe(1);
    expect(healingPowerMultiplier({ classId: 'paladin', allocation: { dexterity: 20, power: 10 } })).toBeCloseTo(1.1);
    expect(healingPowerMultiplier({ classId: 'paladin', allocation: { defense: 40 } })).toBe(1);
    expect(healingPowerMultiplier({ classId: 'sorcerer', allocation: { defense: 40, dexterity: 40 } })).toBe(1);
    expect(healingPowerMultiplier({ classId: 'druid', allocation: { defense: 40, dexterity: 40, power: 10 } })).toBeCloseTo(1.05);
  });

  it('las cuatro clases curan +0,5% por punto de Poder invertido', () => {
    expect(healingPowerMultiplier({ classId: 'sorcerer', allocation: {} })).toBe(1);
    expect(healingPowerMultiplier({ classId: 'sorcerer', allocation: { power: 20 } })).toBeCloseTo(1.1);
    expect(healingPowerMultiplier({ classId: 'druid', allocation: { power: 50, strength: 9 } })).toBeCloseTo(1.25);
    expect(healingPowerMultiplier({ classId: 'knight', allocation: { power: 50 } })).toBeCloseTo(1.25);
    expect(healingPowerMultiplier({ classId: 'paladin', allocation: { power: 20 } })).toBeCloseTo(1.1);
    expect(healingPowerMultiplier({ classId: 'warrior', allocation: { power: 50 } })).toBe(1);
    expect(healingPowerMultiplier({ classId: 'sorcerer' })).toBe(1);
  });

  it('limita la cantidad a repartir entre 1 y los puntos disponibles', () => {
    expect(clampAttributePointAmount(5, 30)).toBe(5);
    expect(clampAttributePointAmount(99, 30)).toBe(30);
    expect(clampAttributePointAmount(0, 30)).toBe(1);
    expect(clampAttributePointAmount(-4, 30)).toBe(1);
    expect(clampAttributePointAmount('abc', 30)).toBe(1);
    expect(clampAttributePointAmount(3.9, 30)).toBe(3);
    expect(clampAttributePointAmount(5, 0)).toBe(0);
  });

  it('reparte varios puntos de una vez sin pasarse de los disponibles', () => {
    const level = 5;
    const ok = allocateAttributePoint({ classId: 'sorcerer', level, allocation: {}, attributeId: 'power', amount: 10 });
    expect(ok.ok).toBe(true);
    expect(ok.sheet.allocation.power).toBe(10);
    expect(ok.sheet.availablePoints).toBe(earnedAttributePoints(level) - 10);
    const tooMany = allocateAttributePoint({ classId: 'sorcerer', level, allocation: {}, attributeId: 'power', amount: earnedAttributePoints(level) + 1 });
    expect(tooMany.ok).toBe(false);
    expect(tooMany.reason).toBe('insufficient-points');
  });
});
