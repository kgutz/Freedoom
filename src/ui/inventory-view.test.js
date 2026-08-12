import { describe, expect, it } from 'vitest';
import { grantBossRewards } from '../domain/loot-rules.js';
import {
  forgeResultMarkup,
  inventoryAccessMarkup,
  renderForgeView,
  renderInventoryView,
  renderLootNotice,
  renderRelicDetail,
  resourceIcon,
} from './inventory-view.js';

function lootWithBosses(count, source = 'retroactive') {
  return grantBossRewards({
    state: {}, bossesDown: count, source, seed: 'ui-test', nowTimestamp: 1,
  });
}

function fakeDocument() {
  const elements = Object.fromEntries([
    'inventoryBody', 'forgeBody', 'relicDetailBody', 'lootNoticeTitle', 'lootNoticeIntro',
    'lootNoticeRewards', 'lootNoticeSummary', 'lootNoticeActions',
  ].map((id) => [id, { innerHTML: '', textContent: '' }]));
  return { elements, getElementById: (id) => elements[id] || null };
}

describe('interfaz de inventario y botín', () => {
  it('usa iconos CSS accesibles y no imágenes para las monedas y la sangre', () => {
    expect(resourceIcon('coin')).toContain('resource-icon--coin');
    expect(resourceIcon('boss-blood')).toContain('resource-icon--boss-blood');
    expect(resourceIcon('coin')).not.toContain('<img');
  });

  it('muestra recursos y una colección de seis reliquias', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    renderInventoryView(document, state);
    expect(document.elements.inventoryBody.innerHTML).toContain('650');
    expect(document.elements.inventoryBody.innerHTML).toContain('<small>6</small>');
    expect(document.elements.inventoryBody.innerHTML).not.toContain('6 / 6');
    expect(document.elements.inventoryBody.innerHTML.match(/data-open-relic=/g)).toHaveLength(6);
    expect(inventoryAccessMarkup(state)).toContain('INVENTARIO Y FORJA');
    expect(inventoryAccessMarkup(state)).not.toContain('6 reliquias');
    expect(document.elements.inventoryBody.innerHTML).toContain('Corazón de Hollín');
    expect(document.elements.inventoryBody.innerHTML).toContain('Lágrima de Espectro');
    expect(document.elements.inventoryBody.innerHTML).toContain('relic_06_colmillo_nicotina.png');
  });

  it('separa el detalle de la reliquia de sus controles de Forja', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    expect(renderRelicDetail(document, state, 'relic_01')).toBe(true);
    const html = document.elements.relicDetailBody.innerHTML;
    expect(html).toContain('EFECTO PRINCIPAL');
    expect(html).toContain('EFECTOS EXTRAS');
    expect(html).not.toContain('data-forge-relic');
  });

  it('muestra selección, requisitos, pity y probabilidad en la vista de Forja', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    expect(renderForgeView(document, state, 'relic_02')).toBe('relic_02');
    const html = document.elements.forgeBody.innerHTML;
    expect(html).toContain('Lágrima de Espectro');
    expect(html.match(/data-select-forge-relic=/g)).toHaveLength(3);
    expect(html).toContain('Pity');
    expect(html).toContain('PROBABILIDAD 70%');
    expect(html).toContain('MEJORA DEL EFECTO');
    expect(html).toContain('5 MANÁ');
    expect(html).toContain('7 MANÁ');
    expect(html).toContain('La Sangre de Jefe es un requisito y no se consume');
  });

  it('confirma el valor mejorado cuando la Forja tiene éxito', () => {
    const html = forgeResultMarkup({
      success: true,
      spentCoins: 50,
      preview: { targetRank: 2 },
    }, 'Corazón de Hollín', 'relic_01');
    expect(html).toContain('5 HP');
    expect(html).toContain('7 HP');
    expect(html).toContain('Su efecto principal se ha fortalecido');
  });

  it('hace obligatoria la entrada al inventario en la migración retroactiva', () => {
    const document = fakeDocument();
    const state = lootWithBosses(2);
    renderLootNotice(document, state, state.loot.notices[0]);
    expect(document.elements.lootNoticeActions.innerHTML).toBe(
      '<button type="button" data-loot-inventory>IR AL INVENTARIO</button>',
    );
    expect(document.elements.lootNoticeSummary.innerHTML).toContain('160');
    expect(document.elements.lootNoticeSummary.innerHTML).toContain('SANGRE');
  });

  it('usa el cofre pixel art en recompensas nuevas', () => {
    const document = fakeDocument();
    const state = lootWithBosses(1, 'victory');
    renderLootNotice(document, state, state.loot.notices[0]);
    expect(document.elements.lootNoticeRewards.innerHTML).toContain(
      'relics/boss_loot_chest.png',
    );
  });
});
