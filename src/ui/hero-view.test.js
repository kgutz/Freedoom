import { describe, expect, it } from 'vitest';
import {
  activeSpellStatus,
  bossMedalCombatHistoryMarkup,
  cooldownStatusLabel,
  createHeroModel,
  didHeroLevelUp,
  heroEnergyBaseline,
  heroEnergyModel,
  nextLogicalDayStart,
  renderHeroView,
  renderSkillsView,
  spellUnavailableAfterUse,
  spriteImage,
} from './hero-view.js';
import { BOSSES, BOSS_LORE } from '../data/game-data.js';

describe('historial del medallón de jefe', () => {
  it('muestra únicamente los intentos del jefe seleccionado', () => {
    const html = bossMedalCombatHistoryMarkup([
      { week: 0, bossIndex: 0, won: false, heroDamage: 90, bossDamage: 30, manaDamage: 20 },
      { week: 1, bossIndex: 0, won: true, heroDamage: 150, bossDamage: 0, manaDamage: 0, shielded: true },
      { week: 2, bossIndex: 1, won: true, heroDamage: 150, bossDamage: 12, manaDamage: 8 },
    ], 0);
    expect(html).toContain('2 INTENTOS');
    expect(html).toContain('INTENTO 1 · SEMANA 1');
    expect(html).toContain('INTENTO 2 · SEMANA 2');
    expect(html).toContain('VICTORIA');
    expect(html).toContain('DERROTA');
    expect(html).toContain('BLOQUEADO');
    expect(html).not.toContain('SEMANA 3');
  });

  it('explica que el combate actual todavía no está cerrado', () => {
    expect(bossMedalCombatHistoryMarkup([], 1, { inCombat: true }))
      .toContain('El combate actual sigue en curso');
  });
});

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

  it.each([
    [1, 0],
    [5, 0.18],
    [10, 0.34],
    [15, 0.5],
    [20, 0.66],
    [30, 0.66],
  ])('mantiene una energía base permanente en el nivel %s', (level, baseline) => {
    expect(heroEnergyBaseline(level)).toBe(baseline);
    expect(heroEnergyModel({ progress: 0, level, classId: 'knight' }))
      .toMatchObject({ baseline, energyProgress: baseline });
  });

  it('combina el hito permanente con la carga del nivel actual', () => {
    expect(heroEnergyModel({ progress: 0, level: 10, classId: 'paladin' }))
      .toMatchObject({ baseline: 0.34, energyPercent: 34, stage: 1 });
    expect(heroEnergyModel({ progress: 0.5, level: 10, classId: 'paladin' }))
      .toMatchObject({ baseline: 0.34, energyPercent: 67, stage: 2 });
    expect(heroEnergyModel({ progress: 1, level: 10, classId: 'paladin' }))
      .toMatchObject({ energyProgress: 1, energyPercent: 100, stage: 3 });
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
      game: { buffs: { balm: { until: now + 30 * 60_000 } } },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBe('30m');
    expect(activeSpellStatus({
      spellId: 'peste',
      game: { buffs: { pesteDay: '2026-07-26' } },
      nowTimestamp: now,
      today: '2026-07-26',
    })).toBeNull();
  });

  it('formatea el enfriamiento corto y el reinicio del siguiente día lógico', () => {
    expect(cooldownStatusLabel(30_000)).toBe('30s');
    expect(cooldownStatusLabel(15 * 60_000)).toBe('15m');
    expect(cooldownStatusLabel(15.2 * 3_600_000)).toBe('16h');
    expect(nextLogicalDayStart(new Date(2026, 6, 26, 12), '04:00'))
      .toBe(new Date(2026, 6, 27, 4).getTime());
  });

  it('muestra la Tinta Arcana junto al resto de recursos del héroe', () => {
    const heroContent = { innerHTML: '' };
    renderHeroView({
      document: { getElementById: (id) => id === 'heroContent' ? heroContent : null },
      ...base({
        lootState: { economy: { coins: 45, bossBlood: 1, arcaneFibers: 12, arcaneInks: 7 } },
        boss: {
          ...base().boss,
          completedDays: 0,
          requiredDays: 6,
          damageThisWeek: 0,
          damageToday: 0,
          breakdownToday: {},
          recentHits: [],
        },
      }),
    });

    expect(heroContent.innerHTML).toContain('hero-resource-wallet');
    expect(heroContent.innerHTML).toContain('resource-icon--arcane-ink');
    expect(heroContent.innerHTML).toContain('<b>7</b>');
  });

  it('muestra en gris y sobre el icono todos los poderes de nivel 8 en enfriamiento', () => {
    const now = new Date(2026, 6, 26, 12);
    const heroContent = { innerHTML: '' };
    const heroSkillsModalBody = { innerHTML: '' };
    renderHeroView({
      document: {
        getElementById(id) {
          if (id === 'heroContent') return heroContent;
          if (id === 'heroSkillsModalBody') return heroSkillsModalBody;
          return null;
        },
      },
      ...base({
        now,
        dayKey: '2026-07-26',
        config: { wakeTime: '07:00', startLimit: 20, dayStartTime: '04:00' },
        game: {
          ...base().game,
          powerProgress: {
            spellCooldowns: { luz: now.getTime() + 3_000 },
            challengeDayUses: {
              '2026-07-26:certero': {
                count: 1,
                lastCompletedAt: now.getTime() - 30_000,
              },
            },
          },
        },
        stats: { ...base().stats, lvl: 9 },
        boss: {
          ...base().boss,
          completedDays: 0,
          requiredDays: 6,
          damageThisWeek: 0,
          damageToday: 0,
          breakdownToday: {},
          recentHits: [],
        },
      }),
    });

    expect(heroContent.innerHTML).toContain('hero-skill-slot on spell-cooldown');
    expect(heroContent.innerHTML).toContain('data-cast="certero"');
    expect(heroContent.innerHTML).toContain('Luz Sanadora · Enfriamiento 3s');
    expect(heroContent.innerHTML).toContain('>3s</span>');
    expect(heroContent.innerHTML).toContain('data-cooldown-until=');
    expect(heroContent.innerHTML).toContain('>30s</span>');
    expect(heroContent.innerHTML).toContain('disabled');
    expect(heroSkillsModalBody.innerHTML).toContain('skill-box on spell-cooldown');
  });

  it('cuenta hasta el día siguiente después de agotar los dos usos diarios', () => {
    const now = new Date(2026, 6, 26, 12);
    const heroContent = { innerHTML: '' };
    renderHeroView({
      document: { getElementById: (id) => id === 'heroContent' ? heroContent : null },
      ...base({
        now,
        dayKey: '2026-07-26',
        config: { wakeTime: '07:00', startLimit: 20, dayStartTime: '04:00' },
        game: {
          ...base().game,
          powerProgress: {
            challengeDayUses: {
              '2026-07-26:certero': { count: 2, lastCompletedAt: now.getTime() },
            },
          },
        },
        stats: { ...base().stats, lvl: 9 },
        boss: {
          ...base().boss,
          completedDays: 0,
          requiredDays: 6,
          damageThisWeek: 0,
          damageToday: 0,
          breakdownToday: {},
          recentHits: [],
        },
      }),
    });

    expect(heroContent.innerHTML).toContain('hero-skill-slot on spell-cooldown');
    expect(heroContent.innerHTML).toContain('>16h</span>');
    expect(heroContent.innerHTML).not.toContain('hero-skill-used">HOY');
  });

  it('muestra la ulti en cooldown hasta el siguiente día después de usarla', () => {
    const now = new Date(2026, 6, 26, 12);
    const heroContent = { innerHTML: '' };
    const heroSkillsModalBody = { innerHTML: '' };
    renderHeroView({
      document: {
        getElementById(id) {
          if (id === 'heroContent') return heroContent;
          if (id === 'heroSkillsModalBody') return heroSkillsModalBody;
          return null;
        },
      },
      ...base({
        now,
        dayKey: '2026-07-26',
        config: { wakeTime: '07:00', startLimit: 20, dayStartTime: '04:00' },
        game: {
          ...base().game,
          powerProgress: { ultimateDayUses: { '2026-07-26': 1 } },
        },
        stats: { ...base().stats, lvl: 15 },
        boss: {
          ...base().boss,
          completedDays: 0,
          requiredDays: 6,
          damageThisWeek: 0,
          damageToday: 0,
          breakdownToday: {},
          recentHits: [],
        },
      }),
    });

    expect(heroContent.innerHTML).toContain('data-cast="juicio"');
    expect(heroContent.innerHTML).toContain('Juicio Divino · Enfriamiento 16h');
    expect(heroContent.innerHTML).toContain('>16h</span>');
    expect(heroContent.innerHTML).toContain('disabled');
    expect(heroSkillsModalBody.innerHTML).toContain('skill-box on ulti spell-cooldown');
  });

  it('apaga el reto completado y bloquea la habilidad tras dos usos diarios', () => {
    const now = new Date(2026, 6, 26, 12).getTime();
    const game = {
      powerProgress: {
        habitChallenge: {
          spellId: 'certero',
          habitIds: ['a', 'b'],
          completedIds: ['a', 'b'],
          day: '2026-07-26',
        },
        challengeDayUses: { '2026-07-26:certero': { count: 2, lastUsedAt: now, lastCompletedAt: now } },
      },
    };

    expect(activeSpellStatus({
      spellId: 'certero', game, nowTimestamp: now, today: '2026-07-26',
    })).toBeNull();
    expect(spellUnavailableAfterUse({
      ability: { id: 'certero', lvl: 8, habitChallenge: true }, game, currentWeek: 3, today: '2026-07-26',
    })).toBe(true);
    expect(spellUnavailableAfterUse({
      ability: { id: 'certero', lvl: 8, habitChallenge: true }, game, currentWeek: 3, today: '2026-07-27',
    })).toBe(false);
  });

  it('muestra el cooldown tras completar el primer reto en vez de mantener 2/2', () => {
    const now = new Date(2026, 6, 26, 12).getTime();
    const game = {
      powerProgress: {
        habitChallenge: {
          spellId: 'certero',
          habitIds: ['a', 'b'],
          completedIds: ['a', 'b'],
          day: '2026-07-26',
          completedAt: now,
        },
        challengeDayUses: { '2026-07-26:certero': { count: 1, lastUsedAt: now, lastCompletedAt: now } },
      },
    };

    expect(activeSpellStatus({
      spellId: 'certero', game, nowTimestamp: now, today: '2026-07-26',
    })).toBe('60s');
  });

  it('muestra en la nueva clase el reto global de nivel 8 que sigue activo', () => {
    const now = new Date(2026, 6, 26, 12).getTime();
    const game = { powerProgress: {
      habitChallenge: {
        spellId: 'certero', habitIds: ['a', 'b'], completedIds: ['a'], day: '2026-07-26',
      },
      challengeDayUses: {
        '2026-07-26:level-8': { count: 1, lastUsedAt: now, lastCompletedAt: 0 },
      },
    } };
    expect(activeSpellStatus({
      spellId: 'muro', spellLevel: 8, game, nowTimestamp: now, today: '2026-07-26',
    })).toBe('1/2');
  });

  it('no propaga el contador del reto de nivel 8 a otras habilidades', () => {
    const now = new Date(2026, 6, 26, 12).getTime();
    const game = { powerProgress: {
      habitChallenge: {
        spellId: 'certero', habitIds: ['a', 'b'], completedIds: [], day: '2026-07-26',
      },
      challengeDayUses: {
        '2026-07-26:level-8': { count: 1, lastUsedAt: now, lastCompletedAt: 0 },
      },
    } };

    expect(activeSpellStatus({
      spellId: 'luz', spellLevel: 2, game, nowTimestamp: now, today: '2026-07-26',
    })).toBeNull();
    expect(activeSpellStatus({
      spellId: 'juicio', spellLevel: 14, game, nowTimestamp: now, today: '2026-07-26',
    })).toBeNull();
    expect(activeSpellStatus({
      spellId: 'muro', spellLevel: 8, game, nowTimestamp: now, today: '2026-07-26',
    })).toBe('0/2');
  });

  it('muestra el progreso de la ulti y la apaga al cobrarla',()=>{
    const now=new Date(2026,6,26,12).getTime();
    const ultimateChallenge={
      spellId:'juicio',habitIds:['a','b','c'],completedIds:['a','b'],
      day:'2026-07-26',rewarded:false,
    };
    expect(activeSpellStatus({
      spellId:'juicio',game:{powerProgress:{ultimateChallenge}},
      nowTimestamp:now,today:'2026-07-26',
    })).toBe('2/3');
    expect(activeSpellStatus({
      spellId:'juicio',game:{powerProgress:{ultimateChallenge:{...ultimateChallenge,rewarded:true}}},
      nowTimestamp:now,today:'2026-07-26',
    })).toBeNull();
  });

  it('bloquea la ulti moderna después de dos usos semanales',()=>{
    const ability={id:'juicio',lvl:14,ulti:true,modern:true};
    const game={powerProgress:{ultimateWeekUses:{3:2}}};
    expect(spellUnavailableAfterUse({
      ability,game,currentWeek:3,today:'2026-07-26',
    })).toBe(true);
    expect(spellUnavailableAfterUse({
      ability,game,currentWeek:4,today:'2026-08-02',
    })).toBe(false);
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
    expect(model.skillEffects).toEqual([
      {
        kind: 'intoxication',
        spellId: 'intoxication',
        name: 'Borrachera',
        level: 25,
        remaining: '41m',
      },
    ]);
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

    expect(model.classData.pas[0].d).toContain('5% de vida');
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
      'sprites/paladin_happy.webp',
    );
  });

  it('aumenta solo el sprite del outfit de beta tester', () => {
    expect(spriteImage('paladin', 'happy', '', 'beta-tester')).toContain(
      'sprite-svg--outfit-beta-tester',
    );
    expect(spriteImage('paladin', 'happy', '', 'beta-tester')).toContain(
      'sprite-svg--paladin',
    );
    expect(spriteImage('paladin', 'happy', '', 'original')).not.toContain(
      'sprite-svg--outfit-beta-tester',
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
          combatLog: [
            {
              id: 'day:1:2026-07-26',
              key: '2026-07-26',
              direction: 'outgoing',
              kind: 'day',
              journeyMode: 'reduction',
              damage: 27,
            },
            {
              id: 'boss-hit:1:2026-07-26',
              key: '2026-07-26',
              direction: 'incoming',
              kind: 'smoke',
              damage: 30,
            },
          ],
          heroDamageLogged: 27,
          bossDamageLogged: 30,
          history: [
            {
              week: 0,
              bossIndex: 0,
              won: false,
              damage: 91,
              heroDamage: 91,
              bossDamage: 30,
              manaDamage: 24,
              remainingHp: 59,
            },
          ],
        },
      }),
      intoxication: { level: 25, remainingMinutes: 41 },
      huntEnergy: 10,
      huntEnergyMax: 10,
      huntEnergyBonus: 1,
      levelUp: true,
    });

    expect(heroContent.innerHTML).toContain('id="bossInfoBtn"');
    expect(heroContent.innerHTML).toContain('data-open-current-boss-medal="1"');
    expect(heroContent.innerHTML).toContain('aria-label="Abrir medallón de Espectro"');
    expect(heroContent.innerHTML).toContain('<div class="rango">Paladin</div>');
    expect(heroContent.innerHTML).toContain('data-open-hunt-from-hero');
    expect(heroContent.innerHTML).toContain('Energía de Cacería: 9 de 10, más 1 extra. Abrir Cacería');
    expect(heroContent.innerHTML).toContain('<b>9/10<em>+1</em></b>');
    expect(heroContent.innerHTML).not.toContain('data-open-hero-skills');
    expect(heroContent.innerHTML).not.toContain('hero-quick-actions');
    expect(heroContent.innerHTML).not.toContain('id="heroSkillsCard"');
    expect(heroContent.innerHTML).not.toContain('aria-label="Abrir libro de habilidades"');
    expect(heroContent.innerHTML).not.toContain('data-jump-to-boss');
    expect(heroContent.innerHTML).toContain('id="heroBossCard"');
    expect((heroContent.innerHTML.match(/data-cast=/g) || []).length).toBe(3);
    expect((heroContent.innerHTML.match(/data-future-skill/g) || []).length).toBe(3);
    expect(heroContent.innerHTML).toContain('aria-label="Habilidades activas rápidas"');
    expect(heroContent.innerHTML).toContain('data-hero-stat="hp"');
    expect(heroContent.innerHTML).toContain('data-hero-stat="mana"');
    expect(heroContent.innerHTML.indexOf('hero-skill-hotbar'))
      .toBeLessThan(heroContent.innerHTML.indexOf('boss-top'));
    expect(heroSkillsModalBody.innerHTML).not.toContain('id="skInfoBtn"');
    expect(heroSkillsModalBody.innerHTML).toContain('data-cast=');
    expect(heroSkillsModalBody.innerHTML.indexOf('Activas'))
      .toBeLessThan(heroSkillsModalBody.innerHTML.indexOf('Pasivas'));
    expect(heroSkillsModalBody.innerHTML).toContain('spell-effect-active');
    expect(heroSkillsModalBody.innerHTML).toContain('>30m</span>');
    expect((heroSkillsModalBody.innerHTML.match(/passive-effect-active/g) || []).length).toBe(2);
    expect(heroContent.innerHTML).not.toContain('skill-buff-icon--intoxication');
    expect(heroContent.innerHTML).not.toContain('hero-intoxication-overlay');
    expect(heroContent.innerHTML).toContain('sprite-box--intoxicated');
    expect(heroContent.innerHTML).toContain('hero-intoxication-particles--stage-2');
    expect(heroContent.innerHTML).not.toContain('class="hero-visual-effects"');
    expect(heroContent.innerHTML).not.toContain('hero-top hero-top--with-effects');
    expect(heroContent.innerHTML).not.toContain('Ojo Certero: 30m restantes');
    expect(heroContent.innerHTML).not.toContain('effect_icons/paladin_effect_certero.webp');
    expect(heroContent.innerHTML).not.toContain('effect_icons/beer_effect_intoxication.webp');
    expect(heroContent.innerHTML).not.toContain('skill-buff--intoxication');
    expect(heroContent.innerHTML).not.toContain('Borrachera 25%: 41m restantes');
    expect(heroContent.innerHTML).not.toContain('🍺');
    expect(heroContent.innerHTML).toContain('hero-energy--paladin');
    expect(heroContent.innerHTML).toContain('hero-energy--stage-3');
    expect(heroContent.innerHTML).toContain('data-xp-progress="85"');
    expect(heroContent.innerHTML).toContain('data-xp-energy="88"');
    expect(heroContent.innerHTML).toContain('is-leveling-up');
    expect(heroContent.innerHTML).not.toContain('sprite-aura');
    expect(heroContent.innerHTML).toContain('<div class="nombre">Farenheil</div>');
    expect(heroContent.innerHTML).toContain('class="hero-summary"');
    expect(heroContent.innerHTML).toContain('class="hero-summary-primary"');
    expect(heroContent.innerHTML).toContain('class="boss-progress-summary"');
    expect(heroContent.innerHTML).not.toContain('Jefes:');
    expect(heroContent.innerHTML).toContain('Disparos perfectos hoy:');
    expect(heroContent.innerHTML).not.toContain('Últimos golpes');
    expect(bossHistoryBody.innerHTML).toContain('REGISTRO DE COMBATE');
    expect(bossHistoryBody.innerHTML).toContain('−27 HP');
    expect(bossHistoryBody.innerHTML).toContain('TU HÉROE → JEFE');
    expect(bossHistoryBody.innerHTML).toContain('JEFE → TU HÉROE');
    expect(bossHistoryBody.innerHTML).toContain('−30 HP');
    expect(bossHistoryBody.innerHTML).not.toContain('según el registro');
    expect(bossHistoryBody.innerHTML).toContain('El jefe contraatacó al fumar.');
    expect(bossHistoryBody.innerHTML).not.toContain('Si cerraras el día así');
    expect(bossHistoryBody.innerHTML).not.toContain('en total hoy');
    expect(bossHistoryBody.innerHTML).not.toContain('COMBATES CERRADOS');
    expect(bossHistoryBody.innerHTML).toContain('Medallones de victoria · 1');
    expect(bossHistoryBody.innerHTML).toContain('data-boss-history-panel="combat"');
    expect(bossHistoryBody.innerHTML).toContain('data-boss-history-panel="medals" hidden');
    expect(bossHistoryBody.innerHTML).toContain('class="boss-combat-current"');
    expect(bossHistoryBody.innerHTML).toContain('aria-label="Abrir ficha de Espectro"');
    expect(bossHistoryBody.innerHTML).not.toContain('1 / 20');
    expect(bossHistoryBody.innerHTML).toContain('data-share-boss="0"');
    expect(bossHistoryBody.innerHTML).not.toContain('data-share-boss="1"');
    expect(bossHistoryBody.innerHTML).toContain('data-open-boss-medal="0"');
    expect(bossHistoryBody.innerHTML).toContain('data-open-boss-medal="1"');
    expect(bossHistoryBody.innerHTML).not.toContain('data-open-boss-medal="2"');
    expect(bossHistoryBody.innerHTML).toContain('boss_medal_locked.webp');
    expect(bossHistoryBody.innerHTML).toContain('boss_02_espectro.webp');
    expect(bossHistoryBody.innerHTML).toContain('EN COMBATE');
    expect(heroContent.innerHTML).toContain('Derrotados: <b>1</b> de <b>?</b> · ¡Aún quedan jefes por derrotar!');
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
    expect((bossHistoryBody.innerHTML.match(/boss_medal_locked.webp/g) || []).length).toBe(1);
  });
});
