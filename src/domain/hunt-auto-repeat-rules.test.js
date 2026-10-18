import { describe, expect, it } from 'vitest';
import {
  AUTO_REPEAT_MAX_RUNS, AUTO_REPEAT_MIN_HP_RATIO, AUTO_REPEAT_STOP_REASONS, autoRepeatDecision, autoRepeatPossibleRuns,
  autoRepeatSummary, beginAutoRepeat, countAutoRepeatRun, normalizeAutoRepeat, recordAutoRepeatReport, stopAutoRepeat,
} from './hunt-auto-repeat-rules.js';
import {
  huntDifficultyForRegion, localHuntDayKey, normalizeHuntState, resolveHunt, startHunt,
} from './pve-combat-rules.js';
import { huntAutoRepeatMarkup } from '../ui/hunt-view.js';

const config = (extra = {}) => ({ ...beginAutoRepeat({ regionId: 'dead-hours-bunker', difficultyId: 'easy', autoUsePotions: true, nowTimestamp: 1000 }), ...extra });
const won = { won: true, heroDied: false };
const STRONG = { magicAttack: 300, defense: 200 };

describe('Repetición automática de Cacería: reglas', () => {
  it('cuenta cuántas cacerías completas permite la energía', () => {
    expect(autoRepeatPossibleRuns(10, 5)).toBe(2);
    expect(autoRepeatPossibleRuns(10, 3)).toBe(3);
    expect(autoRepeatPossibleRuns(4, 5)).toBe(0);
    expect(autoRepeatPossibleRuns(10, 0)).toBe(10);
    expect(autoRepeatPossibleRuns(NaN, 3)).toBe(0);
  });

  it('empieza con una vuelta y normaliza datos incompletos o dañados', () => {
    expect(config()).toMatchObject({ enabled: true, runs: 1, reportIds: [], regionId: 'dead-hours-bunker', difficultyId: 'easy', autoUsePotions: true });
    expect(normalizeAutoRepeat(null)).toBeNull();
    expect(normalizeAutoRepeat('texto')).toBeNull();
    expect(normalizeAutoRepeat({ enabled: true })).toBeNull();
    const dirty = normalizeAutoRepeat({ enabled: 'sí', regionId: 'fields-of-mist', difficultyId: 'hard', runs: -4, reportIds: ['a', 7, '', 'b'], stopReason: 'inventada' });
    expect(dirty).toMatchObject({ enabled: false, runs: 0, reportIds: ['a', 'b'], stopReason: '' });
    expect(normalizeAutoRepeat({ ...config(), runs: 99999 }).runs).toBe(AUTO_REPEAT_MAX_RUNS);
  });

  it('anota informes sin duplicarlos y cuenta repeticiones con tope', () => {
    let current = recordAutoRepeatReport(config(), 'r1');
    current = recordAutoRepeatReport(current, 'r1');
    expect(current.reportIds).toEqual(['r1']);
    current = countAutoRepeatRun(current);
    expect(current.runs).toBe(2);
    expect(countAutoRepeatRun({ ...current, runs: AUTO_REPEAT_MAX_RUNS }).runs).toBe(AUTO_REPEAT_MAX_RUNS);
  });

  it('se detiene con un motivo guardado y no se reactiva sola', () => {
    const stopped = stopAutoRepeat(config(), 'manual', 5000);
    expect(stopped).toMatchObject({ enabled: false, stopReason: 'manual', stoppedAt: 5000 });
    expect(stopAutoRepeat(stopped, 'died', 9000)).toMatchObject({ stopReason: 'manual', stoppedAt: 5000 });
    expect(normalizeAutoRepeat({ ...stopped, enabled: true }).stopReason).toBe('');
    expect(autoRepeatDecision({ config: stopped, report: won, energy: 10, energyCost: 3 })).toEqual({ proceed: false, reason: '' });
    expect(stopAutoRepeat(null)).toBeNull();
  });

  it('decide seguir solo con victoria, héroe vivo, vida suficiente, nivel y energía', () => {
    const ok = { config: config(), report: won, energy: 6, energyCost: 3, hpRatio: 0.8, level: 20, requiredLevel: 13 };
    expect(autoRepeatDecision(ok)).toEqual({ proceed: true, reason: '' });
    expect(autoRepeatDecision({ ...ok, report: { won: true, heroDied: true } }).reason).toBe('died');
    expect(autoRepeatDecision({ ...ok, report: { won: false, heroDied: false } }).reason).toBe('defeat');
    expect(autoRepeatDecision({ ...ok, report: { won: false, defeatedEnemies: 2 } }).reason).toBe('defeat');
    expect(autoRepeatDecision({ ...ok, energy: 2 }).reason).toBe('no-energy');
    expect(autoRepeatDecision({ ...ok, energy: 3 }).proceed).toBe(true);
    expect(autoRepeatDecision({ ...ok, hpRatio: AUTO_REPEAT_MIN_HP_RATIO - 0.01 }).reason).toBe('low-health');
    expect(autoRepeatDecision({ ...ok, hpRatio: AUTO_REPEAT_MIN_HP_RATIO }).proceed).toBe(true);
    expect(autoRepeatDecision({ ...ok, level: 12 }).reason).toBe('level');
    expect(autoRepeatDecision({ ...ok, config: config({ runs: AUTO_REPEAT_MAX_RUNS }) }).reason).toBe('max-runs');
    for (const reason of ['died', 'defeat', 'no-energy', 'low-health', 'level', 'max-runs', 'manual']) {
      expect(AUTO_REPEAT_STOP_REASONS[reason]).toBeTruthy();
    }
  });

  it('el motivo más grave gana si coinciden varios', () => {
    const report = { won: false, heroDied: true };
    expect(autoRepeatDecision({ config: config(), report, energy: 0, energyCost: 3, hpRatio: 0, level: 1, requiredLevel: 13 }).reason).toBe('died');
    expect(autoRepeatDecision({ config: config(), report: won, energy: 0, energyCost: 3, hpRatio: 0, level: 1, requiredLevel: 13 }).reason).toBe('level');
  });

  it('resume lo conseguido leyendo historial e informe final, sin contar nada dos veces', () => {
    const report = (id, xp, gold, wonRun = true) => ({ id, won: wonRun, rewards: { xp, gold, arcaneFibers: 1, arcaneInks: 0, bossBlood: 0 } });
    const chain = stopAutoRepeat({ ...config({ runs: 3 }), reportIds: ['a', 'b', 'c'] }, 'no-energy', 1);
    const hunt = { history: [report('x', 99, 99), report('a', 10, 5), report('b', 12, 6, false)], lastReport: report('c', 8, 4) };
    expect(autoRepeatSummary(chain, hunt)).toMatchObject({ runs: 3, finished: 3, wins: 2, xp: 30, gold: 15, arcaneFibers: 3, enabled: false, stopReason: 'no-energy' });
    expect(autoRepeatSummary(chain, { history: [report('a', 10, 5)], lastReport: report('a', 10, 5) }).finished).toBe(1);
    expect(autoRepeatSummary(null, hunt)).toBeNull();
  });
});

describe('Repetición automática de Cacería: integración con el estado de Cacería', () => {
  const dayStart = '00:00';
  function realHunt(currentHp = 100) {
    return startHunt({
      hunt: {}, regionId: 'dead-hours-bunker', difficultyId: 'easy', level: 30, nowTimestamp: 1_700_000_000_000, seed: 5,
      currentHp, maxHp: 100, currentMana: 100, maxMana: 100, bonusDayKey: '2023-11-14',
    }).hunt;
  }

  it('la configuración sobrevive a startHunt, a resolveHunt y a guardar y recargar', () => {
    const start = { ...realHunt(), autoRepeat: beginAutoRepeat({ regionId: 'dead-hours-bunker', difficultyId: 'easy', autoUsePotions: true, nowTimestamp: 1 }) };
    expect(normalizeHuntState(JSON.parse(JSON.stringify(start))).autoRepeat).toMatchObject({ enabled: true, runs: 1 });
    const resolved = resolveHunt({ hunt: start, classId: 'sorcerer', level: 30, nowTimestamp: 1_700_000_000_000 + 3 * 3600 * 1000 });
    expect(resolved.ok).toBe(true);
    expect(resolved.hunt.autoRepeat).toMatchObject({ enabled: true, runs: 1 });
    const second = startHunt({
      hunt: resolved.hunt, regionId: 'dead-hours-bunker', difficultyId: 'easy', level: 30, nowTimestamp: 1_700_000_000_000 + 4 * 60_000, seed: 6,
      currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100,
    });
    expect(second.ok).toBe(true);
    expect(second.hunt.autoRepeat).toMatchObject({ enabled: true });
    expect(normalizeHuntState({ ...realHunt(), autoRepeat: 'basura' }).autoRepeat).toBeNull();
    expect(normalizeHuntState({}).autoRepeat).toBeNull();
  });

  it('con 10 de energía y coste 3 la cadena hace tres cacerías y se detiene sin energía', () => {
    const cost = huntDifficultyForRegion('dead-hours-bunker', 'easy').energyCost;
    expect(cost).toBe(3);
    const startAt = 1_700_000_000_000;
    let hunt = startHunt({
      hunt: {}, regionId: 'dead-hours-bunker', difficultyId: 'easy', level: 30, nowTimestamp: startAt, seed: 1,
      currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100, relicBonuses: STRONG,
    }).hunt;
    expect(hunt.energy).toBe(10 - cost);
    let chain = beginAutoRepeat({ regionId: 'dead-hours-bunker', difficultyId: 'easy', nowTimestamp: startAt });
    const ids = [];
    let at = startAt;
    for (let guard = 0; guard < 10 && hunt.active; guard += 1) {
      const endsAt = hunt.active.endsAt;
      at = Math.max(at, endsAt);
      const result = resolveHunt({ hunt: { ...hunt, autoRepeat: chain }, classId: 'sorcerer', level: 30, nowTimestamp: at });
      expect(result.ok).toBe(true);
      ids.push(result.report.id);
      chain = recordAutoRepeatReport(result.hunt.autoRepeat, result.report.id);
      hunt = result.hunt;
      const decision = autoRepeatDecision({
        config: chain, report: result.report, energy: hunt.energy, energyCost: cost,
        hpRatio: 1, level: 30, requiredLevel: 13,
      });
      if (!decision.proceed) { chain = stopAutoRepeat(chain, decision.reason, at); break; }
      const sameDay = localHuntDayKey(endsAt, dayStart) === hunt.energyDay;
      const next = startHunt({
        hunt, regionId: chain.regionId, difficultyId: chain.difficultyId, level: 30, nowTimestamp: sameDay ? endsAt : at, seed: guard + 2,
        currentHp: 100, maxHp: 100, currentMana: 100, maxMana: 100, relicBonuses: STRONG,
      });
      expect(next.ok).toBe(true);
      hunt = next.hunt;
      chain = countAutoRepeatRun(chain);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
    expect(chain).toMatchObject({ enabled: false, stopReason: 'no-energy', runs: 3 });
    expect(hunt.energy).toBe(10 - cost * 3);
    expect(hunt.active).toBeNull();
  });
});

describe('Repetición automática de Cacería: pantalla', () => {
  it('muestra el resumen con totales y el motivo, y nada mientras la primera vuelta no ha terminado', () => {
    const running = beginAutoRepeat({ regionId: 'dead-hours-bunker', difficultyId: 'easy', nowTimestamp: 1 });
    expect(huntAutoRepeatMarkup(running, {})).toBe('');
    const stopped = stopAutoRepeat({ ...running, runs: 2, reportIds: ['a', 'b'] }, 'low-health', 9);
    const hunt = { history: [{ id: 'a', won: true, rewards: { xp: 40, gold: 12 } }], lastReport: { id: 'b', won: true, rewards: { xp: 40, gold: 12 } } };
    const html = huntAutoRepeatMarkup(stopped, hunt);
    expect(html).toContain('Repetición automática');
    expect(html).toContain('2 CACERÍAS');
    expect(html).toContain('2 de 2 superadas');
    expect(html).toContain('<b>80</b> XP');
    expect(html).toContain('por debajo del 40 %');
    expect(huntAutoRepeatMarkup(null, hunt)).toBe('');
  });
});
