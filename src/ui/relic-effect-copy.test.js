import { describe, expect, it } from 'vitest';
import { ALL_RELIC_DEFINITIONS, relicRankEffect, relicDefinition } from '../data/loot-data.js';
import { grantBossRewards, fuseRelics } from '../domain/loot-rules.js';
import { renderRelicDetail, renderForgeView, renderFusionView } from './inventory-view.js';
import { relicEffectCopy, HUNT_CHARGE_RELIC_IDS } from './relic-effect-copy.js';

function data(definition, rank) {
  const base = grantBossRewards({ state: {}, bossesDown: 12, source: 'retroactive', seed: 'copy', nowTimestamp: 1 });
  base.economy.coins = 100000; base.economy.bossBlood = 100;
  Object.values(base.inventory.relics).forEach(relic => { relic.rank = rank; });
  if (!definition.recipeId) return { base, state: base, relic: base.inventory.relics[definition.id] };
  const [leftId, rightId] = definition.ingredientIds;
  const state = fuseRelics({ state: base, leftId, rightId, operationId: `copy-${definition.id}-${rank}`, randomValue: 0 });
  expect(state.ok).toBe(true);
  return { base, state, relic: state.inventory.relics[definition.id] };
}
function documentStub() {
  const elements = Object.fromEntries(['relicDetailBody', 'relicDetailTitle', 'forgeBody'].map(id => [id, { innerHTML: '', textContent: '' }]));
  return { elements, getElementById: id => elements[id] || null };
}
const cases = ALL_RELIC_DEFINITIONS.flatMap(definition => [1, 2, 3].map(rank => [definition.id, rank, definition]));
const effectRows = html => (html.match(/<button[^>]+data-effect-kind="EFECTO PRINCIPAL"[^>]*>.*?<\/button>/g) || []);

describe('Microcopy de efectos: catálogo completo', () => {
  it.each(cases)('%s R%i: valores reales y mismas unidades en ficha y Forja', (_id, rank, definition) => {
    const { base, state, relic } = data(definition, rank);
    const rows = relicEffectCopy(definition, relic);
    expect(rows).toHaveLength(definition.recipeId ? 3 : 1);
    for (const row of rows) {
      expect(row.name).toBeTruthy(); expect(row.description).toBeTruthy();
      expect(row.description).not.toMatch(/undefined|NaN|Hereda|mientras está equipad|Valor actual/);
      expect(row.description.length).toBeLessThanOrEqual(220);
    }
    for (const row of rows.filter(row => row.id.startsWith('relic_'))) {
      const value = definition.recipeId ? relic.inheritedEffects[row.id] : relicRankEffect(row.id, rank);
      expect(row.description).toContain(String(value));
    }
    const document = documentStub();
    expect(renderRelicDetail(document, state, definition.id)).toBe(true);
    const detail = document.elements.relicDetailBody.innerHTML;
    if (definition.recipeId) renderFusionView(document, base, ...definition.ingredientIds);
    else renderForgeView(document, base, definition.id);
    const forgeRows = effectRows(document.elements.forgeBody.innerHTML);
    expect(definition.recipeId ? forgeRows.slice(0, -1) : forgeRows).toEqual(effectRows(detail));
    expect(effectRows(detail)).toHaveLength(definition.recipeId ? rows.length - 1 : rows.length);
    expect(detail).toContain('aria-haspopup="dialog"');
    expect(detail).not.toContain('<p>' + rows[0].description);
    for (const row of rows) {
      if (definition.recipeId && row.id === definition.id) {
        expect(detail).toContain('relic-fusion-bonus');
        expect(detail).toContain(`<p>${row.description}</p>`);
      } else expect(detail).toContain(`data-effect-description="${row.description}"`);
    }
    // Collection history uses this same detail renderer and saved values.
    const history = structuredClone(state);
    history.inventory.collection[definition.id] = { discovered: true, lastOwnedRecord: relic };
    delete history.inventory.relics[definition.id];
    renderRelicDetail(document, history, definition.id);
    expect(effectRows(document.elements.relicDetailBody.innerHTML)).toEqual(effectRows(detail));
  });

  it('no recalcula la herencia desde el rango de la fusión', () => {
    const definition = relicDefinition('fusion_26');
    const { relic } = data(definition, 1);
    relic.rank = 3;
    const rows = relicEffectCopy(definition, relic);
    expect(rows[0].description).toContain('5%');
    expect(rows[1].description).toContain('5%');
    expect(rows[2].description).toContain('preparas 4 de protección extra');
  });

  it.each(cases.filter(([, , definition]) => definition.recipeId))('%s R%i: bonus cotidiano, disparador primero y máximo dos frases', (_id, rank, definition) => {
    const { relic } = data(definition, rank);
    const copy = relicEffectCopy(definition, relic).at(-1).description;
    expect(copy).toMatch(/^(Al |Con |Si |Cuando |La primera vez)/);
    expect(copy).not.toMatch(/p\. p\.|No acumulable|redondeo|sinergia/);
    expect(copy.split('.').filter(part => part.trim())).toHaveLength(copy.includes('. ') ? 2 : 1);
  });

  it.each([1, 2, 3])('R%i expresa aumentos con la herencia guardada, no con el rango actual', rank => {
    const ids = ['fusion_18', 'fusion_19', 'fusion_20', 'fusion_22', 'fusion_25', 'fusion_28', 'fusion_31'];
    for (const id of ids) {
      const definition = relicDefinition(id);
      const { relic } = data(definition, 1);
      relic.rank = rank;
      const baseId = ['fusion_20', 'fusion_22'].includes(id) ? 'relic_08' : id === 'fusion_28' ? 'relic_09' : 'relic_07';
      const extra = ['fusion_18', 'fusion_19'].includes(id) ? 1 : definition.synergy.values?.[rank] ?? definition.synergy.value;
      const before = relic.inheritedEffects[baseId];
      const copy = relicEffectCopy(definition, relic).at(-1).description;
      expect(copy).toContain(`del ${before}% al ${before + extra}%`);
    }
  });

  it.each([1, 2, 3])('Constancia R%i advierte la pérdida de progreso en base y todas sus fusiones', rank => {
    const definitions = ALL_RELIC_DEFINITIONS.filter(definition => definition.id === 'relic_04' || definition.ingredientIds?.includes('relic_04'));
    expect(definitions.length).toBeGreaterThan(1);
    for (const definition of definitions) {
      const { relic } = data(definition, rank);
      const row = relicEffectCopy(definition, relic).find(effect => effect.id === 'relic_04');
      expect(row.description).toContain('el progreso se pierde al desequipar');
      expect(row.description).toContain('Una vez por ciclo');
    }
  });

  it.each(HUNT_CHARGE_RELIC_IDS.flatMap(id => [1, 2, 3].map(rank => [id, rank])))('%s R%i conserva consumo, límites y estado de carga', (id, rank) => {
    const definition = relicDefinition(id);
    const { state, relic } = data(definition, rank);
    const copy = relicEffectCopy(definition, relic).at(-1).description;
    expect(copy).toContain('1 carga');
    expect(copy).toContain('Solo guardas 1 carga');
    expect(copy).toContain('la gastas al entrar');
    expect(copy).toContain('próxima Cacería');
    expect(copy.includes('la pierdes al desequipar')).toBe(!['fusion_18', 'fusion_19'].includes(id));
    const document = documentStub();
    state.inventory.equipped = [id];
    for (const ready of [false, true]) {
      state.inventory.huntCharges[id] = ready;
      renderRelicDetail(document, state, id);
      expect(document.elements.relicDetailBody.innerHTML).toContain(ready ? 'Preparada · se consume al iniciar Cacería' : 'Sin carga preparada');
    }
  });

  it('distingue cargas por completar hábitos de efectos ligados a XP', () => {
    expect(relicEffectCopy(relicDefinition('relic_02'), { rank: 1 })[0].description).toContain('primer hábito con XP');
    const { relic } = data(relicDefinition('fusion_26'), 1);
    expect(relicEffectCopy(relicDefinition('fusion_26'), relic).at(-1).description).toContain('Al completar el primer hábito del día');
  });

  it.each([1, 2, 3])('mantiene topes, conversión y umbrales en R%i', rank => {
    const bonus = id => {
      const definition = relicDefinition(id);
      return relicEffectCopy(definition, data(definition, rank).relic).at(-1).description;
    };
    expect(bonus('fusion_26')).toContain('sin bajarlo a cero');
    expect(bonus('fusion_27')).toContain(`hasta ${rank * 3} XP`);
    expect(bonus('fusion_27')).toContain('al menos 5 de daño');
    expect(bonus('fusion_29')).toContain('20%');
    expect(bonus('fusion_29')).toContain(`Hasta ${rank + 1} de Maná por enemigo`);
    expect(bonus('fusion_29')).toContain('sin decimales');
    expect(bonus('fusion_30')).toContain('15%');
    expect(bonus('fusion_30')).toContain(`Hasta ${rank} de Vida por enemigo`);
    expect(bonus('fusion_30')).toContain('y sobrevives');
    expect(bonus('fusion_30')).toContain('lo que sobre se pierde');
    expect(bonus('fusion_31')).toContain('Contra el siguiente enemigo, vuelve a empezar');
    expect(bonus('fusion_25')).toContain('siguiente ataque que dañe a ese enemigo');
    expect(bonus('fusion_25')).toContain('Solo una vez por enemigo; no puedes acumularlo');
  });
});
