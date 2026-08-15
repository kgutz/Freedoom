import {
  AFFIX_DEFINITIONS,
  ALL_RELIC_DEFINITIONS,
  CHARGE_MECHANICS,
  FUSION_RELIC_DEFINITIONS,
  RARITIES,
  RELIC_DEFINITIONS,
  fusionDefinition,
  relicDefinition,
  relicRankEffect,
} from '../data/loot-data.js';
import {
  forgePreview,
  getForgeFusionPreview,
  fusionRecipeStatus,
  ensureShopRotation,
  normalizeLootState,
  shopOffers,
} from '../domain/loot-rules.js';
import { BOSSES } from '../data/game-data.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function resourceIcon(type) {
  const label = type === 'coin' ? 'Monedas' : 'Sangre de Jefe';
  return `<span class="resource-icon resource-icon--${type}" role="img" aria-label="${label}"></span>`;
}

export function resourceValue(type, value, label = '') {
  return `<span class="resource-value">${resourceIcon(type)}<b>${Math.max(0, Number(value) || 0)}</b>${label ? `<small>${label}</small>` : ''}</span>`;
}

function relicArt(definition, overlay = '') {
  if (definition.ingredientIds?.length === 2 && !definition.image) {
    const ingredients = definition.ingredientIds.map((id) => relicDefinition(id));
    return `<div class="relic-art relic-art--fusion relic-art--${definition.id}">
      ${ingredients.map((ingredient, index) => `<img class="fusion-art-part fusion-art-part--${index + 1}" src="${ingredient.image}" alt="" aria-hidden="true">`).join('')}
      <span class="fusion-art-sigil" aria-hidden="true">✦</span>
      ${overlay}
    </div>`;
  }
  const fusionClass = definition.ingredientIds?.length === 2 ? ' relic-art--fusion' : '';
  return `<div class="relic-art${fusionClass} relic-art--${definition.id}">
    <img src="${definition.image}" alt="${escapeHtml(definition.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="relic-art-fallback" style="display:none">${Number.isInteger(definition.bossIndex) ? definition.bossIndex + 1 : '✦'}</span>
    ${overlay}
  </div>`;
}

function affixInfoLink(id, extraClass = '') {
  const affix = AFFIX_DEFINITIONS[id];
  if (!affix) return '';
  return `<button type="button" class="relic-effect-link${extraClass ? ` ${extraClass}` : ''}" data-relic-effect="${escapeHtml(id)}">${escapeHtml(affix.name)}</button>`;
}

export function rarityClass(rarity) {
  return `rarity-${RARITIES[rarity] ? rarity : 'rare'}`;
}

export function chargeIndicatorMarkup({ mechanicId, chargeState = {}, rarity = 'rare', nowTimestamp = Date.now() }) {
  const mechanic = CHARGE_MECHANICS[mechanicId];
  if (!mechanic) return '';
  const charge = Math.min(mechanic.max, Math.max(0, Math.trunc(Number(chargeState.charge) || 0)));
  const recentIncrease = charge > 0 && Number(chargeState.lastIncreaseCharge) === charge &&
    Math.max(0, Number(nowTimestamp) - Number(chargeState.lastIncreaseAt)) <= 1800;
  const dots = Array.from({ length: mechanic.max }, (_, index) => {
    const active = index < charge;
    const newlyCharged = active && recentIncrease && index === charge - 1;
    return `<i class="relic-charge-dot${active ? ' active' : ''}${newlyCharged ? ' newly-charged' : ''}" aria-hidden="true"></i>`;
  }).join('');
  return `<span class="relic-charge-indicator ${rarityClass(rarity)}${charge === mechanic.max ? ' complete' : ''}" role="img" aria-label="${escapeHtml(mechanic.label)}: ${charge} de ${mechanic.max}">${dots}</span>`;
}

export function inventoryReferenceOffset(availableHeight, referenceHeight) {
  const available = Math.max(0, Number(availableHeight) || 0);
  const reference = Math.max(0, Number(referenceHeight) || 0);
  return Math.max(0, Math.floor((available - Math.min(reference, available)) / 2));
}

export function closeForgeInfoOutside(document, target) {
  let closed = 0;
  document.querySelectorAll?.('.forge-info[open]').forEach((details) => {
    if (!details.contains(target)) {
      details.removeAttribute('open');
      closed += 1;
    }
  });
  return closed;
}

export function nextFusionSelection({ leftId = null, rightId = null } = {}, relicId) {
  if (!relicId) return { leftId, rightId, errorId: null };
  if (leftId === relicId) return { leftId: null, rightId: null, errorId: null };
  if (rightId === relicId) return { leftId, rightId: null, errorId: null };
  if (!leftId) return { leftId: relicId, rightId: null, errorId: null };
  if (rightId) return { leftId: relicId, rightId: null, errorId: null };
  if (fusionRecipeStatus(leftId, relicId).status !== 'available') {
    return { leftId, rightId: null, errorId: relicId };
  }
  return { leftId, rightId: relicId, errorId: null };
}

function relicEffectValue(relicId, value) {
  if (relicId === 'relic_01') return `${value} HP`;
  if (relicId === 'relic_02' || relicId === 'relic_05') return `${value} MANÁ`;
  return `${value} XP`;
}

function fusionEffectDescription(definition, relic) {
  const value = (baseId) => Math.max(0, Number(relic.inheritedEffects?.[baseId]) || 0);
  if (definition.id === 'fusion_01') {
    return `Reduce ${value('relic_01')} HP de la primera fuente de daño del día. El primer hábito recupera ${value('relic_02') + 3} Maná.`;
  }
  if (definition.id === 'fusion_02') {
    return `Reduce ${value('relic_01')} HP de la primera fuente de daño del día. La Constancia concede ${value('relic_04')} XP y alcanzar seis días cumplidos otorga 20 XP adicionales.`;
  }
  if (definition.id === 'fusion_03') {
    return `El primer hábito recupera ${value('relic_02')} Maná. El primer hechizo cuesta ${value('relic_05')} Maná menos, o ${value('relic_05') + 3} menos si antes completas un hábito.`;
  }
  if (definition.id === 'fusion_04') {
    return `El primer hábito concede ${value('relic_03')} XP y el primer hechizo cuesta ${value('relic_05')} Maná menos. Completar todos los hábitos diarios otorga 5 XP adicionales.`;
  }
  if (definition.id === 'fusion_05') {
    return `La Constancia concede ${value('relic_04')} XP y cada día cumplido otorga ${value('relic_06')} XP. Alcanzar seis días cumplidos concede 25 XP adicionales.`;
  }
  return definition.effectLabel;
}

function forgeUpgradeMarkup(relicId, currentRank, targetRank) {
  const current = relicEffectValue(relicId, relicRankEffect(relicId, currentRank));
  const target = relicEffectValue(relicId, relicRankEffect(relicId, targetRank));
  return `<div class="forge-upgrade-preview">
    <span>RANGO ${currentRank} <i aria-hidden="true">→</i> RANGO ${targetRank}</span>
    <div><b>${current}</b><i aria-hidden="true">→</i><strong>${target}</strong></div>
  </div>`;
}

function forgeRankStars(rank) {
  return `${'★'.repeat(Math.max(0, Math.min(3, rank)))}${'☆'.repeat(Math.max(0, 3 - rank))}`;
}

export function relicCardMarkup({
  definition, relic, equipped = false, slot = null, chargeState = null, nowTimestamp = Date.now(),
}) {
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const isActiveSlot = slot !== null;
  const statusMarkup = isActiveSlot
    ? `<span class="relic-active-meta">${rarity.label} - RANGO ${relic.rank}</span>`
    : `<span class="relic-card-meta rarity-label">${rarity.label} · RANGO ${relic.rank}</span>`;
  const accessibleName = `${definition.name}, ${rarity.label}, rango ${relic.rank}${equipped ? ', Equipada' : ''}`;
  const chargeIndicator = isActiveSlot && definition.chargeMechanic
    ? chargeIndicatorMarkup({
        mechanicId: definition.chargeMechanic,
        chargeState,
        rarity: relic.rarity,
        nowTimestamp,
      })
    : '';
  return `<button type="button" class="relic-card ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}${chargeIndicator ? ' has-charge' : ''}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}"${isActiveSlot ? ` data-equipped-slot="${slot}"` : ''}>
    ${relicArt(definition, chargeIndicator)}
    <span class="relic-card-copy">
      <b>${escapeHtml(definition.name)}</b>
      ${statusMarkup}
    </span>
  </button>`;
}

function relicCollectionItemMarkup({ definition, relic, equipped = false }) {
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const accessibleName = `${definition.name}, ${rarity.label}, rango ${relic.rank}${equipped ? ', Equipada' : ''}`;
  const fusion = Boolean(definition.recipeId);
  return `<button type="button" class="relic-collection-item ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}${fusion ? ' fusion-relic' : ''}${relic.currentlyOwned === false ? ' not-owned' : ''}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}">
    ${relicArt(definition)}
  </button>`;
}

export function inventoryAccessMarkup(lootState) {
  const normalized = normalizeLootState(lootState);
  return `<div class="hero-inventory-access">
    <div class="hero-inventory-copy">
      <span>INVENTARIO Y FORJA</span>
    </div>
    <div class="hero-resources">
      ${resourceValue('coin', normalized.economy.coins)}
      ${resourceValue('boss-blood', normalized.economy.bossBlood)}
    </div>
    <button type="button" data-open-inventory>ABRIR</button>
  </div>`;
}

export function renderInventoryView(document, lootState) {
  const normalized = normalizeLootState(lootState);
  const equipped = normalized.inventory.equipped;
  const equippedSlots = [0, 1].map((slot) => {
    const relicId = equipped[slot];
    const relic = normalized.inventory.relics[relicId];
    const definition = relicDefinition(relicId);
    return relic && definition
      ? relicCardMarkup({
          definition,
          relic,
          equipped: true,
          slot,
          chargeState: normalized.inventory.constancy,
        })
      : `<div class="relic-slot-empty"><span>SLOT ${slot + 1}</span><b>VACÍO</b></div>`;
  }).join('');
  const inventory = ALL_RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id])
    .map((definition) => relicCollectionItemMarkup({
      definition,
      relic: normalized.inventory.relics[definition.id],
      equipped: equipped.includes(definition.id),
    }))
    .join('');
  const body = document.getElementById('inventoryBody');
  if (!body) return;
  body.innerHTML = `
    <section class="inventory-resources">
      ${resourceValue('coin', normalized.economy.coins, 'MONEDAS')}
      ${resourceValue('boss-blood', normalized.economy.bossBlood, 'SANGRE DE JEFE')}
    </section>
    <section class="inventory-section" id="inventoryEquippedSection">
      <div class="inventory-section-head"><span>RELIQUIAS ACTIVAS</span><small>2 MÁXIMO</small></div>
      <div class="equipped-relics">${equippedSlots}</div>
    </section>
    <section class="inventory-section">
      <div class="inventory-section-head"><span>INVENTARIO</span><small>${Object.keys(normalized.inventory.relics).length}</small></div>
      <div class="relic-grid">${inventory || '<div class="inventory-empty">No tienes reliquias disponibles.</div>'}</div>
    </section>`;
}

export function renderCollectionView(document, lootState) {
  const normalized = normalizeLootState(lootState);
  const equipped = normalized.inventory.equipped;
  const collection = ALL_RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.collection[definition.id])
    .map((definition) => relicCollectionItemMarkup({
      definition,
      relic: {
        ...normalized.inventory.collection[definition.id].lastOwnedRecord,
        currentlyOwned: Boolean(normalized.inventory.relics[definition.id]),
      },
      equipped: equipped.includes(definition.id),
    }))
    .join('');
  const body = document.getElementById('collectionBody');
  if (!body) return;
  body.innerHTML = `
    <section class="inventory-section collection-section">
      <div class="inventory-section-head"><span>COLECCIÓN</span><small>${Object.keys(normalized.inventory.collection).length}/?</small></div>
      <p class="collection-hint">Aquí permanecen todas las reliquias que has descubierto, incluso si ya no están en tu Inventario.</p>
      <div class="relic-grid">${collection}<div class="relic-collection-unknown" aria-label="Reliquia desconocida">?</div>${collection ? '' : '<div class="inventory-empty">Derrota a tu primer jefe para descubrir una reliquia.</div>'}</div>
    </section>`;
}

export function renderRelicDetail(document, lootState, relicId) {
  const normalized = normalizeLootState(lootState);
  const relic = normalized.inventory.relics[relicId] ||
    normalized.inventory.collection[relicId]?.lastOwnedRecord;
  const definition = relicDefinition(relicId);
  const body = document.getElementById('relicDetailBody');
  if (!body || !relic || !definition) return false;
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const owned = Boolean(normalized.inventory.relics[relicId]);
  const equipped = owned && normalized.inventory.equipped.includes(relicId);
  const equipmentActions = !owned
    ? '<div class="relic-not-owned">DESCUBIERTA · NO POSEÍDA</div>'
    : equipped
    ? `<button type="button" data-unequip-relic="${relicId}">DESEQUIPAR</button>`
    : normalized.inventory.equipped.length < 2
      ? `<button type="button" data-equip-relic="${relicId}">EQUIPAR</button>`
      : normalized.inventory.equipped.map((equippedId, index) => {
          const current = relicDefinition(equippedId);
          return `<button type="button" data-equip-relic="${relicId}" data-replace-slot="${index}">SUSTITUIR ${escapeHtml(current?.name || `SLOT ${index + 1}`)}</button>`;
        }).join('');
  const affixes = relic.affixes.length
    ? relic.affixes.map((id) => {
        const affix = AFFIX_DEFINITIONS[id];
        return `<li>${affixInfoLink(id)}<p>${escapeHtml(affix.description)}</p></li>`;
      }).join('')
    : '<li class="no-affixes">Esta rareza no posee efectos extras.</li>';
  const fusion = Boolean(definition.recipeId);
  const effect = fusion ? 0 : relicRankEffect(relicId, relic.rank);
  const constancy = relicId === 'relic_04' || relic.inheritedEffects?.relic_04
    ? `<div class="relic-constancy" aria-label="Carga de Constancia"><span>CONSTANCIA</span><b>Carga actual: ${Math.min(6, Math.max(0, Number(normalized.inventory.constancy?.charge) || 0))}/6</b></div>`
    : '';
  body.innerHTML = `<div class="relic-detail-frame ${rarityClass(relic.rarity)}">
      <div class="relic-detail-art">${relicArt(definition)}</div>
      <div class="rarity-label">${rarity.label}</div>
      <h3>${escapeHtml(definition.name)}</h3>
      <div class="relic-rank">RANGO ${relic.rank}${fusion ? ' · RELIQUIA FUSIONADA' : ''}</div>
    </div>
    ${constancy}
    <div class="relic-effect"><span>EFECTO PRINCIPAL</span><p>${fusion ? escapeHtml(fusionEffectDescription(definition, relic)) : `${escapeHtml(definition.effectLabel)} <b>Valor actual: ${effect}${relicId === 'relic_01' ? ' HP' : relicId === 'relic_02' || relicId === 'relic_05' ? ' Maná' : ' XP'}</b>`}</p></div>
    <div class="relic-affixes"><span>EFECTOS EXTRAS</span><ul>${affixes}</ul></div>
    <div class="relic-equip-actions">
      ${equipmentActions}
      ${owned && !fusion ? `<button type="button" class="relic-forge-shortcut" data-open-forge-relic="${relicId}">FORJAR</button>` : ''}
    </div>`;
  return true;
}

export function renderRelicEffectInfo(document, effectId) {
  const effect = AFFIX_DEFINITIONS[effectId];
  if (!effect) return false;
  const title = document.getElementById('relicEffectInfoTitle');
  const description = document.getElementById('relicEffectInfoDescription');
  if (!title || !description) return false;
  title.textContent = effect.name;
  description.textContent = effect.description;
  return true;
}

export function renderForgeView(document, lootState, selectedRelicId = null, options = {}) {
  const normalized = normalizeLootState(lootState);
  const mode = options.mode === 'fusion' ? 'fusion' : 'upgrade';
  const ownedDefinitions = RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id]);
  const selectedDefinition = ownedDefinitions.find((definition) => definition.id === selectedRelicId)
    || ownedDefinitions[0]
    || null;
  const body = document.getElementById('forgeBody');
  if (!body) return null;
  if (mode === 'fusion') {
    renderFusionView(document, normalized, options.fusionLeftId, options.fusionRightId, {
      errorId: options.fusionErrorId,
    });
    return selectedRelicId;
  }
  if (!selectedDefinition) {
    body.innerHTML = `${forgeModeTabs('upgrade')}<div class="forge-empty">
      <div class="forge-empty-slot">?</div>
      <h3>LA FORJA ESPERA</h3>
      <p>Derrota a un jefe para conseguir tu primera reliquia.</p>
    </div>`;
    return null;
  }
  const relicId = selectedDefinition.id;
  const relic = normalized.inventory.relics[relicId];
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const preview = forgePreview(normalized, relicId);
  const forgeControls = preview.ok
    ? `${forgeUpgradeMarkup(relicId, relic.rank, preview.targetRank)}
      <div class="forge-cost" aria-label="Coste de la mejora">
        <span>COSTE</span>
        ${resourceValue('coin', preview.cost)}
        ${resourceValue('boss-blood', preview.bloodRequired)}
      </div>
      <button type="button" class="forge-attempt" data-forge-relic="${relicId}"${preview.coinsAvailable < preview.cost || preview.bloodAvailable < preview.bloodRequired ? ' disabled' : ''}>FORJAR</button>
      <details class="forge-info">
        <summary>PROBABILIDAD ${preview.finalProbability}% <span aria-hidden="true">ⓘ</span></summary>
        <div class="forge-info-popover"><div><span>Pity <b>${preview.pityProbability}%</b></span><span>Fortuna <b>+${preview.fortune}%</b></span></div>
        <p>Las monedas se gastan en cada intento. La Sangre de Jefe solo se consume si la mejora tiene éxito.</p></div>
      </details>`
    : `<div class="forge-upgrade-preview forge-upgrade-max">
        <span>EFECTO ACTUAL</span>
        <div><strong>${relicEffectValue(relicId, relicRankEffect(relicId, relic.rank))}</strong></div>
      </div><div class="forge-max">RANGO MÁXIMO ALCANZADO</div>`;
  const choices = ownedDefinitions.map((definition) => {
    const choiceRelic = normalized.inventory.relics[definition.id];
    return `<button type="button" class="forge-relic-choice ${rarityClass(choiceRelic.rarity)}${definition.id === relicId ? ' selected' : ''}" data-select-forge-relic="${definition.id}" aria-label="Forjar ${escapeHtml(definition.name)}">
      ${relicArt(definition)}
      <span class="forge-choice-rank" aria-hidden="true">${choiceRelic.rank}</span>
    </button>`;
  }).join('');
  body.innerHTML = `
    ${forgeModeTabs('upgrade')}
    <div class="forge-toolbar"><strong>MEJORAR</strong><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div>
    <section class="forge-collection" aria-label="Selecciona una reliquia">
      <div class="forge-relic-grid">${choices}</div>
    </section>
    <section class="forge-focus ${rarityClass(relic.rarity)}">
      <div class="forge-focus-art">${relicArt(selectedDefinition)}</div>
      <h3>${escapeHtml(selectedDefinition.name)}</h3>
      <div class="forge-rank-line"><span>${forgeRankStars(relic.rank)}</span><b>${rarity.label} · RANGO ${relic.rank}</b></div>
      <p class="forge-current-effect">${escapeHtml(selectedDefinition.effectLabel)} <strong>${relicEffectValue(relicId, relicRankEffect(relicId, relic.rank))}</strong></p>
      <div class="forge-panel">${forgeControls}</div>
    </section>`;
  return relicId;
}

function forgeModeTabs(active) {
  return `<div class="forge-mode-tabs" role="tablist" aria-label="Modo de Forja">
    <button type="button" data-forge-mode="upgrade" class="${active === 'upgrade' ? 'active' : ''}" aria-selected="${active === 'upgrade'}">MEJORAR</button>
    <button type="button" data-forge-mode="fusion" class="${active === 'fusion' ? 'active' : ''}" aria-selected="${active === 'fusion'}">FUSIONAR</button>
  </div>`;
}

function fusionSlotMarkup(definition, label) {
  return definition
    ? `<div class="fusion-slot filled">${relicArt(definition)}<small>${escapeHtml(definition.name)}</small></div>`
    : `<div class="fusion-slot"><span>?</span><small>${label}</small></div>`;
}

function fusionInheritedPowerMarkup(preview) {
  const inherited = Object.entries(preview.inheritedEffects || {})
    .map(([relicId, value]) => relicEffectValue(relicId, value));
  return inherited.length
    ? `<p class="fusion-preview-inherited"><span>POTENCIA HEREDADA</span><b>${inherited.map(escapeHtml).join(' · ')}</b></p>`
    : '';
}

function fusionResultPreviewMarkup(preview) {
  const definition = preview.definition;
  const relic = preview.resultRelic;
  if (!definition || !relic) return '';
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const extras = relic.affixes.length
    ? relic.affixes.map((id) => AFFIX_DEFINITIONS[id]?.name).filter(Boolean).join(' · ')
    : 'NINGUNO';
  const rarityCopy = preview.qualityDeterministic ? rarity.label : '???';
  const extrasCopy = preview.qualityDeterministic ? extras : '???';
  const extrasMarkup = preview.qualityDeterministic && relic.affixes.length
    ? relic.affixes.map((id) => affixInfoLink(id, 'fusion-preview-effect-link')).filter(Boolean).join('<span aria-hidden="true"> · </span>')
    : escapeHtml(extrasCopy);
  return `<article class="fusion-result-preview ${rarityClass(relic.rarity)}">
    <div class="fusion-preview-art">${relicArt(definition)}</div>
    <div class="fusion-preview-copy">
      <span>RESULTADO</span>
      <h3>${escapeHtml(definition.name)}</h3>
      <b class="fusion-preview-quality">${escapeHtml(rarityCopy)} · RANGO ${relic.rank}</b>
      <p>${escapeHtml(fusionEffectDescription(definition, relic))}</p>
      ${fusionInheritedPowerMarkup(preview)}
      <small class="fusion-preview-affixes"><span>EFECTOS EXTRAS · </span>${extrasMarkup}</small>
    </div>
  </article>`;
}

export function renderFusionView(document, lootState, leftId = null, rightId = null, options = {}) {
  const normalized = normalizeLootState(lootState);
  const body = document.getElementById('forgeBody');
  if (!body) return null;
  const left = relicDefinition(leftId);
  const right = relicDefinition(rightId);
  const preview = getForgeFusionPreview(normalized, leftId, rightId);
  const resultMarkup = fusionResultPreviewMarkup(preview);
  const statusCopy = preview.reason === 'same-relic'
    ? 'Selecciona dos reliquias diferentes.'
    : preview.status === 'incompatible'
      ? 'Estas reliquias no pueden fusionarse.'
      : preview.status === 'not-designed'
        ? 'Esta combinación todavía no está disponible.'
        : preview.reason === 'already-owned'
          ? 'Ya posees esta reliquia fusionada.'
          : preview.reason === 'coins'
            ? 'No tienes suficientes monedas.'
            : preview.reason === 'blood'
              ? 'No tienes suficiente Sangre de Jefe.'
              : preview.definition ? 'Resultado listo · fusión 100% segura.' : 'Elige dos reliquias base.';
  const choices = RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id])
    .map((definition) => {
      const relic = normalized.inventory.relics[definition.id];
      const selected = definition.id === leftId || definition.id === rightId;
      const position = definition.id === leftId ? 1 : definition.id === rightId ? 2 : null;
      const incompatible = Boolean(leftId && !selected &&
        fusionRecipeStatus(leftId, definition.id).status !== 'available');
      const rejected = options.errorId === definition.id;
      return `<button type="button" class="forge-relic-choice ${rarityClass(relic.rarity)}${selected ? ' selected' : ''}${position === 1 ? ' fusion-first-selected' : ''}${incompatible ? ' fusion-incompatible' : ''}${rejected ? ' fusion-choice-error' : ''}" data-select-fusion-relic="${definition.id}" aria-label="Seleccionar ${escapeHtml(definition.name)}${incompatible ? ', incompatible con la primera reliquia' : ''}"${incompatible ? ' aria-disabled="true"' : ''}>${relicArt(definition)}<span class="forge-choice-rank">${relic.rank}</span>${position ? `<span class="fusion-choice-order" aria-hidden="true">${position}</span>` : ''}</button>`;
    }).join('');
  const selectionFeedback = options.errorId
    ? '<p class="fusion-status error" role="status"><strong>Estas reliquias no pueden fusionarse.</strong><small>Selecciona otra reliquia compatible.</small></p>'
    : `<p class="fusion-status ${preview.status === 'incompatible' ? 'error' : ''}">${escapeHtml(statusCopy)}</p>`;
  body.innerHTML = `${forgeModeTabs('fusion')}
    <div class="forge-toolbar"><strong>FUSIONAR</strong><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div>
    <section class="fusion-flow" aria-label="Receta de Fusión">
      <div class="fusion-ingredients">${fusionSlotMarkup(left, 'SLOT A')}<b>+</b>${fusionSlotMarkup(right, 'SLOT B')}</div>
      ${resultMarkup ? `<b class="fusion-result-arrow" aria-hidden="true">↓</b>${resultMarkup}` : ''}
    </section>
    ${selectionFeedback}
    <div class="forge-cost fusion-cost"><span>COSTE</span>${resourceValue('coin', preview.coinCost)}${resourceValue('boss-blood', preview.bloodCost)}${preview.successProbability ? `<b>${preview.successProbability}% ÉXITO</b>` : ''}</div>
    <button type="button" class="forge-attempt fusion-attempt" data-fuse-relics="${escapeHtml(leftId || '')}|${escapeHtml(rightId || '')}"${preview.ok ? '' : ' disabled'}>FUSIONAR</button>
    <details class="forge-info fusion-info"><summary>¿CÓMO FUNCIONA? <span aria-hidden="true">ⓘ</span></summary><div class="forge-info-popover"><p>La Fusión es segura, pero consume permanentemente las dos reliquias base. Podrás recuperarlas después mediante la Tienda.</p><p>La rareza y el rango más altos están garantizados. Cada efecto conserva la potencia exacta que tenía en su reliquia de origen: fusionar no lo mejora gratis.</p><p>Un efecto extra asegura Legendario y dos o más aseguran Mítico. Los efectos diferentes se conservan sin duplicarse.</p></div></details>
    <section class="forge-collection" aria-label="Selecciona dos reliquias"><div class="forge-relic-grid">${choices || '<span class="forge-empty-copy">Necesitas dos reliquias base.</span>'}</div></section>`;
  return { preview, leftId, rightId };
}

function shopTimeLabel(endsAt, nowTimestamp) {
  const remaining = Math.max(0, endsAt - nowTimestamp);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.ceil((remaining % 86400000) / 3600000);
  if (days > 0) return `${days} D · ${hours} H`;
  return `${Math.max(1, hours)} H`;
}

export function renderShopView(document, lootState, nowTimestamp = Date.now()) {
  const normalized = ensureShopRotation(lootState, nowTimestamp);
  const body = document.getElementById('shopBody');
  if (!body) return;
  const offers = shopOffers(normalized, nowTimestamp);
  const rotation = normalized.shop.rotation;
  const content = offers.length
    ? `<div class="shop-grid">${offers.map((offer) => {
        const rarity = RARITIES[offer.relic.rarity] || RARITIES.rare;
        const lacksCoins = normalized.economy.coins < offer.coinPrice;
        const lacksBlood = normalized.economy.bossBlood < offer.bloodPrice;
        const buttonText = lacksCoins ? 'FALTA ORO' : lacksBlood ? 'FALTA SANGRE' : 'COMPRAR';
        return `<article class="shop-relic ${rarityClass(offer.relic.rarity)}">
          ${relicArt(offer.definition)}
          <div class="shop-relic-copy">
            <h4 title="${escapeHtml(offer.definition.name)}">${escapeHtml(offer.definition.name)}</h4>
            <span class="rarity-label">${rarity.label} · RANGO ${offer.relic.rank}</span>
            <small>${offer.source === 'fusion-consumed' ? 'CONSUMIDA EN FUSIÓN · +25% ORO' : escapeHtml(BOSSES[offer.bossIndex] || `Jefe ${offer.bossIndex + 1}`)}</small>
          </div>
          <div class="shop-price">
            ${resourceValue('coin', offer.coinPrice)}
            ${resourceValue('boss-blood', offer.bloodPrice)}
          </div>
          <button type="button" data-buy-relic="${offer.relicId}"${lacksCoins || lacksBlood ? ' disabled' : ''}>${buttonText}</button>
        </article>`;
      }).join('')}</div>`
    : `<div class="shop-empty">
        <div class="shop-empty-art" aria-hidden="true">?</div>
        <h4>No hay reliquias disponibles</h4>
        <p>Las reliquias que no consigas al derrotar a un jefe podrán aparecer aquí. La tienda cambia cada 3 días y podrás recuperarlas usando Oro y Sangre de Jefe.</p>
      </div>`;
  body.innerHTML = `
    <section class="inventory-resources">
      ${resourceValue('coin', normalized.economy.coins, 'MONEDAS')}
      ${resourceValue('boss-blood', normalized.economy.bossBlood, 'SANGRE DE JEFE')}
    </section>
    <div class="shop-heading"><span>RELIQUIAS PERDIDAS</span><small>CAMBIA EN ${shopTimeLabel(rotation?.endsAt || nowTimestamp, nowTimestamp)}</small></div>
    ${content}`;
}

export function renderLootNotice(document, lootState, notice) {
  const normalized = normalizeLootState(lootState);
  const rewards = notice.relicIds.map((relicId) => {
    const definition = relicDefinition(relicId);
    const relic = normalized.inventory.relics[relicId];
    if (!definition || !relic) return '';
    const affixText = relic.affixes.length
      ? relic.affixes.map((id) => AFFIX_DEFINITIONS[id]?.name).filter(Boolean).join(' · ')
      : 'Sin efectos extras';
    return `<div class="loot-reward-item ${rarityClass(relic.rarity)}">
      ${relicArt(definition)}
      <div><b>${escapeHtml(definition.name)}</b><span class="rarity-label">${RARITIES[relic.rarity].label}</span><small>${escapeHtml(affixText)}</small></div>
    </div>`;
  }).join('');
  const failedRewards = (notice.failedRelicIds || []).map((relicId) => {
    const definition = relicDefinition(relicId);
    const outcome = definition
      ? normalized.loot.bossRelicOutcomes[definition.rewardId]
      : null;
    if (!definition || !outcome) return '';
    return `<div class="loot-reward-item missed ${rarityClass(outcome.relic?.rarity)}">
      ${relicArt(definition)}
      <div><b>${escapeHtml(definition.name)}</b><span class="loot-missed-label">NO CONSEGUIDA</span><small>Ahora puede aparecer en la Tienda.</small></div>
    </div>`;
  }).join('');
  const retroactive = notice.source === 'retroactive';
  const bloodBonusMarkup = notice.bonusBossBlood > 0
    ? `<div class="loot-blood-bonus">¡GOLPE DE SUERTE! · SANGRE DOBLE (+${notice.bonusBossBlood})</div>`
    : '';
  const earlyVictoryMarkup = notice.earlyVictoryBonusCoins > 0
    ? `<div class="loot-early-victory-bonus"><b>BONUS VICTORIA ANTICIPADA</b><span>${resourceIcon('coin')} +${notice.earlyVictoryBonusCoins} monedas</span>${notice.earlyVictoryBonusBossBlood > 0 ? `<span>${resourceIcon('boss-blood')} +${notice.earlyVictoryBonusBossBlood} Sangre de Jefe</span>` : ''}</div>`
    : '';
  document.getElementById('lootNoticeTitle').textContent =
    retroactive ? 'NUEVAS RECOMPENSAS' : 'BOTÍN CONSEGUIDO';
  document.getElementById('lootNoticeIntro').textContent = retroactive
    ? 'Tus victorias ahora tienen recompensa. Los jefes que ya habías derrotado han dejado nuevas reliquias y recursos.'
    : notice.relicIds.length
      ? 'El jefe ha dejado una reliquia exclusiva y recursos para la Forja.'
      : 'Has conseguido los recursos del jefe. Su reliquia podrá recuperarse en la Tienda.';
  document.getElementById('lootNoticeRewards').innerHTML =
    (retroactive ? '' : '<div class="loot-chest" aria-hidden="true"><img src="relics/boss_loot_chest.png" alt=""></div>') + rewards + failedRewards + bloodBonusMarkup + earlyVictoryMarkup;
  document.getElementById('lootNoticeSummary').innerHTML = `
    <span class="loot-summary-value"><b>${notice.relicIds.length}</b><small>RELIQUIA${notice.relicIds.length === 1 ? '' : 'S'}</small></span>
    <span class="loot-summary-value loot-summary-resource"><span class="loot-summary-number">${resourceIcon('coin')}<b>${notice.coins}</b></span><small>MONEDAS</small></span>
    <span class="loot-summary-value loot-summary-resource"><span class="loot-summary-number">${resourceIcon('boss-blood')}<b>${notice.bossBlood}</b></span><small>SANGRE DE JEFE</small></span>`;
  const actions = document.getElementById('lootNoticeActions');
  actions.innerHTML = retroactive
    ? '<button type="button" data-loot-inventory>IR AL INVENTARIO</button>'
    : notice.relicIds[0]
      ? `<button type="button" data-loot-equip="${notice.relicIds[0]}">EQUIPAR</button><button type="button" data-loot-continue>CONTINUAR</button>`
      : '<button type="button" data-loot-shop>IR A LA TIENDA</button><button type="button" data-loot-continue>CONTINUAR</button>';
}

export function forgeResultMarkup(result, relicName, relicId) {
  const definition = relicDefinition(relicId);
  const artMarkup = definition ? `<div class="forge-result-art">${relicArt(definition)}</div>` : '';
  if (result.success) {
    const previousRank = Math.max(1, result.preview.targetRank - 1);
    const previousValue = relicEffectValue(relicId, relicRankEffect(relicId, previousRank));
    const newValue = relicEffectValue(relicId, relicRankEffect(relicId, result.preview.targetRank));
    const bloodCopy = result.spentBossBlood === 1
      ? 'Se ha consumido 1 Sangre de Jefe.'
      : `Se han consumido ${result.spentBossBlood} Sangres de Jefe.`;
    return `<div class="forge-result success"><span>FORJA COMPLETADA</span>${artMarkup}<h3>${escapeHtml(relicName)} ha alcanzado el Rango ${result.preview.targetRank}</h3><div class="forge-result-upgrade"><b>${previousValue}</b><i aria-hidden="true">→</i><strong>${newValue}</strong></div><p>Su efecto principal se ha fortalecido.</p><p>${bloodCopy}</p></div>`;
  }
  return `<div class="forge-result failure"><span>FORJA FALLIDA</span>${artMarkup}<h3>El poder de la reliquia se resiste.</h3><p>Has perdido ${result.spentCoins} monedas.</p><p>La Sangre de Jefe no se ha consumido.</p><b>Próxima probabilidad: ${result.nextProbability}%</b></div>`;
}

export function fusionResultMarkup(result) {
  const definition = fusionDefinition(result.historyEntry?.recipeId);
  if (!definition) return '';
  const rarity = RARITIES[result.fusedRelic?.rarity] || RARITIES.rare;
  const affixCount = result.fusedRelic?.affixes?.length || 0;
  return `<div class="forge-result success fusion-result"><span>${result.newlyDiscovered ? 'NUEVA RELIQUIA DESCUBIERTA' : 'FUSIÓN COMPLETADA'}</span><div class="forge-result-art">${relicArt(definition)}</div><h3>${escapeHtml(definition.name)}</h3><b class="fusion-result-rarity-label ${rarityClass(result.fusedRelic?.rarity)}">${rarity.label} · RANGO ${result.fusedRelic?.rank || 1} · ${affixCount} EFECTO${affixCount === 1 ? '' : 'S'} EXTRA${affixCount === 1 ? '' : 'S'}</b><p>Las dos reliquias base han sido consumidas.</p><div class="forge-cost"><span>COSTE</span>${resourceValue('coin', result.spentCoins)}${resourceValue('boss-blood', result.spentBossBlood)}</div></div>`;
}
