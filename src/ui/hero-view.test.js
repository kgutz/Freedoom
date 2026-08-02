import { describe, expect, it } from 'vitest';
import {
  createHeroModel,
  renderHeroView,
  spriteImage,
} from './hero-view.js';

const base = (overrides = {}) => ({
  now: new Date(2026, 6, 26, 12),
  config: { wakeTime: '07:00', startLimit: 20 },
  days: { '2026-07-26': { c: 2, s: 1 } },
  game: { cls: 'paladin', hp: 75, mp: 40, buffs: {} },
  stats: {
    lvl: 5,
    tier: 1,
    maxHp: 100,
    maxMp: 100,
    streak: 3,
    bossesDown: 1,
  },
  boss: {
    pips: [],
    bossNum: 2,
    slug: 'espectro',
    won: false,
    hp: 62,
    maxHp: 100,
    hpPercent: 62,
  },
  armor: 1,
  ...overrides,
});

describe('modelo de Héroe', () => {
  it('muestra selección mientras no hay clase', () => {
    expect(createHeroModel(base({ game: { cls: null } }))).toEqual({
      selection: true,
    });
  });

  it('calcula humor, barras y efectos activos', () => {
    const now = new Date(2026, 6, 26, 12);
    const model = createHeroModel(
      base({
        now,
        game: {
          cls: 'paladin',
          hp: 75,
          mp: 40,
          buffs: { shield: 2, certeroUntil: now.getTime() + 120_000 },
        },
        intoxication: { level: 25, remainingMinutes: 41 },
      }),
    );

    expect(model).toMatchObject({
      selection: false,
      mood: 'happy',
      hpPercent: 75,
      manaPercent: 40,
      perfectToday: 1,
      boss: { hp: 62, maxHp: 100, hpPercent: 62 },
    });
    expect(model.chips).toEqual(['🛡×2', '🎯 2m', '🍺 25% · 41m']);
  });

  it('muestra el pack de habilidades sin fumar y sus efectos activos',()=>{
    const model=createHeroModel(base({
      config:{wakeTime:'07:00',startLimit:21,journeyMode:'smoke_free'},
      game:{
        cls:'paladin',hp:75,mp:40,
        buffs:{habitFocusCharges:2},
        pestXpDays:['2026-07-26'],
      },
    }));

    expect(model.classData.pas[0].d).toContain('55 XP');
    expect(model.classData.pas[0].d).not.toContain('disparos perfectos');
    expect(model.chips).toContain('🎯×2 hábitos');
    expect(model.chips).toContain('☠ +20 XP hoy');
  });

  it('mantiene dormido al héroe antes de levantarse', () => {
    const model = createHeroModel(
      base({
        now: new Date(2026, 6, 26, 6, 30),
        days: {},
      }),
    );

    expect(model.mood).toBe('sleep');
  });

  it('reutiliza el sprite feliz como respaldo para estados sin arte', () => {
    expect(spriteImage('paladin', 'worried')).toContain(
      'sprites/paladin_happy.png',
    );
  });

  it('mueve los últimos golpes al panel informativo del jefe', () => {
    const heroContent = { innerHTML: '' };
    const bossHistoryBody = { innerHTML: '' };
    const document = {
      getElementById(id) {
        if (id === 'heroContent') return heroContent;
        if (id === 'bossHistoryBody') return bossHistoryBody;
        return null;
      },
    };

    renderHeroView({
      document,
      ...base({
        boss: {
          ...base().boss,
          name: 'Espectro',
          lim: 20,
          pips: [],
          completedDays: 1,
          requiredDays: 6,
          damageThisWeek: 27,
          damageToday: 27,
          breakdownToday: {
            completion: 25,
            margin: 2,
            perfect: 0,
            zero: 0,
          },
          recentHits: [
            {
              key: '2026-07-26',
              completion: 25,
              margin: 2,
              perfect: 0,
              zero: 0,
              total: 27,
            },
          ],
        },
      }),
      intoxication: null,
    });

    expect(heroContent.innerHTML).toContain('id="bossInfoBtn"');
    expect(heroContent.innerHTML).not.toContain('Últimos golpes');
    expect(bossHistoryBody.innerHTML).toContain('Últimos golpes');
    expect(bossHistoryBody.innerHTML).toContain('−27 HP');
    expect(bossHistoryBody.innerHTML).toContain('Medallones de victoria · 1 / 20');
    expect(bossHistoryBody.innerHTML).toContain('data-share-boss="0"');
    expect(bossHistoryBody.innerHTML).not.toContain('data-share-boss="1"');
    expect(bossHistoryBody.innerHTML).toContain('boss_medal_locked.png');
    expect(bossHistoryBody.innerHTML).toContain('boss_02_espectro.png');
    expect(bossHistoryBody.innerHTML).toContain('EN COMBATE');
  });

  it('muestra tantos medallones como semanas tenga el plan', () => {
    const heroContent = { innerHTML: '' };
    const bossHistoryBody = { innerHTML: '' };
    const document = {
      getElementById(id) {
        if (id === 'heroContent') return heroContent;
        if (id === 'bossHistoryBody') return bossHistoryBody;
        return null;
      },
    };

    renderHeroView({
      document,
      ...base({
        config: { wakeTime: '07:00', startLimit: 6 },
        boss: {
          ...base().boss,
          name: 'Espectro Gris',
          completedDays: 0,
          requiredDays: 6,
          damageThisWeek: 0,
          damageToday: 0,
          breakdownToday: {},
          recentHits: [],
        },
      }),
      intoxication: null,
    });

    expect(bossHistoryBody.innerHTML).toContain('Medallones de victoria · 1 / 6');
    expect((bossHistoryBody.innerHTML.match(/class="boss-medal /g) || []).length).toBe(6);
  });
});
