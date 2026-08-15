import { describe, expect, it } from 'vitest';
import { fuseRelics, grantBossRewards } from '../domain/loot-rules.js';
import {
  fusionResultMarkup,
  forgeResultMarkup,
  closeForgeInfoOutside,
  chargeIndicatorMarkup,
  inventoryReferenceOffset,
  inventoryAccessMarkup,
  nextFusionSelection,
  renderCollectionView,
  renderForgeView,
  renderFusionView,
  renderInventoryView,
  renderLootNotice,
  renderRelicEffectInfo,
  renderRelicDetail,
  renderShopView,
  resourceIcon,
} from './inventory-view.js';

function lootWithBosses(count, source = 'retroactive') {
  return grantBossRewards({
    state: {}, bossesDown: count, source, seed: 'ui-test', nowTimestamp: 1,
  });
}

function fakeDocument() {
  const elements = Object.fromEntries([
    'inventoryBody', 'collectionBody', 'forgeBody', 'shopBody', 'relicDetailBody', 'relicEffectInfoTitle',
    'relicEffectInfoDescription', 'lootNoticeTitle', 'lootNoticeIntro',
    'lootNoticeRewards', 'lootNoticeSummary', 'lootNoticeActions',
  ].map((id) => [id, { innerHTML: '', textContent: '' }]));
  return { elements, getElementById: (id) => elements[id] || null };
}

describe('interfaz de inventario y botín', () => {
  it('cierra la información de Forja al tocar fuera y conserva la tocada', () => {
    const insideTarget = {};
    const outsideTarget = {};
    let keptRemovals = 0;
    let closedRemovals = 0;
    const kept = {
      contains: (target) => target === insideTarget,
      removeAttribute: () => { keptRemovals += 1; },
    };
    const closed = {
      contains: () => false,
      removeAttribute: () => { closedRemovals += 1; },
    };
    const document = { querySelectorAll: () => [kept, closed] };
    expect(closeForgeInfoOutside(document, insideTarget)).toBe(1);
    expect(keptRemovals).toBe(0);
    expect(closedRemovals).toBe(1);
    expect(closeForgeInfoOutside(document, outsideTarget)).toBe(2);
    expect(keptRemovals).toBe(1);
    expect(closedRemovals).toBe(2);
  });

  it('centra todas las pestañas con la altura real de Forja y prioriza pantallas bajas', () => {
    expect(inventoryReferenceOffset(600, 400)).toBe(100);
    expect(inventoryReferenceOffset(400, 500)).toBe(0);
    expect(inventoryReferenceOffset(0, 400)).toBe(0);
  });

  it('usa iconos CSS accesibles y no imágenes para las monedas y la sangre', () => {
    expect(resourceIcon('coin')).toContain('resource-icon--coin');
    expect(resourceIcon('boss-blood')).toContain('resource-icon--boss-blood');
    expect(resourceIcon('coin')).not.toContain('<img');
  });

  it('muestra recursos y separa las seis reliquias poseídas de la colección', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    renderInventoryView(document, state);
    renderCollectionView(document, state);
    expect(document.elements.inventoryBody.innerHTML).toContain('650');
    expect(document.elements.inventoryBody.innerHTML).toContain('<span>INVENTARIO</span><small>6</small>');
    expect(document.elements.inventoryBody.innerHTML.match(/data-open-relic=/g)).toHaveLength(6);
    expect(document.elements.collectionBody.innerHTML).toContain('<small>6/?</small>');
    expect(document.elements.collectionBody.innerHTML.match(/data-open-relic=/g)).toHaveLength(6);
    expect(inventoryAccessMarkup(state)).toContain('INVENTARIO Y FORJA');
    expect(inventoryAccessMarkup(state)).not.toContain('6 reliquias');
    expect(document.elements.inventoryBody.innerHTML).toContain('Corazón de Hollín');
    expect(document.elements.inventoryBody.innerHTML).toContain('Lágrima de Espectro');
    expect(document.elements.inventoryBody.innerHTML).toContain('relic_04_yelmo_ultima_brasa.png');
    expect(document.elements.inventoryBody.innerHTML).toContain('relic_06_colmillo_nicotina.png');
  });

  it('distingue visual y semánticamente una reliquia equipada dentro del inventario', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    state.inventory.equipped = ['relic_02'];
    state.inventory.relics.relic_02.rarity = 'mythic';
    renderInventoryView(document, state);
    const html = document.elements.inventoryBody.innerHTML;
    expect(html).toContain('aria-label="Lágrima de Espectro, MÍTICO, rango 1, Equipada"');
    expect(html).toContain('MÍTICO - RANGO 1');
    expect(html).toContain('<span>INVENTARIO</span><small>3</small>');
    const collectionHtml = html.slice(html.indexOf('<div class="relic-grid">'));
    expect(collectionHtml).not.toContain('relic-card-copy');
    expect(collectionHtml).not.toContain('relic-card-meta');
    expect(collectionHtml).toContain('relic-collection-item');
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

  it('muestra el nombre, la XP y la carga actual del Yelmo', () => {
    const document = fakeDocument();
    const state = lootWithBosses(4);
    state.inventory.relics.relic_04.rank = 2;
    state.inventory.constancy = { cycleId: 'week-3:boss-3', charge: 4 };
    expect(renderRelicDetail(document, state, 'relic_04')).toBe(true);
    const html = document.elements.relicDetailBody.innerHTML;
    expect(html).toContain('Yelmo de la Última Brasa');
    expect(html).toContain('CONSTANCIA');
    expect(html).toContain('Carga actual: 4/6');
    expect(html).toContain('Valor actual: 25 XP');
    expect(html).not.toContain('puntos porcentuales');
  });

  it.each([
    [0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6],
  ])('representa %i/6 cargas en el indicador reutilizable', (charge, activeCount) => {
    const html = chargeIndicatorMarkup({
      mechanicId: 'constancy',
      chargeState: { charge, lastIncreaseAt: 0, lastIncreaseCharge: 0 },
      rarity: 'rare',
      nowTimestamp: 100,
    });
    expect(html.match(/relic-charge-dot/g)).toHaveLength(6);
    expect(html.match(/relic-charge-dot active/g) || []).toHaveLength(activeCount);
    expect(html).toContain(`Constancia: ${charge} de 6`);
  });

  it('deriva el color de la rareza real, anima solo el punto nuevo y no aparece en otras reliquias', () => {
    const indicator = chargeIndicatorMarkup({
      mechanicId: 'constancy',
      chargeState: { charge: 2, lastIncreaseAt: 900, lastIncreaseCharge: 2 },
      rarity: 'mythic',
      nowTimestamp: 1000,
    });
    expect(indicator).toContain('rarity-mythic');
    expect(indicator.match(/newly-charged/g)).toHaveLength(1);

    const document = fakeDocument();
    const state = lootWithBosses(4);
    state.inventory.equipped = ['relic_04', 'relic_01'];
    state.inventory.relics.relic_04.rarity = 'mythic';
    state.inventory.constancy = { cycleId: 'week-3:boss-3', charge: 2 };
    renderInventoryView(document, state);
    const html = document.elements.inventoryBody.innerHTML;
    expect(html.match(/relic-charge-indicator/g)).toHaveLength(1);
    expect(html).toContain('rarity-mythic');
    expect(html.indexOf('relic-charge-indicator')).toBeLessThan(html.indexOf('relic-card-copy'));
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
    expect(html).toContain('RANGO 1 <i aria-hidden="true">→</i> RANGO 2');
    expect(html).toContain('5 MANÁ');
    expect(html).toContain('7 MANÁ');
    expect(html).toContain('La Sangre de Jefe solo se consume si la mejora tiene éxito');
    expect(html).toContain('class="forge-attempt"');
    expect(html).toContain('>FORJAR</button>');
    expect(html).toContain('class="forge-toolbar"');
  });

  it('renderizar o recalcular la Forja nunca vuelve a consumir Sangre', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    state.economy.bossBlood = 2;
    const original = JSON.stringify(state);
    renderForgeView(document, state, 'relic_01');
    renderForgeView(document, state, 'relic_01');
    expect(state.economy.bossBlood).toBe(2);
    expect(JSON.stringify(state)).toBe(original);
  });

  it('oculta una receta nueva, muestra incompatibilidades y revela el resultado descubierto', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    state.inventory.relics.relic_01.rarity = 'legendary';
    state.inventory.relics.relic_01.rank = 2;
    state.inventory.relics.relic_01.affixes = ['vitality'];
    state.inventory.relics.relic_02.rarity = 'legendary';
    state.inventory.relics.relic_02.affixes = ['arcane'];
    renderFusionView(document, state, 'relic_01', 'relic_02');
    expect(document.elements.forgeBody.innerHTML).toContain('Receta desconocida');
    expect(document.elements.forgeBody.innerHTML).not.toContain('Corazón Espectral');
    expect(document.elements.forgeBody.innerHTML).toContain('<span>RESULTADO</span>');
    expect(document.elements.forgeBody.innerHTML).toContain('MÍTICO');
    expect(document.elements.forgeBody.innerHTML).toContain('RANGO 2');
    expect(document.elements.forgeBody.innerHTML).toContain('2 EFECTOS EXTRAS');
    renderFusionView(document, state, 'relic_03', 'relic_06');
    expect(document.elements.forgeBody.innerHTML).toContain('Estas reliquias no pueden fusionarse');
    expect(document.elements.forgeBody.innerHTML).toContain('data-fuse-relics="relic_03|relic_06" disabled');
    const fused = fuseRelics({
      state, leftId: 'relic_01', rightId: 'relic_02', operationId: 'ui-fusion', nowTimestamp: 10,
    });
    renderFusionView(document, fused, 'relic_01', 'relic_02');
    expect(document.elements.forgeBody.innerHTML).toContain('Corazón Espectral');
    expect(document.elements.forgeBody.innerHTML).toContain('fusion_01_corazon_espectral.png');
    expect(document.elements.forgeBody.innerHTML).not.toContain('fusion-art-part');
    expect(fusionResultMarkup(fused)).toContain('NUEVA RELIQUIA DESCUBIERTA');
    expect(fusionResultMarkup(fused)).toContain('MÍTICO · RANGO 2');
    expect(renderRelicDetail(document, fused, 'fusion_01')).toBe(true);
    expect(document.elements.relicDetailBody.innerHTML).toContain('RANGO 2 · RELIQUIA FUSIONADA');
  });

  it('marca la primera reliquia, atenúa incompatibles y muestra feedback dentro de la Forja', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    renderFusionView(document, state, 'relic_01', null, { errorId: 'relic_03' });
    const html = document.elements.forgeBody.innerHTML;
    expect(html).toContain('fusion-first-selected');
    expect(html).toContain('fusion-choice-order');
    expect(html).toContain('fusion-incompatible');
    expect(html).toContain('fusion-choice-error');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Estas reliquias no pueden fusionarse.');
    expect(html).toContain('Selecciona otra reliquia compatible.');
    expect(html).toContain('data-fuse-relics="relic_01|" disabled');
  });

  it('rechaza una segunda incompatible sin alterar la selección y limpia el error al continuar', () => {
    const first = nextFusionSelection({}, 'relic_01');
    expect(first).toEqual({ leftId: 'relic_01', rightId: null, errorId: null });
    const rejected = nextFusionSelection(first, 'relic_03');
    expect(rejected).toEqual({ leftId: 'relic_01', rightId: null, errorId: 'relic_03' });
    const compatible = nextFusionSelection(rejected, 'relic_02');
    expect(compatible).toEqual({ leftId: 'relic_01', rightId: 'relic_02', errorId: null });
    const restarted = nextFusionSelection(compatible, 'relic_01');
    expect(restarted).toEqual({ leftId: null, rightId: null, errorId: null });
    const changedFirst = nextFusionSelection(compatible, 'relic_04');
    expect(changedFirst).toEqual({ leftId: 'relic_04', rightId: null, errorId: null });
  });

  it('mantiene en la colección una reliquia sacrificada y distingue la fusionada', () => {
    const document = fakeDocument();
    const state = lootWithBosses(2);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    const fused = fuseRelics({
      state, leftId: 'relic_01', rightId: 'relic_02', operationId: 'collection', nowTimestamp: 10,
    });
    renderInventoryView(document, fused);
    renderCollectionView(document, fused);
    const inventoryHtml = document.elements.inventoryBody.innerHTML;
    const html = document.elements.collectionBody.innerHTML;
    expect(html).toContain('<small>3/?</small>');
    expect(html).toContain('data-open-relic="relic_01"');
    expect(html).toContain('not-owned');
    expect(html).toContain('fusion-relic');
    expect(html).toContain('relic-collection-unknown');
    expect(inventoryHtml).not.toContain('data-open-relic="relic_01"');
    expect(inventoryHtml).toContain('data-open-relic="fusion_01"');
    expect(renderRelicDetail(document, fused, 'fusion_01')).toBe(true);
    const detail = document.elements.relicDetailBody.innerHTML;
    expect(detail).toContain('Reduce 5 HP de la primera fuente de daño del día. El primer hábito recupera 8 Maná.');
    expect(detail).not.toContain('Corazón de Hollín:');
    expect(detail).not.toContain('Lágrima de Espectro:');
  });

  it('confirma el valor mejorado cuando la Forja tiene éxito', () => {
    const html = forgeResultMarkup({
      success: true,
      spentCoins: 50,
      spentBossBlood: 1,
      preview: { targetRank: 2 },
    }, 'Corazón de Hollín', 'relic_01');
    expect(html).toContain('5 HP');
    expect(html).toContain('7 HP');
    expect(html).toContain('Su efecto principal se ha fortalecido');
    expect(html).toContain('Se ha consumido 1 Sangre de Jefe');
    expect(html).toContain('relic_01_corazon_hollin.png');
  });

  it('explica los efectos extras directamente en el detalle', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    state.inventory.relics.relic_03.rarity = 'legendary';
    state.inventory.relics.relic_03.affixes = ['discipline'];
    renderRelicDetail(document, state, 'relic_03');
    expect(document.elements.relicDetailBody.innerHTML).toContain('Disciplina');
    expect(document.elements.relicDetailBody.innerHTML).toContain('+1 XP al completar hábitos');
    expect(document.elements.relicDetailBody.innerHTML).toContain('relic-detail-art');
    expect(document.elements.relicDetailBody.innerHTML).toContain('data-open-forge-relic="relic_03"');
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

  it('muestra el estado vacío de la Tienda sin ocultar sus recursos', () => {
    const document = fakeDocument();
    const state = lootWithBosses(2);
    renderShopView(document, state, 20 * 86400000);
    const html = document.elements.shopBody.innerHTML;
    expect(html).toContain('No hay reliquias disponibles');
    expect(html).toContain('cambia cada 3 días');
    expect(html).toContain('SANGRE DE JEFE');
  });

  it('presenta una reliquia fallada con precios y compra', () => {
    const document = fakeDocument();
    const state = grantBossRewards({
      state: {}, bossesDown: 1, source: 'victory',
      dropRandom: () => 0.99, relicRandom: () => 0.2,
      nowTimestamp: 20 * 86400000,
    });
    state.economy.coins = 200;
    state.economy.bossBlood = 2;
    renderShopView(document, state, 20 * 86400000);
    const html = document.elements.shopBody.innerHTML;
    expect(html).toContain('Corazón de Hollín');
    expect(html).toContain('data-buy-relic="relic_01"');
    expect(html).toContain('<b>150</b>');
    expect(html).toContain('<b>1</b>');
  });

  it('explica un drop fallado y ofrece ir a la Tienda', () => {
    const document = fakeDocument();
    const state = grantBossRewards({
      state: {}, bossesDown: 1, source: 'victory',
      dropRandom: () => 0.99, relicRandom: () => 0.2, nowTimestamp: 10,
    });
    renderLootNotice(document, state, state.loot.notices[0]);
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('NO CONSEGUIDA');
    expect(document.elements.lootNoticeActions.innerHTML).toContain('data-loot-shop');
  });

  it('destaca una recompensa de Sangre doble', () => {
    const document = fakeDocument();
    const state = grantBossRewards({
      state: {}, bossesDown: 1, source: 'victory',
      dropRandom: () => 0.1, relicRandom: () => 0.2,
      bloodRandom: () => 0.01, nowTimestamp: 10,
    });
    renderLootNotice(document, state, state.loot.notices[0]);
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('SANGRE DOBLE (+1)');
    expect(document.elements.lootNoticeSummary.innerHTML).toContain('<b>2</b>');
  });

  it('muestra el Bonus Victoria Anticipada sin mensaje negativo si no sale Sangre', () => {
    const document = fakeDocument();
    const state = grantBossRewards({
      state: {}, bossesDown: 1, source: 'victory',
      dropRandom: () => 0.9, bloodRandom: () => 0.5,
      earlyVictoryBonuses: [{
        id: 'boss_reward_01:early-victory:week-0', bossIndex: 0,
      }],
      earlyVictoryBloodRandom: () => 0.5,
    });
    renderLootNotice(document, state, state.loot.notices[0]);
    const html = document.elements.lootNoticeRewards.innerHTML;
    expect(html).toContain('BONUS VICTORIA ANTICIPADA');
    expect(html).toContain('+25 monedas');
    expect(html).not.toContain('+1 Sangre de Jefe');
  });
});
