import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createOnboardingController, createOnboardingResult } from './onboarding-controller.js';

describe('resultado del onboarding', () => {
  it.each(['0', '', undefined, '-1'])('no inventa consumo inicial para %s', (startLimit) => {
    const result = createOnboardingResult({
      startDate: '2026-09-21', startLimit, heroName: '', journeyMode: 'reduction',
    });
    expect(result.config.startLimit).toBe(0);
  });
  it('construye configuración y héroe con los valores introducidos', () => {
    expect(
      createOnboardingResult({
        startDate: '2026-07-26',
        startLimit: '18',
        wakeTime: '07:00',
        sleepTime: '23:30',
        dayStartTime: '04:30',
        takesPills: true,
        pillsGoal: '2',
        tracksBeer: false,
        classId: 'paladin',
        heroName: ' Kike ',
      }),
    ).toEqual({
      config: {
        journeyMode: 'reduction',
        startDate: '2026-07-26',
        startLimit: 18,
        wakeTime: '07:00',
        sleepTime: '23:30',
        dayStartTime: '04:30',
        takesPills: true,
        pillsGoal: 2,
        tracksBeer: false,
      },
      game: { cls: 'paladin', name: 'Kike' },
      onboarded: true,
    });
  });

  it('crea una campaña sin fumar sin depender del contador inicial', () => {
    const result = createOnboardingResult({
      startDate: '2026-08-01',
      startLimit: '7',
      takesPills: false,
      tracksBeer: true,
      classId: 'druid',
      heroName: 'Broto',
      journeyMode: 'smoke_free',
    });

    expect(result.config).toMatchObject({
      journeyMode: 'smoke_free',
      startDate: '2026-08-01',
      startLimit: 21,
    });
  });

  it('crea un camino de consumo controlado con bolsa semanal', () => {
    const result = createOnboardingResult({
      startDate: '2026-08-03',
      startLimit: '20',
      takesPills: false,
      tracksBeer: false,
      classId: 'knight',
      heroName: 'Bran',
      journeyMode: 'controlled',
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: '3',
    });

    expect(result.config).toMatchObject({
      journeyMode: 'controlled',
      startLimit: 21,
      controlledDays: [5, 6, 0],
      controlledWeeklyLimit: 3,
    });
  });

  it('desactiva la meta de pastillas y usa nombres predeterminados seguros', () => {
    const result = createOnboardingResult({
      startDate: '2026-07-26',
      startLimit: '',
      wakeTime: '',
      sleepTime: '',
      dayStartTime: '',
      takesPills: false,
      pillsGoal: '9',
      tracksBeer: true,
      classId: 'desconocida',
      heroName: ' ',
    });

    expect(result.config).toMatchObject({
      startLimit: 0,
      wakeTime: '09:00',
      sleepTime: '23:00',
      dayStartTime: '04:00',
      pillsGoal: 0,
    });
    expect(result.game).toEqual({ cls: 'knight', name: 'Caballero' });
  });
});

function element() {
  const classes = new Set();
  return {
    style: {},
    value: '',
    scrollTop: 0,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
    addEventListener() {},
  };
}

describe('onboarding intro handoff', () => {
  it('keeps just one background and logo for loading and the welcome step', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html.match(/class="onboarding-scene"/g)).toHaveLength(1);
    expect(html.match(/class="load-logo"/g)).toHaveLength(1);
    expect(html).not.toContain('class="ob-logo"');
  });

  it('uses the already playing loading intro instead of showing the same logo twice', () => {
    const nodes = new Map();
    const get = (id) => {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    };
    const document = {
      getElementById: get,
      querySelectorAll: (selector) => selector === '.ob-step'
        ? [1, 2, 3, 4, 5].map((step) => get(`ob${step}`))
        : [],
    };
    const onboarding = createOnboardingController({
      document,
      todayKey: () => '2026-09-28',
      spriteImage: () => '',
      onFinish() {},
    });

    onboarding.start({ skipIntro: true, keepLoading: true });

    expect(get('loading').style.display).toBeUndefined();
    expect(get('onboard').style.display).toBe('flex');
    expect(get('onboard').classList.contains('splash-handoff')).toBe(true);
    expect(get('ob1').classList.contains('active')).toBe(false);
    expect(get('ob2').classList.contains('active')).toBe(true);
    expect(get('ob1').classList.contains('intro-ready')).toBe(false);
  });
});
