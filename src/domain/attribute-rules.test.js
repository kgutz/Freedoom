import { describe, expect, it } from 'vitest';
import {
  allocateAttributePoint,
  attributeSheet,
  availableAttributePoints,
  earnedAttributePoints,
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
});
