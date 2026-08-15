import { describe, expect, it } from 'vitest';
import {
  activeSpellStatus,
  createHeroModel,
  didHeroLevelUp,
  heroEnergyModel,
  renderHeroView,
  renderSkillsView,
  spriteImage,
} from './hero-view.js';
import { BOSSES, BOSS_LORE } from '../data/game-data.js';

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
  it.each([
    [0.1, 0],
    [0.35, 1],
    [0.6, 2],
    [0.85, 3],
    [0.98, 3],
  ])('convierte %s de progreso real en el estado de energía %s', (progress, stage) => {
    expect(heroEnergyModel({ progress, classId: 'paladin' })).toMatchObject({
      progress,
      percent: Math.round(progress * 100),
      stage,
      classId: 'paladin',
      levelUp: false,
    });
  });

  it('normaliza el progreso y comparte el modelo entre las cuatro clases', () => {
    expect(['knight', 'paladin', 'sorcerer', 'druid'].map((classId) => (
      heroEnergyModel({ progress: 2, classId }).classId
    ))).toEqual(['knight', 'paladin', 'sorcerer', 'druid']);
    expect(heroEnergyModel({ progress: -1, classId: 'unknown' })).toMatchObject({
      progress: 0,
      classId: 'paladin',
    });
  });

  it('solo detecta una subida frente a un nivel anterior válido', () => {
    expect(didHeroLevelUp(null, 2)).toBe(false);
    expect(didHeroLevelUp(2, 2)).toBe(false);
    expect(didHeroLevelUp(3, 2)).toBe(false);
    expect(didHeroLevelUp(2, 3)).toBe(true);
  });

  it('describe temporizadores, cargas y efectos diarios de las activas', () => {
    const now = new Date(2026, 6, 26, 12).getTime();
    expect(activeSpellStatus({
      spellId: 'regen',
      game: { buffs: { regenUntil: now + 61 * 60_000 } },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBe('61m');
    expect(activeSpellStatus({
      spellId: 'muro',
      game: { buffs: { shield: 2 } },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBe('×2');
    expect(activeSpellStatus({
      spellId: 'juicio',
      game: { buffs: {}, judgmentDays: ['2026-07-26'] },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBe('HOY');
    expect(activeSpellStatus({
      spellId: 'balsamo',
      game: { buffs: {} },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBeNull();
  });

  it('incluye una sinopsis para cada jefe de la campaña', () => {
    expect(BOSS_LORE).toHaveLength(BOSSES.length);
    expect(BOSS_LORE.every((synopsis) => synopsis.length > 60)).toBe(true);
  });

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
    expect(model.chips).toEqual(['🍺 25% · 41m']);
    expect(model.skillEffects).toEqual([{
      spellId: 'certero',
      icon: 'certero',
      name: 'Ojo Certero',
      remaining: '2m',
    }]);
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
    expect(model.skillEffects).toEqual([]);
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

  it('permite volver del selector de cambio de clase sin gastar recursos', () => {
    const heroContent = { innerHTML: '' };
    renderHeroView({
      document: { getElementById: () => heroContent },
      ...base({ game: { cls: null } }),
      classChange: true,
      currentClass: 'paladin',
    });

    expect(heroContent.innerHTML).toContain('id="classChangeBack"');
    expect(heroContent.innerHTML).toContain('solo se gastará cuando confirmes');
    expect(heroContent.innerHTML).not.toContain('cls-info-badge');
    expect(heroContent.innerHTML).toContain('data-cls="paladin"');
    expect(heroContent.innerHTML).toContain('current-class');
    expect(heroContent.innerHTML).not.toContain('CLASE ACTUAL');
  });

  it('puede renderizar el mismo libro de habilidades dentro del cambio de clase', () => {
    const classChangeSkills = { innerHTML: '' };
    renderSkillsView({
      document: {
        getElementById(id) {
          return id === 'classChangeSkills' ? classChangeSkills : null;
        },
      },
      classId: 'paladin',
      level: 5,
      intoxication: { level: 45, remainingMinutes: 52 },
      config: { journeyMode: 'reduction' },
      targetId: 'classChangeSkills',
    });

    expect(classChangeSkills.innerHTML).toContain('Pasivas — Arquero Sagrado');
    expect(classChangeSkills.innerHTML).toContain('Ojo del Halcón');
    expect(classChangeSkills.innerHTML).toContain('Hechizos — Arquero Sagrado');
    expect(classChangeSkills.innerHTML).toContain('Ojo Certero');
    expect(classChangeSkills.innerHTML.indexOf('Hechizos — Arquero Sagrado'))
      .toBeLessThan(classChangeSkills.innerHTML.indexOf('Pasivas — Arquero Sagrado'));
    expect(classChangeSkills.innerHTML).not.toContain('sprite-svg');
    expect(classChangeSkills.innerHTML).not.toContain('Borrachera');
    expect(classChangeSkills.innerHTML).not.toContain('45%');
  });

  it('mueve los últimos golpes al panel informativo del jefe', () => {
    const heroContent = { innerHTML: '' };
    const bossHistoryBody = { innerHTML: '' };
    const heroSkillsModalBody = { innerHTML: '' };
    const document = {
      getElementById(id) {
        if (id === 'heroContent') return heroContent;
        if (id === 'bossHistoryBody') return bossHistoryBody;
        if (id === 'heroSkillsModalBody') return heroSkillsModalBody;
        return null;
      },
    };

    renderHeroView({
      document,
      ...base({
        game: {
          ...base().game,
          name: 'Farenheil',
          buffs: { certeroUntil: new Date(2026, 6, 26, 12, 30).getTime() },
        },
        stats: {
          ...base().stats,
          xp: 560,
          prog: 0.85,
          nextTh: 875,
        },
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
      levelUp: true,
    });

    expect(heroContent.innerHTML).toContain('id="bossInfoBtn"');
    expect(heroContent.innerHTML).toContain('data-open-current-boss-medal="1"');
    expect(heroContent.innerHTML).toContain('aria-label="Abrir medallón de Espectro"');
    expect(heroContent.innerHTML).toContain('<div class="rango">Paladin</div>');
    expect(heroContent.innerHTML).toContain('data-open-hero-skills');
    expect(heroContent.innerHTML.indexOf('data-open-inventory'))
      .toBeLessThan(heroContent.innerHTML.indexOf('data-open-hero-skills'));
    expect(heroContent.innerHTML).not.toContain('id="heroSkillsCard"');
    expect(heroContent.innerHTML).toContain('aria-label="Abrir habilidades"');
    expect(heroContent.innerHTML).not.toContain('data-cast=');
    expect(heroSkillsModalBody.innerHTML).not.toContain('id="skInfoBtn"');
    expect(heroSkillsModalBody.innerHTML).toContain('data-cast=');
    expect(heroSkillsModalBody.innerHTML.indexOf('Activas'))
      .toBeLessThan(heroSkillsModalBody.innerHTML.indexOf('Pasivas'));
    expect(heroSkillsModalBody.innerHTML).toContain('spell-effect-active');
    expect(heroSkillsModalBody.innerHTML).toContain('>30m</span>');
    expect((heroSkillsModalBody.innerHTML.match(/passive-effect-active/g) || []).length).toBe(2);
    expect(heroContent.innerHTML).toContain('class="skill-buff-icon"');
    expect(heroContent.innerHTML).toContain('Ojo Certero: 30m restantes');
    expect(heroContent.innerHTML).toContain('effect_icons/paladin_effect_certero.png');
    expect(heroContent.innerHTML).toContain('hero-energy--paladin');
    expect(heroContent.innerHTML).toContain('hero-energy--stage-3');
    expect(heroContent.innerHTML).toContain('data-xp-energy="85"');
    expect(heroContent.innerHTML).toContain('is-leveling-up');
    expect(heroContent.innerHTML).not.toContain('sprite-aura');
    expect(heroContent.innerHTML).toContain('<div class="nombre">Farenheil</div>');
    expect(heroContent.innerHTML).toContain('class="hero-summary"');
    expect(heroContent.innerHTML).not.toContain('Jefes:');
    expect(heroContent.innerHTML).toContain('Disparos perfectos hoy:');
    expect(heroContent.innerHTML).not.toContain('Últimos golpes');
    expect(bossHistoryBody.innerHTML).toContain('Últimos golpes');
    expect(bossHistoryBody.innerHTML).toContain('−27 HP');
    expect(bossHistoryBody.innerHTML).toContain('Medallones de victoria · 1');
    expect(bossHistoryBody.innerHTML).not.toContain('1 / 20');
    expect(bossHistoryBody.innerHTML).toContain('data-share-boss="0"');
    expect(bossHistoryBody.innerHTML).not.toContain('data-share-boss="1"');
    expect(bossHistoryBody.innerHTML).toContain('data-open-boss-medal="0"');
    expect(bossHistoryBody.innerHTML).toContain('data-open-boss-medal="1"');
    expect(bossHistoryBody.innerHTML).not.toContain('data-open-boss-medal="2"');
    expect(bossHistoryBody.innerHTML).toContain('boss_medal_locked.png');
    expect(bossHistoryBody.innerHTML).toContain('boss_02_espectro.png');
    expect(bossHistoryBody.innerHTML).toContain('EN COMBATE');
    expect(heroContent.innerHTML).toContain('Jefes derrotados: <b>1</b> de <b>?</b> · ¡Aún quedan jefes por derrotar!');
    expect(heroContent.innerHTML).not.toContain('de <b>20</b>');
  });

  it('oculta el total futuro y muestra una sola incógnita', () => {
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

    expect(bossHistoryBody.innerHTML).toContain('Medallones de victoria · 1');
    expect(bossHistoryBody.innerHTML).not.toContain('1 / 6');
    expect((bossHistoryBody.innerHTML.match(/class="boss-medal /g) || []).length).toBe(3);
    expect((bossHistoryBody.innerHTML.match(/boss_medal_locked.png/g) || []).length).toBe(1);
  });
});
