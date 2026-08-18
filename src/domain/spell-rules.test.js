import { describe, expect, it } from 'vitest';
import { castSpellEffect } from './spell-rules.js';

const spell = (id, overrides = {}) => ({
  id,
  lvl: 2,
  cost: 30,
  ...overrides,
});

const cast = (selectedSpell, overrides = {}) =>
  castSpellEffect({
    game: { cls: 'paladin', hp: 70, mp: 100, buffs: {} },
    spell: selectedSpell,
    level: 12,
    currentWeek: 3,
    today: '2026-07-26',
    nowTimestamp: 1_000_000,
    maxHp: 100,
    ...overrides,
  });

describe('validación de hechizos', () => {
  it('rechaza nivel insuficiente, maná insuficiente y ulti repetida', () => {
    expect(
      cast(spell('muro', { lvl: 8 }), { level: 7 }),
    ).toMatchObject({ ok: false, reason: 'level', requiredLevel: 8 });
    expect(
      cast(spell('muro', { cost: 40 }), {
        game: { hp: 70, mp: 39, buffs: {} },
      }),
    ).toMatchObject({ ok: false, reason: 'mana', requiredMana: 40 });
    expect(
      cast(spell('bastion', { ulti: true }), {
        game: { hp: 70, mp: 100, buffs: {}, ultiW: 3 },
      }),
    ).toMatchObject({ ok: false, reason: 'ultimate-used' });
  });

  it('hace fallar una activa por borrachera, gasta maná y conserva la ulti', () => {
    const result = cast(spell('bastion', { ulti: true, cost: 30 }), {
      game: { hp: 70, mp: 100, buffs: {} },
      activeFailureChance: 0.45,
      randomValue: 0.2,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'intoxicated',
      spentMana: 30,
      game: { mp: 70 },
    });
    expect(result.game.ultiW).toBeUndefined();
    expect(result.game.buffs.bastion).toBeUndefined();
  });

  it('permite lanzar la activa cuando supera la tirada de fallo', () => {
    const result = cast(spell('muro'), {
      activeFailureChance: 0.45,
      randomValue: 0.5,
    });

    expect(result.ok).toBe(true);
    expect(result.game.buffs.shield).toBe(2);
  });
});

describe('efectos temporales y defensivos', () => {
  it('activa escudos, peste y regeneración', () => {
    expect(cast(spell('muro')).game).toMatchObject({
      mp: 70,
      buffs: { shield: 2 },
    });
    expect(cast(spell('peste')).game.buffs.pesteDay).toBe('2026-07-26');
    expect(cast(spell('regen')).game.buffs.regenUntil).toBe(
      1_000_000 + 2 * 3_600_000,
    );
  });

  it('amplía Maldición de Ceniza a tres horas desde nivel 12', () => {
    const result = cast(spell('ceniza'));

    expect(result.durationHours).toBe(3);
    expect(result.game.buffs.cenizaUntil).toBe(
      1_000_000 + 3 * 3_600_000,
    );
  });

  it('reduce Filacteria proporcionalmente por borrachera', () => {
    const result = cast(spell('ceniza'), {
      passiveMultiplier: 0.55,
    });

    expect(result.durationHours).toBe(2.55);
  });

  it('adapta Ojo Certero y Peste al Antojo al camino sin fumar',()=>{
    const focus=cast(spell('certero'),{smokeFreeMode:true});
    const plague=cast(spell('peste'),{smokeFreeMode:true});

    expect(focus.game.buffs.habitFocusCharges).toBe(2);
    expect(focus.game.buffs.certeroUntil).toBeUndefined();
    expect(plague.game.pestXpDays).toEqual(['2026-07-26']);
    expect(plague.game.buffs.pesteDay).toBeUndefined();
  });

  it('no duplica el bonus diario de Peste al Antojo',()=>{
    const result=cast(spell('peste'),{
      smokeFreeMode:true,
      game:{hp:70,mp:100,buffs:{},pestXpDays:['2026-07-26']},
    });
    expect(result.game.pestXpDays).toEqual(['2026-07-26']);
  });
});

describe('curación y habilidades definitivas', () => {
  it('escala las curaciones modernas con la vida máxima',()=>{
    const knight=cast(spell('grito',{modern:true}),{
      game:{hp:100,mp:100,buffs:{}},maxHp:200,
    });
    const sorcerer=cast(spell('peste',{modern:true,cost:45}),{
      game:{hp:50,mp:100,buffs:{}},maxHp:200,
    });
    expect(knight.game.hp).toBe(120);
    expect(knight.game.buffs.knightGuard).toEqual({amount:2,day:'2026-07-26'});
    expect(sorcerer.game.hp).toBe(66);
  });

  it('crea el reto semanal de dos hábitos y cobra vida y maná',()=>{
    const result=cast(spell('certero',{
      lvl:8,cost:45,modern:true,hpCost:10,habitChallenge:true,
    }),{
      game:{hp:80,mp:100,buffs:{}},
      selectedHabitIds:['habit-a','habit-b'],
    });
    expect(result.game).toMatchObject({hp:70,mp:55});
    expect(result.game.powerProgress.habitChallenge).toMatchObject({
      spellId:'certero',habitIds:['habit-a','habit-b'],completedIds:[],week:3,
    });
    expect(result.game.powerProgress.challengeWeekUses['3:certero']).toBe(true);
  });

  it('Maldición de Ceniza espera los dos primeros hábitos completados, no los primeros de la lista',()=>{
    const result=cast(spell('ceniza',{
      lvl:8,cost:50,modern:true,habitChallenge:true,autoHabitChallenge:true,
    }),{game:{hp:100,mp:100,buffs:{}}});
    expect(result.game.powerProgress.habitChallenge).toMatchObject({
      spellId:'ceniza',habitIds:[],autoNextHabitCount:2,completedIds:[],week:3,
    });
  });

  it('impide que el sacrificio de una activa moderna deje al héroe sin vida',()=>{
    expect(cast(spell('muro',{
      lvl:8,cost:40,modern:true,hpCost:10,habitChallenge:true,
    }),{
      game:{hp:10,mp:100,buffs:{}},selectedHabitIds:['a','b'],
    })).toMatchObject({ok:false,reason:'health'});
  });

  it('limita la curación a la vida máxima', () => {
    const result = cast(spell('grito'), {
      game: { hp: 95, mp: 100, buffs: {} },
    });

    expect(result.game.hp).toBe(100);
    expect(result.healing).toBe(5);
  });

  it('Robar Alma convierte todo el maná y marca la ulti semanal', () => {
    const result = cast(spell('alma', { ulti: true, cost: 40 }), {
      game: { hp: 40, mp: 80, buffs: {} },
    });

    expect(result).toMatchObject({ ok: true, spentMana: 80, healing: 40 });
    expect(result.game).toMatchObject({ hp: 80, mp: 0, ultiW: 3 });
  });

  it('Juicio Divino no duplica el día y Renacer queda activo', () => {
    const judgment = cast(spell('juicio', { ulti: true }), {
      game: {
        hp: 70,
        mp: 100,
        buffs: {},
        judgmentDays: ['2026-07-26'],
      },
    });
    const rebirth = cast(spell('renacer', { ulti: true }));

    expect(judgment.game.judgmentDays).toEqual(['2026-07-26']);
    expect(judgment.game.ultiW).toBe(3);
    expect(rebirth.game.buffs.renacer).toBe(true);
  });
});
