import { describe, expect, it } from 'vitest';
import {
  evaluateSmoke,
  perfectShotRewards,
  smokeUndoEffects,
} from './smoking-rules.js';

const at = (hour, minute) => new Date(2026, 6, 26, hour, minute);

const base = (overrides = {}) => ({
  now: at(12, 0),
  today: '2026-07-26',
  record: { c: 1 },
  limit: 20,
  wakeMinutes: 7 * 60,
  sleepMinutes: 23 * 60,
  classId: 'knight',
  level: 1,
  rootsDay: null,
  pestActive: false,
  armor: 0,
  shieldCharges: 0,
  ...overrides,
});

describe('primer cigarrillo del día', () => {
  it('no penaliza a partir de la hora de levantarse', () => {
    const result = evaluateSmoke(
      base({ now: at(7, 1), record: { c: 0 } }),
    );

    expect(result.dmg).toBe(0);
    expect(result.perfect).toBe(false);
  });

  it('penaliza si se fuma antes de la hora de levantarse', () => {
    const result = evaluateSmoke(
      base({ now: at(6, 59), record: { c: 0 } }),
    );

    expect(result.dmg).toBe(15);
  });

  it('trata la 1:00 como el final del día anterior con corte a las 4:00', () => {
    const result = evaluateSmoke(
      base({
        now: new Date(2026, 6, 27, 1, 0),
        today: '2026-07-26',
        record: { c: 5 },
        dayStartTime: '04:00',
      }),
    );

    expect(result.dmg).toBe(0);
  });
});

describe('ritmo y límite', () => {
  it('detecta un disparo perfecto tras esperar hasta la siguiente hora', () => {
    const result = evaluateSmoke(
      base({
        now: at(9, 0),
        record: { c: 1, t: at(8, 0).getTime() },
      }),
    );

    expect(result.perfect).toBe(true);
    expect(result.dmg).toBe(0);
  });

  it('aplica el daño de exceso y la reducción del caballero', () => {
    expect(
      evaluateSmoke(base({ record: { c: 20 }, classId: 'paladin' })).dmg,
    ).toBe(25);
    expect(
      evaluateSmoke(
        base({ record: { c: 20 }, classId: 'knight', level: 5 }),
      ).dmg,
    ).toBe(18);
  });
});

describe('habilidades defensivas', () => {
  it('consume Raíces Profundas solo en el primer daño adelantado del día', () => {
    const protectedResult = evaluateSmoke(
      base({
        now: at(7, 10),
        record: { c: 1 },
        classId: 'druid',
        level: 12,
      }),
    );
    const spentResult = evaluateSmoke(
      base({
        now: at(7, 10),
        record: { c: 1 },
        classId: 'druid',
        level: 12,
        rootsDay: '2026-07-26',
      }),
    );

    expect(protectedResult).toMatchObject({ dmg: 0, consumesRoots: true });
    expect(spentResult.dmg).toBe(15);
  });

  it('aplica esencia, peste y armadura en el orden existente', () => {
    const result = evaluateSmoke(
      base({
        now: at(7, 10),
        record: { c: 1 },
        classId: 'sorcerer',
        pestActive: true,
        armor: 2,
      }),
    );

    expect(result.dmg).toBe(5);
  });

  it('consume el escudo cuando quedaba daño', () => {
    const result = evaluateSmoke(
      base({ now: at(7, 10), record: { c: 1 }, shieldCharges: 1 }),
    );

    expect(result).toMatchObject({
      dmg: 0,
      shielded: true,
      consumesShield: true,
    });
  });

  it('reduce Yelmo, Absorber Esencia y Raíces según la borrachera', () => {
    expect(
      evaluateSmoke(
        base({
          record: { c: 20 },
          classId: 'knight',
          level: 5,
          passiveMultiplier: 0.55,
        }),
      ).dmg,
    ).toBe(21);
    expect(
      evaluateSmoke(
        base({
          now: at(7, 10),
          record: { c: 1 },
          classId: 'sorcerer',
          passiveMultiplier: 0.55,
        }),
      ).dmg,
    ).toBe(14);
    expect(
      evaluateSmoke(
        base({
          now: at(7, 10),
          record: { c: 1 },
          classId: 'druid',
          level: 12,
          passiveMultiplier: 0.55,
          passiveRandomValue: 0.7,
        }),
      ),
    ).toMatchObject({ dmg: 15, consumesRoots: true });
  });
});

describe('recompensas de disparo perfecto', () => {
  it('aplica las bonificaciones de paladín y de los hechizos activos', () => {
    expect(
      perfectShotRewards({ perfect: true, classId: 'paladin' }),
    ).toEqual({ xp: 4, mana: 10 });
    expect(
      perfectShotRewards({
        perfect: true,
        classId: 'paladin',
        marksmanActive: true,
        ashCurseActive: true,
      }),
    ).toEqual({ xp: 8, mana: 20 });
  });

  it('reduce Ojo del Halcón con la borrachera', () => {
    expect(
      perfectShotRewards({
        perfect: true,
        classId: 'paladin',
        passiveMultiplier: 0.55,
      }),
    ).toEqual({ xp: 3, mana: 10 });
  });
});

describe('corrección del último cigarrillo', () => {
  it('recupera todos los efectos registrados por la versión nueva', () => {
    expect(
      smokeUndoEffects({
        d: 0,
        p: true,
        x: 8,
        m: 20,
        h: 3,
        r: true,
        sh: true,
      }),
    ).toEqual({
      damage: 0,
      perfect: true,
      xp: 8,
      mana: 20,
      healing: 3,
      restoreRoots: true,
      restoreShield: true,
    });
  });

  it('mantiene compatibilidad con registros antiguos', () => {
    expect(smokeUndoEffects(8)).toMatchObject({
      damage: 8,
      perfect: false,
      mana: 0,
    });
    expect(smokeUndoEffects({ d: 0, p: true, x: 4 })).toMatchObject({
      perfect: true,
      xp: 4,
      mana: 10,
    });
  });
});
