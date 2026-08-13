import {
  AFFIX_DEFINITIONS,
  RARITIES,
  RELIC_DEFINITIONS,
  relicDefinition,
  relicRankEffect,
} from '../data/loot-data.js';
import {
  forgePreview,
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

function relicArt(definition) {
  return `<div class="relic-art relic-art--${definition.id}">
    <img src="${definition.image}" alt="${escapeHtml(definition.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="relic-art-fallback" style="display:none">${definition.bossIndex + 1}</span>
  </div>`;
}

export function rarityClass(rarity) {
  return `rarity-${RARITIES[rarity] ? rarity : 'rare'}`;
}

function relicEffectValue(relicId, value) {
  if (relicId === 'relic_01') return `${value} HP`;
  if (relicId === 'relic_02' || relicId === 'relic_05') return `${value} MANÁ`;
  if (relicId === 'relic_04') return `${value} PUNTOS`;
  return `${value} XP`;
}

function forgeUpgradeMarkup(definition, relicId, currentRank, targetRank) {
  const current = relicEffectValue(relicId, relicRankEffect(relicId, currentRank));
  const target = relicEffectValue(relicId, relicRankEffect(relicId, targetRank));
  return `<div class="forge-upgrade-preview">
    <span>MEJORA DEL EFECTO</span>
    <p>${escapeHtml(definition.effectLabel)}</p>
    <div><b>${current}</b><i aria-hidden="true">→</i><strong>${target}</strong></div>
  </div>`;
}

export function relicCardMarkup({ definition, relic, equipped = false, slot = null }) {
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const isActiveSlot = slot !== null;
  const statusMarkup = isActiveSlot
    ? `<span class="relic-active-meta">${rarity.label} - RANGO ${relic.rank}</span>`
    : `<span class="relic-card-meta rarity-label">${rarity.label} · RANGO ${relic.rank}</span>`;
  const accessibleName = `${definition.name}, ${rarity.label}, rango ${relic.rank}${equipped ? ', Equipada' : ''}`;
  return `<button type="button" class="relic-card ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}"${isActiveSlot ? ` data-equipped-slot="${slot}"` : ''}>
    ${relicArt(definition)}
    <span class="relic-card-copy">
      <b>${escapeHtml(definition.name)}</b>
      ${statusMarkup}
    </span>
  </button>`;
}

function relicCollectionItemMarkup({ definition, relic, equipped = false }) {
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const accessibleName = `${definition.name}, ${rarity.label}, rango ${relic.rank}${equipped ? ', Equipada' : ''}`;
  return `<button type="button" class="relic-collection-item ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}">
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
      ? relicCardMarkup({ definition, relic, equipped: true, slot })
      : `<div class="relic-slot-empty"><span>SLOT ${slot + 1}</span><b>VACÍO</b></div>`;
  }).join('');
  const collection = RELIC_DEFINITIONS
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
      <div class="inventory-section-head"><span>COLECCIÓN</span><small>${Object.keys(normalized.inventory.relics).length}/?</small></div>
      <div class="relic-grid">${collection || '<div class="inventory-empty">Derrota a tu primer jefe para conseguir una reliquia.</div>'}</div>
    </section>`;
}

export function renderRelicDetail(document, lootState, relicId) {
  const normalized = normalizeLootState(lootState);
  const relic = normalized.inventory.relics[relicId];
  const definition = relicDefinition(relicId);
  const body = document.getElementById('relicDetailBody');
  if (!body || !relic || !definition) return false;
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const equipped = normalized.inventory.equipped.includes(relicId);
  const equipmentActions = equipped
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
        return `<li><b class="relic-affix-name">${escapeHtml(affix.name)}</b><p>${escapeHtml(affix.description)}</p></li>`;
      }).join('')
    : '<li class="no-affixes">Esta rareza no posee efectos extras.</li>';
  const effect = relicRankEffect(relicId, relic.rank);
  body.innerHTML = `<div class="relic-detail-frame ${rarityClass(relic.rarity)}">
      <div class="relic-detail-art">${relicArt(definition)}</div>
      <div class="rarity-label">${rarity.label}</div>
      <h3>${escapeHtml(definition.name)}</h3>
      <div class="relic-rank">RANGO ${relic.rank}</div>
    </div>
    <div class="relic-effect"><span>EFECTO PRINCIPAL</span><p>${escapeHtml(definition.effectLabel)} <b>Valor actual: ${effect}${relicId === 'relic_04' ? ' puntos porcentuales' : relicId === 'relic_01' ? ' HP' : relicId === 'relic_02' || relicId === 'relic_05' ? ' Maná' : ' XP'}</b></p></div>
    <div class="relic-affixes"><span>EFECTOS EXTRAS</span><ul>${affixes}</ul></div>
    <div class="relic-equip-actions">
      ${equipmentActions}
      <button type="button" class="relic-forge-shortcut" data-open-forge-relic="${relicId}">FORJAR</button>
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

export function renderForgeView(document, lootState, selectedRelicId = null) {
  const normalized = normalizeLootState(lootState);
  const ownedDefinitions = RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id]);
  const selectedDefinition = ownedDefinitions.find((definition) => definition.id === selectedRelicId)
    || ownedDefinitions[0]
    || null;
  const body = document.getElementById('forgeBody');
  if (!body) return null;
  if (!selectedDefinition) {
    body.innerHTML = `<div class="forge-empty">
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
    ? `${forgeUpgradeMarkup(selectedDefinition, relicId, relic.rank, preview.targetRank)}
      <div class="forge-values">
        <span>Coste ${resourceValue('coin', preview.cost)}</span>
        <span>Monedas disponibles ${resourceValue('coin', preview.coinsAvailable)}</span>
        <span>Sangre necesaria ${resourceValue('boss-blood', preview.bloodRequired)}</span>
        <span>Disponible ${resourceValue('boss-blood', preview.bloodAvailable)}</span>
      </div>
      <div class="forge-chance">
        <span>Pity <b>${preview.pityProbability}%</b></span>
        <span>Fortuna <b>+${preview.fortune}%</b></span>
        <strong>PROBABILIDAD ${preview.finalProbability}%</strong>
      </div>
      <p>La Sangre de Jefe solo se consume si la mejora tiene éxito. Las monedas se gastan en cada intento.</p>
      <button type="button" class="forge-attempt" data-forge-relic="${relicId}"${preview.coinsAvailable < preview.cost || preview.bloodAvailable < preview.bloodRequired ? ' disabled' : ''}>INTENTAR MEJORA</button>`
    : `<div class="forge-upgrade-preview forge-upgrade-max">
        <span>EFECTO ACTUAL</span>
        <p>${escapeHtml(selectedDefinition.effectLabel)}</p>
        <div><strong>${relicEffectValue(relicId, relicRankEffect(relicId, relic.rank))}</strong></div>
      </div><div class="forge-max">RANGO MÁXIMO ALCANZADO</div>`;
  const choices = ownedDefinitions.map((definition) => {
    const choiceRelic = normalized.inventory.relics[definition.id];
    const choiceRarity = RARITIES[choiceRelic.rarity] || RARITIES.rare;
    return `<button type="button" class="forge-relic-choice ${rarityClass(choiceRelic.rarity)}${definition.id === relicId ? ' selected' : ''}" data-select-forge-relic="${definition.id}" aria-label="Forjar ${escapeHtml(definition.name)}">
      ${relicArt(definition)}
      <b>${escapeHtml(definition.name)}</b>
      <span class="rarity-label">${choiceRarity.label}</span>
      <small>RANGO ${choiceRelic.rank}</small>
    </button>`;
  }).join('');
  body.innerHTML = `
    <section class="inventory-section forge-collection">
      <div class="inventory-section-head"><span>ELIGE UNA RELIQUIA</span><small>${ownedDefinitions.length} DISPONIBLES</small></div>
      <div class="forge-relic-grid">${choices}</div>
    </section>
    <section class="forge-focus ${rarityClass(relic.rarity)}">
      <div class="forge-focus-art">${relicArt(selectedDefinition)}</div>
      <div class="rarity-label">${rarity.label}</div>
      <h3>${escapeHtml(selectedDefinition.name)}</h3>
      <div class="forge-title">${preview.ok ? `RANGO ${relic.rank} → ${preview.targetRank}` : `RANGO ${relic.rank}`}</div>
      <div class="forge-panel">${forgeControls}</div>
    </section>`;
  return relicId;
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
            <small>${escapeHtml(BOSSES[offer.bossIndex] || `Jefe ${offer.bossIndex + 1}`)}</small>
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
  document.getElementById('lootNoticeTitle').textContent =
    retroactive ? 'NUEVAS RECOMPENSAS' : 'BOTÍN CONSEGUIDO';
  document.getElementById('lootNoticeIntro').textContent = retroactive
    ? 'Tus victorias ahora tienen recompensa. Los jefes que ya habías derrotado han dejado nuevas reliquias y recursos.'
    : notice.relicIds.length
      ? 'El jefe ha dejado una reliquia exclusiva y recursos para la Forja.'
      : 'Has conseguido los recursos del jefe. Su reliquia podrá recuperarse en la Tienda.';
  document.getElementById('lootNoticeRewards').innerHTML =
    (retroactive ? '' : '<div class="loot-chest" aria-hidden="true"><img src="relics/boss_loot_chest.png" alt=""></div>') + rewards + failedRewards + bloodBonusMarkup;
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
