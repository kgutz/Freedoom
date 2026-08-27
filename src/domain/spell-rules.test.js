import { describe, expect, it } from 'vitest';
import {
  castSpellEffect,
  completeLevelEightHabitChallenge,
  levelEightSpellAvailability,
  levelTwoSpellAvailability,
  ultimateHabitReward,
} from './spell-rules.js';

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
  it('cierra el reto de nivel 8 al completar los hábitos y habilita el siguiente uso',()=>{
    const started=cast(spell('certero',{
      lvl:8,cost:45,modern:true,hpCost:10,habitChallenge:true,
    }),{
      game:{hp:100,mp:200,buffs:{}},selectedHabitIds:['a','b'],
    });
    const first=completeLevelEightHabitChallenge({
      progress:started.game.powerProgress,habitId:'a',today:'2026-07-26',completedAt:1_050_000,
    });
    expect(first).toMatchObject({advanced:true,completed:false,completedCount:1,target:2});
    expect(first.progress.habitChallenge.completedIds).toEqual(['a']);
    const second=completeLevelEightHabitChallenge({
      progress:first.progress,habitId:'b',today:'2026-07-26',completedAt:1_060_000,
    });
    expect(second).toMatchObject({advanced:true,completed:true,completedCount:2,target:2});
    expect(second.progress.habitChallenge).toMatchObject({completedIds:['a','b'],completedAt:1_060_000});
    expect(second.progress.challengeDayUses['2026-07-26:certero'].lastCompletedAt).toBe(1_060_000);
    expect(cast(spell('certero',{
      lvl:8,cost:45,modern:true,hpCost:10,habitChallenge:true,
    }),{
      game:{...started.game,mp:200,powerProgress:second.progress},
      nowTimestamp:1_120_001,selectedHabitIds:['c','d'],
    })).toMatchObject({ok:true,dailyUses:2});
  });

  it.each(['muro','certero','ceniza','regen'])('comparte la limpieza del reto completado para %s',(spellId)=>{
    const progress={
      habitChallenge:{spellId,habitIds:['a','b'],completedIds:['a'],day:'2026-07-26',week:3},
      challengeDayUses:{[`2026-07-26:${spellId}`]:{count:1,lastUsedAt:1_000_000,lastCompletedAt:0}},
    };
    const result=completeLevelEightHabitChallenge({progress,habitId:'b',today:'2026-07-26',completedAt:1_100_000});
    expect(result.completed).toBe(true);
    expect(result.progress.habitChallenge).toMatchObject({completedIds:['a','b'],completedAt:1_100_000});
    expect(result.progress.challengeDayUses[`2026-07-26:${spellId}`].lastCompletedAt).toBe(1_100_000);
  });

  it('solo avanza el reto automático cuando el hábito queda realmente completado',()=>{
    const progress={habitChallenge:{spellId:'ceniza',habitIds:[],autoNextHabitCount:2,completedIds:[],day:'2026-07-26'}};
    const first=completeLevelEightHabitChallenge({progress,habitId:'a',today:'2026-07-26'});
    const duplicate=completeLevelEightHabitChallenge({progress:first.progress,habitId:'a',today:'2026-07-26'});
    expect(first).toMatchObject({advanced:true,completed:false});
    expect(duplicate).toMatchObject({advanced:false,completed:false});
  });

  it('recupera una partida antigua cuyo segundo hábito ya estaba completado',()=>{
    const progress={
      challengeDayUses:{'2026-08-26:certero':{count:1,lastUsedAt:1_787_737_244_349,lastCompletedAt:0}},
      habitChallenge:{
        spellId:'certero',habitIds:['agua','pasos'],completedIds:['agua'],day:'2026-08-26',week:3,
      },
    };
    const recovered=completeLevelEightHabitChallenge({
      progress,habitId:'pasos',today:'2026-08-26',completedAt:0,
    });
    expect(recovered).toMatchObject({advanced:true,completed:true,spellId:'certero'});
    expect(recovered.progress.habitChallenge).toMatchObject({completedIds:['agua','pasos'],completedAt:0});
    expect(recovered.progress.challengeDayUses['2026-08-26:certero']).toEqual({
      count:1,lastUsedAt:1_787_737_244_349,lastCompletedAt:0,
    });
    expect(levelEightSpellAvailability({
      game:{powerProgress:recovered.progress},spellId:'certero',today:'2026-08-26',nowTimestamp:1_787_743_600_000,
    })).toMatchObject({challengeActive:false,remainingUses:1,cooldownRemainingMs:0});
  });

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

  it('aplica tres segundos de cooldown a todas las activas de nivel 2', () => {
    const first = cast(spell('luz'));
    expect(first).toMatchObject({ ok: true, cooldownUntil: 1_003_000 });
    expect(first.game.powerProgress.spellCooldowns.luz).toBe(1_003_000);
    expect(cast(spell('luz'), {
      game: { ...first.game, mp: 100 },
      nowTimestamp: 1_001_000,
    })).toMatchObject({
      ok: false,
      reason: 'spell-cooldown',
      cooldownRemainingMs: 2_000,
    });
    expect(cast(spell('luz'), {
      game: { ...first.game, mp: 100 },
      nowTimestamp: 1_003_001,
    }).ok).toBe(true);
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

  it('crea el reto diario de dos hábitos y cobra vida y maná',()=>{
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
    expect(result.game.powerProgress.challengeDayUses['2026-07-26:certero']).toEqual({
      count:1,lastUsedAt:1_000_000,lastCompletedAt:0,
    });
  });

  it('permite dos retos diarios y empieza el cooldown al completar el primero',()=>{
    const selectedSpell=spell('certero',{
      lvl:8,cost:45,modern:true,hpCost:10,habitChallenge:true,
    });
    const first=cast(selectedSpell,{
      game:{hp:100,mp:200,buffs:{}},selectedHabitIds:['a','b'],
    });
    expect(cast(selectedSpell,{
      game:first.game,nowTimestamp:1_120_000,selectedHabitIds:['c','d'],
    })).toMatchObject({ok:false,reason:'challenge-active'});
    const completedGame={
      ...first.game,
      mp:200,
      powerProgress:{
        ...first.game.powerProgress,
        habitChallenge:{...first.game.powerProgress.habitChallenge,completedIds:['a','b'],coinRewarded:true},
        challengeDayUses:{
          '2026-07-26:certero':{count:1,lastUsedAt:1_000_000,lastCompletedAt:1_120_000},
        },
      },
    };
    expect(cast(selectedSpell,{
      game:completedGame,nowTimestamp:1_150_000,selectedHabitIds:['c','d'],
    })).toMatchObject({ok:false,reason:'challenge-cooldown',cooldownRemainingMs:30_000});
    const second=cast(selectedSpell,{
      game:completedGame,nowTimestamp:1_180_001,selectedHabitIds:['c','d'],
    });
    expect(second).toMatchObject({ok:true,dailyUses:2});
    expect(cast(selectedSpell,{
      game:{...second.game,mp:200},nowTimestamp:1_300_000,selectedHabitIds:['e','f'],
    })).toMatchObject({ok:false,reason:'challenge-used'});
    expect(cast(selectedSpell,{
      game:{...second.game,mp:200},today:'2026-07-27',selectedHabitIds:['a','b'],
    }).ok).toBe(true);
  });

  it('comparte los dos usos diarios de nivel 8 entre clases',()=>{
    const paladinSpell=spell('certero',{
      lvl:8,cost:45,modern:true,hpCost:10,habitChallenge:true,
    });
    const knightSpell=spell('muro',{
      lvl:8,cost:40,modern:true,hpCost:10,habitChallenge:true,
    });
    const first=cast(paladinSpell,{
      game:{hp:100,mp:250,buffs:{}},selectedHabitIds:['a','b'],
    });
    const firstCompleted={
      ...first.game,
      mp:250,
      powerProgress:{
        ...first.game.powerProgress,
        habitChallenge:{...first.game.powerProgress.habitChallenge,completedIds:['a','b'],coinRewarded:true},
        challengeDayUses:{
          ...first.game.powerProgress.challengeDayUses,
          '2026-07-26:level-8':{count:1,lastUsedAt:1_000_000,lastCompletedAt:1_060_000},
        },
      },
    };
    const second=cast(knightSpell,{
      game:firstCompleted,nowTimestamp:1_120_001,selectedHabitIds:['c','d'],
    });
    expect(second).toMatchObject({ok:true,dailyUses:2});
    expect(levelEightSpellAvailability({
      game:second.game,spellId:'regen',today:'2026-07-26',nowTimestamp:1_300_000,
    })).toMatchObject({count:2,remainingUses:0,exhausted:true});
  });

  it('mantiene el reto y su cooldown de nivel 8 al cambiar de clase',()=>{
    const activeGame={powerProgress:{
      habitChallenge:{spellId:'certero',habitIds:['a','b'],completedIds:['a'],day:'2026-07-26'},
      challengeDayUses:{'2026-07-26:level-8':{count:1,lastUsedAt:1_000_000,lastCompletedAt:0}},
    }};
    expect(levelEightSpellAvailability({
      game:activeGame,spellId:'muro',today:'2026-07-26',nowTimestamp:1_010_000,
    })).toMatchObject({challengeActive:true,count:1});

    const completedGame={powerProgress:{
      habitChallenge:{...activeGame.powerProgress.habitChallenge,completedIds:['a','b'],completedAt:1_020_000},
      challengeDayUses:{'2026-07-26:level-8':{count:1,lastUsedAt:1_000_000,lastCompletedAt:1_020_000}},
    }};
    expect(levelEightSpellAvailability({
      game:completedGame,spellId:'regen',today:'2026-07-26',nowTimestamp:1_050_000,
    })).toMatchObject({challengeActive:false,cooldownRemainingMs:30_000});
  });

  it('comparte el cooldown de nivel 2 entre clases',()=>{
    const paladin=cast(spell('luz',{lvl:2}),{nowTimestamp:1_000_000});
    expect(levelTwoSpellAvailability({
      game:paladin.game,spellId:'grito',nowTimestamp:1_001_000,
    })).toMatchObject({cooldownRemainingMs:2_000,cooldownUntil:1_003_000});
    expect(cast(spell('grito',{lvl:2}),{
      game:{...paladin.game,mp:100},nowTimestamp:1_001_000,
    })).toMatchObject({ok:false,reason:'spell-cooldown'});
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

  it('da a las cuatro ultis modernas el mismo reto de tres hábitos',()=>{
    for(const id of ['bastion','juicio','alma','renacer']){
      const result=cast(spell(id,{
        lvl:14,cost:70,ulti:true,modern:true,habitChallenge:true,
      }),{
        level:14,
        game:{hp:100,mp:100,buffs:{}},
        selectedHabitIds:['a','b','c'],
      });

      expect(result).toMatchObject({ok:true,spentMana:70});
      expect(result.game).toMatchObject({
        mp:30,
        powerProgress:{
          ultimateWeekUses:{3:1},
          ultimateDayUses:{'2026-07-26':1},
          ultimateChallenge:{
            spellId:id,
            habitIds:['a','b','c'],
            completedIds:[],
            day:'2026-07-26',
            week:3,
            rewarded:false,
          },
        },
      });
    }
  });

  it('exige tres hábitos para activar una ulti moderna',()=>{
    expect(cast(spell('juicio',{
      lvl:14,cost:70,ulti:true,modern:true,habitChallenge:true,
    }),{
      level:14,
      selectedHabitIds:['a','b'],
    })).toMatchObject({ok:false,reason:'habits',requiredHabits:3});
  });

  it('permite una ulti al día, mantiene dos por semana y exige completar la primera',()=>{
    const selectedSpell=spell('juicio',{
      lvl:14,cost:70,ulti:true,modern:true,habitChallenge:true,
    });
    expect(cast(selectedSpell,{
      level:14,
      game:{hp:100,mp:100,buffs:{},powerProgress:{
        ultimateWeekUses:{3:1},
        ultimateChallenge:{week:3,day:'2026-07-26',rewarded:false},
      }},
      selectedHabitIds:['a','b','c'],
    })).toMatchObject({ok:false,reason:'ultimate-active'});
    const second=cast(selectedSpell,{
      level:14,
      game:{hp:100,mp:100,buffs:{},powerProgress:{
        ultimateWeekUses:{3:1},
        ultimateChallenge:{week:3,day:'2026-07-26',rewarded:true},
      }},
      selectedHabitIds:['a','b','c'],
    });
    expect(second.ok).toBe(true);
    expect(second.game.powerProgress.ultimateWeekUses[3]).toBe(2);
    expect(second.game.powerProgress.ultimateDayUses['2026-07-26']).toBe(1);
    expect(cast(spell('renacer',{
      lvl:14,cost:70,ulti:true,modern:true,habitChallenge:true,
    }),{
      level:14,
      game:{...second.game,mp:100},
      selectedHabitIds:['d','e','f'],
    })).toMatchObject({ok:false,reason:'ultimate-daily-used'});
    expect(cast(selectedSpell,{
      level:14,today:'2026-07-27',
      game:{...second.game,mp:100},
      selectedHabitIds:['d','e','f'],
    })).toMatchObject({ok:false,reason:'ultimate-used'});
    expect(cast(selectedSpell,{
      level:14,currentWeek:4,today:'2026-08-02',
      game:{...second.game,mp:100},
      selectedHabitIds:['d','e','f'],
    }).ok).toBe(true);
  });

  it('reparte 40 XP y 20 de oro entre los tres hábitos de la ulti',()=>{
    const rewards=[1,2,3].map((completedCount)=>(
      ultimateHabitReward({completedCount,target:3})
    ));

    expect(rewards[0]).toEqual({xp:10,gold:4,completesChallenge:false});
    expect(rewards[1]).toEqual({xp:10,gold:4,completesChallenge:false});
    expect(rewards[2]).toEqual({xp:20,gold:12,completesChallenge:true});
    expect(rewards.reduce((total,reward)=>total+reward.xp,0)).toBe(40);
    expect(rewards.reduce((total,reward)=>total+reward.gold,0)).toBe(20);
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
