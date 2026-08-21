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
  renderForgeRelicPicker,
  renderFusionView,
  renderInventoryView,
  renderLootNotice,
  renderOutfitSelector,
  renderPotionDetail,
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
    'forgeRelicPickerTitle', 'forgeRelicPickerBody', 'outfitSelectorBody',
    'relicEffectInfoDescription', 'lootNoticeTitle', 'lootNoticeIntro',
    'lootNoticeRewards', 'lootNoticeSummary', 'lootNoticeActions',
  ].map((id) => [id, { innerHTML: '', textContent: '' }]));
  return { elements, getElementById: (id) => elements[id] || null };
}

describe('interfaz de inventario y botín', () => {
  it('mantiene oculto el outfit beta hasta aceptar la recompensa de pionero', () => {
    const document = fakeDocument();
    const state = lootWithBosses(2);
    state.game = { cls: 'sorcerer', outfit: 'original' };
    renderInventoryView(document, state);
    expect(document.elements.inventoryBody.innerHTML).toContain('OUTFIT EQUIPADO');
    expect(document.elements.inventoryBody.innerHTML).toContain('Atuendo Original');
    expect(document.elements.inventoryBody.innerHTML).not.toContain('<small>EQUIPADO</small>');
    expect(document.elements.inventoryBody.innerHTML).toContain('hero_face/sorcerer_face.png');
    expect(renderOutfitSelector(document, state, 'beta-tester')).toBe('original');
    expect(document.elements.outfitSelectorBody.innerHTML.match(/outfit-option--locked/g)).toHaveLength(2);
    expect(document.elements.outfitSelectorBody.innerHTML.match(/outfit-locked-mark/g)).toHaveLength(2);
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('data-equip-outfit="beta-tester"');

    state.game.pioneerReward = { claimedAt: 1234, outfitId: 'beta-tester', coins: 130 };
    expect(renderOutfitSelector(document, state, 'beta-tester')).toBe('beta-tester');
    expect(document.elements.outfitSelectorBody.innerHTML.match(/outfit-option--locked/g)).toHaveLength(1);
    expect(document.elements.outfitSelectorBody.innerHTML.match(/outfit-locked-mark/g)).toHaveLength(1);
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('Guardián de la Brasa');
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('Vestiduras nocturnas');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('data-equip-outfit="beta-tester"');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('sprites/sorcerer_happy.png');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('outfits/beta-tester/sorcerer_happy.png');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('outfit-full-body');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('outfit-full-body--outfit-beta-tester');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('outfit-option rarity-common equipped');
    expect(document.elements.outfitSelectorBody.innerHTML).toContain('outfit-option rarity-rare selected');
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('outfit-selector-preview');
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('hero_background/');
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('<small>EQUIPADO</small>');
    expect(document.elements.outfitSelectorBody.innerHTML).not.toContain('<small>DISPONIBLE</small>');
    state.game.outfit = 'beta-tester';
    renderInventoryView(document, state);
    expect(document.elements.inventoryBody.innerHTML).toContain('outfit-portrait--outfit-beta-tester');
    expect(document.elements.inventoryBody.innerHTML).toContain('outfit-portrait--sorcerer');
  });

  it('integra los detalles de todas las pociones dentro de Efecto sin mostrar Reglas', () => {
    const document = fakeDocument();
    expect(renderPotionDetail(document, { economy: { coins: 100 } }, 'fortune', { mode: 'shop' })).toBe(true);
    const html = document.elements.relicDetailBody.innerHTML;
    expect(html).toContain('<span>EFECTO</span>');
    expect(html).toContain('Triplica el oro de tus hábitos diarios durante 30 min.');
    expect(html).toContain('Añade hasta 30 de oro extra.');
    expect(html).not.toContain('REGLAS');

    expect(renderPotionDetail(document, { economy: { coins: 100 } }, 'experience', { mode: 'shop' })).toBe(true);
    const experienceHtml = document.elements.relicDetailBody.innerHTML;
    expect(experienceHtml).toContain('+50% XP de tus hábitos diarios durante 30 min.');
    expect(experienceHtml).toContain('Añade hasta 10 XP extra.');
    expect(experienceHtml).not.toContain('REGLAS');
  });

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

  it('sitúa todas las pestañas 10 px sobre el centro y prioriza pantallas bajas', () => {
    expect(inventoryReferenceOffset(600, 400)).toBe(90);
    expect(inventoryReferenceOffset(400, 500)).toBe(0);
    expect(inventoryReferenceOffset(0, 400)).toBe(0);
  });

  it('usa iconos CSS accesibles y no imágenes para el oro y la sangre', () => {
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
    expect(document.elements.collectionBody.innerHTML).toContain('aria-label="Filtrar colección"');
    expect(document.elements.collectionBody.innerHTML).toContain('FUSIONADAS');
    expect(document.elements.collectionBody.innerHTML.match(/data-open-relic=/g)).toHaveLength(6);
    expect(inventoryAccessMarkup(state)).toContain('INVENTARIO Y FORJA');
    expect(inventoryAccessMarkup(state)).not.toContain('6 reliquias');
    expect(document.elements.inventoryBody.innerHTML).toContain('Corazón de Hollín');
    expect(document.elements.inventoryBody.innerHTML).toContain('Lágrima de Espectro');
    expect(document.elements.inventoryBody.innerHTML).toContain('relic_04_yelmo_ultima_brasa.png');
    expect(document.elements.inventoryBody.innerHTML).toContain('relic_06_colmillo_nicotina.png');
    expect(document.elements.inventoryBody.innerHTML).toContain('data-open-equip-picker="0"');
    expect(document.elements.inventoryBody.innerHTML).toContain('data-open-equip-picker="1"');
  });

  it('distingue visual y semánticamente una reliquia equipada dentro del inventario', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    state.inventory.equipped = ['relic_02'];
    state.inventory.relics.relic_02.rarity = 'mythic';
    renderInventoryView(document, state);
    const html = document.elements.inventoryBody.innerHTML;
    expect(html).toContain('aria-label="Lágrima de Espectro, MÍTICO, rango 1, Equipada"');
    expect(html).toContain('data-double-tap-unequip="relic_02"');
    expect(html).toContain('MÍTICO - RANGO 1');
    expect(html).toContain('<span>INVENTARIO</span><small>3</small>');
    const collectionHtml = html.slice(html.indexOf('<div class="relic-grid">'));
    expect(collectionHtml).not.toContain('relic-card-copy');
    expect(collectionHtml).not.toContain('relic-card-meta');
    expect(collectionHtml).toContain('relic-collection-item');
    expect(html).toContain('data-open-equip-picker="1"');
  });

  it('abre un selector de equipamiento para el slot vacío', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    state.inventory.equipped = ['relic_01'];
    renderForgeRelicPicker(document, state, { mode: 'equip', slot: 1 });
    expect(document.elements.forgeRelicPickerTitle.textContent).toBe('Elegir reliquia · Slot 2');
    const html = document.elements.forgeRelicPickerBody.innerHTML;
    expect(html).toContain('data-picker-filter="fusion"');
    expect(html).toContain('EQUIPADA');
    expect(html).toContain('data-pick-forge-relic="relic_02"');
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
    expect(html).toContain('Valor actual: 30 XP');
    expect(html).toContain('+3 puntos porcentuales en la Forja.');
  });

  it('mantiene conciso el efecto principal del Frasco del Antojo Roto', () => {
    const document = fakeDocument();
    const state = lootWithBosses(5);
    expect(renderRelicDetail(document, state, 'relic_05')).toBe(true);
    const html = document.elements.relicDetailBody.innerHTML;
    expect(html).toContain('Recupera Maná cada 30 minutos mientras está equipado.');
    expect(html).toContain('30% MANÁ/DÍA');
    expect(html).not.toContain('hasta alcanzar su porcentaje diario');
    expect(html).toContain('Valor actual: 30% MANÁ/DÍA');
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
    expect(html).toContain('data-open-forge-picker="upgrade"');
    expect(html).toContain('forge-animated-slot--upgrade');
    expect(html).toContain('Pity');
    expect(html).toContain('Probabilidad <b>70%</b>');
    expect(html).toContain('RANGO 1 <i aria-hidden="true">→</i> RANGO 2');
    expect(html).toContain('5% MANÁ MÁX.');
    expect(html).toContain('7% MANÁ MÁX.');
    expect(html).toContain('La Sangre de Jefe solo se consume si la mejora tiene éxito');
    expect(html).toContain('class="forge-attempt"');
    expect(html).toContain('>FORJAR</button>');
    expect(html).toContain('class="forge-toolbar"');
  });

  it('mantiene vacío el slot de Mejora hasta que se elige una reliquia', () => {
    const document = fakeDocument();
    const state = lootWithBosses(3);
    expect(renderForgeView(document, state, null)).toBeNull();
    const html = document.elements.forgeBody.innerHTML;
    expect(html).toContain('data-open-forge-picker="upgrade"');
    expect(html).toContain('forge-focus--empty');
    expect(html).toContain('forge-focus-picker fusion-slot');
    expect(html).toContain('forge-animated-slot--upgrade');
    expect(html).toContain('Coste pendiente de seleccionar una reliquia');
    expect(html).toContain('<b>?</b>');
    expect(html).toContain('class="forge-attempt" disabled>FORJAR</button>');
    expect(html).not.toContain('Corazón de Ojin');
    expect(html).not.toContain('forge-focus-picker fusion-slot"><span>?</span>');
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

  it('previsualiza una receta nueva completa, muestra incompatibilidades y conserva el resultado real', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    state.inventory.relics.relic_01.rarity = 'legendary';
    state.inventory.relics.relic_01.rank = 2;
    state.inventory.relics.relic_01.affixes = ['vitality'];
    state.inventory.relics.relic_02.rarity = 'legendary';
    state.inventory.relics.relic_02.affixes = ['arcane'];
    const beforePreview = JSON.stringify(state);
    renderFusionView(document, state, 'relic_01', 'relic_02');
    expect(document.elements.forgeBody.innerHTML).toContain('fusion-flow has-pair');
    expect(document.elements.forgeBody.innerHTML).toContain('Corazón Espectral');
    expect(document.elements.forgeBody.innerHTML).toContain('fusion_01_corazon_espectral.png');
    expect(document.elements.forgeBody.innerHTML).not.toContain('<span>RESULTADO</span>');
    expect(document.elements.forgeBody.innerHTML).toContain('MÍTICO');
    expect(document.elements.forgeBody.innerHTML).toContain('RANGO 2');
    expect(document.elements.forgeBody.innerHTML).toContain('Reduce 7 HP de la primera fuente de daño del día. El primer hábito recupera 8% del Maná máximo.');
    expect(document.elements.forgeBody.innerHTML).toContain('POTENCIA HEREDADA');
    expect(document.elements.forgeBody.innerHTML).toContain('7 HP · 5% MANÁ MÁX.');
    expect(document.elements.forgeBody.innerHTML).toContain('EFECTOS EXTRAS · ');
    expect(document.elements.forgeBody.innerHTML).toContain('data-relic-effect="vitality">Vitalidad</button>');
    expect(document.elements.forgeBody.innerHTML).toContain('data-relic-effect="arcane">Arcano</button>');
    expect(document.elements.forgeBody.innerHTML).toContain('70% ÉXITO');
    expect(document.elements.forgeBody.innerHTML).not.toContain('???');
    expect(JSON.stringify(state)).toBe(beforePreview);
    renderFusionView(document, state, 'relic_03', 'relic_06');
    expect(document.elements.forgeBody.innerHTML).toContain('Estas reliquias no pueden fusionarse');
    expect(document.elements.forgeBody.innerHTML).not.toContain('fusion-result-preview');
    expect(document.elements.forgeBody.innerHTML).toContain('data-fuse-relics="relic_03|relic_06" disabled');
    const fused = fuseRelics({
      state, leftId: 'relic_01', rightId: 'relic_02', operationId: 'ui-fusion', randomValue: 0, nowTimestamp: 10,
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

  it('permite cambiar el slot ocupado, abre el vacío y muestra feedback dentro de la Forja', () => {
    const document = fakeDocument();
    const state = lootWithBosses(6);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    renderFusionView(document, state, 'relic_01', null, { errorId: 'relic_03' });
    const html = document.elements.forgeBody.innerHTML;
    expect(html).toContain('data-open-filled-fusion-slot="left"');
    expect(html).toContain('Doble toque para quitarla');
    expect(html).toContain('forge-animated-slot--fusion');
    expect(html).toContain('data-fusion-slot="right"');
    expect(html).not.toContain('<span>?</span>');
    expect(html).not.toContain('<small>SLOT B</small>');
    expect(html).toContain('Estas reliquias no pueden fusionarse.');
    expect(html).toContain('Selecciona otra reliquia compatible.');
    expect(html).toContain('data-fuse-relics="relic_01|" disabled');
    renderForgeRelicPicker(document, state, { mode: 'fusion', slot: 'right', leftId: 'relic_01' });
    expect(document.elements.forgeRelicPickerTitle.textContent).toContain('Slot B');
    expect(document.elements.forgeRelicPickerBody.innerHTML).toContain('data-picker-filter="normal"');
    expect(document.elements.forgeRelicPickerBody.innerHTML).toContain('INCOMPATIBLE');
    expect(document.elements.forgeRelicPickerBody.innerHTML).toContain('disabled aria-disabled="true"');
    renderForgeRelicPicker(document, state, { mode: 'fusion', slot: 'left', leftId: 'relic_01' });
    expect(document.elements.forgeRelicPickerBody.innerHTML).toContain('SELECCIONADA');
  });

  it('rechaza una segunda incompatible sin alterar la selección y limpia el error al continuar', () => {
    const first = nextFusionSelection({}, 'relic_01');
    expect(first).toEqual({ leftId: 'relic_01', rightId: null, errorId: null });
    const rejected = nextFusionSelection(first, 'relic_03');
    expect(rejected).toEqual({ leftId: 'relic_01', rightId: null, errorId: 'relic_03' });
    const compatible = nextFusionSelection(rejected, 'relic_02');
    expect(compatible).toEqual({ leftId: 'relic_01', rightId: 'relic_02', errorId: null });
    const restarted = nextFusionSelection(compatible, 'relic_01');
    expect(restarted).toEqual({ leftId: 'relic_02', rightId: null, errorId: null });
    const removedSecond = nextFusionSelection(compatible, 'relic_02');
    expect(removedSecond).toEqual({ leftId: 'relic_01', rightId: null, errorId: null });
    const changedFirst = nextFusionSelection(compatible, 'relic_04');
    expect(changedFirst).toEqual({ leftId: 'relic_04', rightId: null, errorId: null });
  });

  it('mantiene en la colección una reliquia sacrificada y distingue la fusionada', () => {
    const document = fakeDocument();
    const state = lootWithBosses(2);
    state.economy.coins = 500;
    state.economy.bossBlood = 5;
    const fused = fuseRelics({
      state, leftId: 'relic_01', rightId: 'relic_02', operationId: 'collection', randomValue: 0, nowTimestamp: 10,
    });
    renderInventoryView(document, fused);
    renderCollectionView(document, fused);
    const inventoryHtml = document.elements.inventoryBody.innerHTML;
    const html = document.elements.collectionBody.innerHTML;
    expect(html).toContain('<small>3/?</small>');
    expect(html).toContain('data-open-relic="relic_01"');
    expect(html).toContain('not-owned');
    expect(html).toContain('fusion-relic');
    expect(html).toContain('relic-art--fusion');
    expect(html).toContain('relic-collection-unknown');
    expect(inventoryHtml).not.toContain('data-open-relic="relic_01"');
    expect(inventoryHtml).toContain('data-open-relic="fusion_01"');
    expect(inventoryHtml).toContain('fusion-relic');
    expect(inventoryHtml).toContain('data-relic-kind="fusion"');
    expect(inventoryHtml).toContain('relic-art--fusion');
    expect(renderRelicDetail(document, fused, 'fusion_01')).toBe(true);
    const detail = document.elements.relicDetailBody.innerHTML;
    expect(detail).toContain('Reduce 5 HP de la primera fuente de daño del día. El primer hábito recupera 8% del Maná máximo.');
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
    expect(document.elements.relicDetailBody.innerHTML).toContain('+1 XP extra al completar hábitos. No cuenta para el límite de XP.');
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
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('aria-label="160 de oro"');
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('Sangre de Jefe');
    expect(document.elements.lootNoticeSummary.innerHTML).toBe('');
  });

  it('usa el cofre pixel art en recompensas nuevas', () => {
    const document = fakeDocument();
    const state = lootWithBosses(1, 'victory');
    renderLootNotice(document, state, state.loot.notices[0]);
    expect(document.elements.lootNoticeRewards.innerHTML).toContain(
      'relics/boss_loot_chest_open_sapphire.png',
    );
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('data-loot-open-relic');
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('loot-reward-empty');
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('loot-resource-slot');
    expect(document.elements.lootNoticeActions.innerHTML).toBe(
      '<button type="button" data-loot-continue>CONFIRMAR</button>',
    );
    expect(document.elements.lootNoticeActions.innerHTML).not.toContain('data-loot-equip');
    const rewardsHtml = document.elements.lootNoticeRewards.innerHTML;
    expect(rewardsHtml.indexOf('data-loot-open-relic')).toBeLessThan(rewardsHtml.indexOf('de Sangre de Jefe'));
    expect(rewardsHtml.indexOf('de Sangre de Jefe')).toBeLessThan(rewardsHtml.indexOf(' de oro'));
    expect(rewardsHtml.indexOf(' de oro')).toBeLessThan(rewardsHtml.indexOf('loot-reward-empty'));
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
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('no conseguida');
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
    expect(document.elements.lootNoticeRewards.innerHTML).toContain('aria-label="2 de Sangre de Jefe"');
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
    expect(html).toContain('+25 oro');
    expect(html).not.toContain('+1 Sangre de Jefe');
  });
});
