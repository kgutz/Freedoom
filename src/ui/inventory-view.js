import {
  AFFIX_DEFINITIONS,
  ALL_RELIC_DEFINITIONS,
  CHARGE_MECHANICS,
  DEFUSION_BLOOD_COST,
  DEFUSION_COIN_COST,
  FUSION_RELIC_DEFINITIONS,
  RARITIES,
  RELIC_DEFINITIONS,
  fusionDefinition,
  relicDefinition,
  relicCombatBonuses,
  relicRankEffect,
} from '../data/loot-data.js';
import {
  forgePreview,
  getDefusionPreview,
  getForgeFusionPreview,
  fusionRecipeStatus,
  ensureShopRotation,
  equipRelic,
  normalizeLootState,
  shopOffers,
} from '../domain/loot-rules.js';
import { BOSSES } from '../data/game-data.js';
import {
  POTION_BAG_SLOT_LIMIT,
  POTION_DEFINITIONS,
  POTION_FUTURE_SLOTS,
  POTION_DAILY_LIMITS,
} from '../data/potion-data.js';
import {
  OUTFIT_DEFINITIONS,
  equippedOutfit,
  heroFaceSource,
  heroSpriteSource,
  isOutfitUnlocked,
} from '../data/outfit-data.js';
import {
  FRAME_DEFINITIONS,
  equippedFrame,
  heroBackgroundSource,
  isFrameUnlocked,
} from '../data/frame-data.js';
import { normalizePotionState, potionBloodChance } from '../domain/potion-rules.js';
import { resourceIcon, resourceValue } from './resource-icons.js';

export { resourceIcon, resourceValue } from './resource-icons.js';

function outfitClassId(lootState) {
  const classId = lootState?.game?.cls;
  return ['knight', 'paladin', 'sorcerer', 'druid'].includes(classId) ? classId : 'paladin';
}

function outfitPortrait(classId, outfit, extraClass = '') {
  return `<span class="outfit-portrait outfit-portrait--${classId} outfit-portrait--outfit-${outfit.id}${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true">
    <img src="${heroFaceSource(classId, outfit.id)}" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${heroSpriteSource(classId, 'happy', outfit.id)}'">
  </span>`;
}

function outfitFullBody(classId, outfit) {
  return `<span class="outfit-full-body outfit-full-body--${classId} outfit-full-body--outfit-${outfit.id}" aria-hidden="true">
    <img src="${heroSpriteSource(classId, 'happy', outfit.id)}" alt="" loading="lazy" decoding="async">
  </span>`;
}

function framePreview(classId, frame, extraClass = '') {
  return `<span class="frame-preview${extraClass ? ` ${extraClass}` : ''}" aria-hidden="true">
    <img class="frame-preview-bg" src="${heroBackgroundSource(frame.id, classId, 'hero', { frames: { owned: { [frame.id]: true } } })}" alt="" loading="lazy" decoding="async">
  </span>`;
}

function outfitCardMarkup(lootState) {
  const classId = outfitClassId(lootState);
  const equipped = equippedOutfit(lootState?.game?.outfit, lootState?.game);
  return `<section class="inventory-outfit-section">
    <span class="inventory-outfit-label">OUTFITS</span>
    <button type="button" class="inventory-outfit-card" data-open-outfits aria-label="Cambiar outfit. Actual: ${escapeHtml(equipped.name)}">
      ${outfitPortrait(classId, equipped)}
      <span class="inventory-outfit-copy"><b>${escapeHtml(equipped.name)}</b></span>
      <i class="inventory-outfit-chevron" aria-hidden="true">›</i>
    </button>
  </section>`;
}

export function renderOutfitSelector(document, lootState, selectedOutfitId = null, options = {}) {
  const body = document.getElementById('outfitSelectorBody');
  if (!body) return 'original';
  const shopContext = options.context === 'shop';
  const section = shopContext
    ? (options.section === 'frames' ? 'frames' : 'weave')
    : (options.section === 'frames' ? 'frames' : 'owned');
  const classId = outfitClassId(lootState);
  const equipped = equippedOutfit(lootState?.game?.outfit, lootState?.game);
  const equippedFrameDefinition = equippedFrame(lootState?.game?.frame, lootState?.game);
  const ownedOutfits = OUTFIT_DEFINITIONS.filter((outfit) => isOutfitUnlocked(outfit, lootState?.game));
  const craftableOutfits = OUTFIT_DEFINITIONS.filter((outfit) => outfit.released !== false && outfit.craftable && outfit.recipe);
  const ownedFrames = FRAME_DEFINITIONS.filter((frame) => isFrameUnlocked(frame, lootState?.game));
  const visibleFrames = shopContext
    ? FRAME_DEFINITIONS.filter((frame) => frame.released !== false)
    : ownedFrames;
  const requested = section === 'frames'
    ? visibleFrames.find((frame) => frame.id === selectedOutfitId)
    : OUTFIT_DEFINITIONS.find((outfit) => (
      outfit.id === selectedOutfitId && outfit.released !== false
      && (section === 'weave' ? outfit.craftable : isOutfitUnlocked(outfit, lootState?.game))
    ));
  const selected = requested || null;
  const recipe = section === 'weave' ? selected?.recipe : null;
  const alreadyOwned = section === 'weave' && selected ? isOutfitUnlocked(selected, lootState?.game) : false;
  const hasResources = recipe && Number(lootState?.economy?.coins || 0) >= recipe.coins
    && Number(lootState?.economy?.arcaneFibers || 0) >= recipe.arcaneFibers;
  const frameRecipe = section === 'frames' ? selected?.recipe : null;
  const frameOwned = selected ? isFrameUnlocked(selected, lootState?.game) : false;
  const hasFrameResources = frameRecipe && Number(lootState?.economy?.coins || 0) >= frameRecipe.coins
    && Number(lootState?.economy?.arcaneInks || 0) >= frameRecipe.arcaneInks;
  const selectorModal = body.closest?.('.outfit-selector-modal');
  selectorModal?.classList.toggle('outfit-selector-modal--compact', !selected);
  selectorModal?.classList.toggle('outfit-selector-modal--shop', shopContext);
  const selectorTitle = document.getElementById('outfitSelectorTitle');
  const selectorBack = document.getElementById('outfitSelectorBack');
  const selectorReturnCharacter = document.getElementById('outfitSelectorReturnCharacter');
  if (selectorTitle) selectorTitle.textContent = shopContext
    ? (section === 'frames' ? 'Pintor de Mundos' : 'Telar Arcano')
    : 'Cosméticos';
  if (selectorBack) selectorBack.hidden = !shopContext || !selected;
  if (selectorReturnCharacter) selectorReturnCharacter.hidden = !shopContext;
  const emptyCollectionSlots = Math.max(0, 3 - ownedOutfits.length);
  const emptyFrameSlots = Math.max(0, 4 - ownedFrames.length);
  const sectionIntro = shopContext
    ? `<div class="shop-outfit-heading"><p>${section === 'frames'
      ? 'Paisajes encantados transforman el lugar desde el que tu héroe emprende su viaje.'
      : 'Hilos arcanos y oficio antiguo convierten tus recursos en nuevos atuendos.'}</p></div>`
    : '';
  body.innerHTML = `
    ${shopContext ? '' : `<div class="outfit-modal-tabs" role="tablist" aria-label="Colecciones cosméticas">
      <button type="button" role="tab" data-outfit-section="owned" aria-selected="${section === 'owned'}" class="${section === 'owned' ? 'active' : ''}">Outfits</button>
      <button type="button" role="tab" data-outfit-section="frames" aria-selected="${section === 'frames'}" class="${section === 'frames' ? 'active' : ''}">Fondos</button>
    </div>`}
    <div class="outfit-selector-scroll-content">
    ${sectionIntro}
    ${section === 'weave' ? `<div class="outfit-weave-resources" aria-label="Tus recursos">
      ${resourceValue('coin', lootState?.economy?.coins || 0, 'ORO')}
      ${resourceValue('arcane-fiber', lootState?.economy?.arcaneFibers || 0, 'FIBRAS')}
    </div>` : shopContext && section === 'frames' ? `<div class="outfit-weave-resources" aria-label="Tus recursos">
      ${resourceValue('coin', lootState?.economy?.coins || 0, 'ORO')}
      ${resourceValue('arcane-ink', lootState?.economy?.arcaneInks || 0, 'TINTAS')}
    </div>` : ''}
    ${section === 'frames' ? (selected ? `
      <div class="outfit-owned-view frame-owned-view">
        <div class="outfit-owned-preview frame-owned-preview">
          <div class="frame-option selected${selected.id === equippedFrameDefinition.id ? ' equipped' : ''}" aria-label="${escapeHtml(selected.name)}${selected.id === equippedFrameDefinition.id ? ', equipado' : ''}">
            ${framePreview(classId, selected, 'frame-preview--large')}
          </div>
        </div>
        <section class="outfit-weave-detail outfit-owned-detail">
          <h4>${escapeHtml(selected.name)}</h4>
          <p>${escapeHtml(selected.lore)}</p>
          <small class="outfit-cosmetic-note">COSMÉTICO · NO MODIFICA ESTADÍSTICAS</small>
          ${shopContext && frameRecipe ? `<div class="outfit-weave-cost">
            ${resourceValue('coin', frameRecipe.coins, 'ORO')}
            ${resourceValue('arcane-ink', frameRecipe.arcaneInks, 'TINTAS ARCANAS')}
          </div>` : ''}
          ${shopContext
            ? (frameRecipe
              ? `<button type="button" class="outfit-equip-button" data-paint-frame="${selected.id}"${frameOwned || !hasFrameResources ? ' disabled' : ''}>${frameOwned ? 'CONSEGUIDO' : hasFrameResources ? 'PINTAR' : 'FALTAN RECURSOS'}</button>`
              : `<button type="button" class="outfit-equip-button" disabled>NO DISPONIBLE</button>`)
            : `<button type="button" class="outfit-equip-button" data-equip-frame="${selected.id}"${selected.id === equippedFrameDefinition.id ? ' disabled' : ''}>${selected.id === equippedFrameDefinition.id ? 'EQUIPADO' : 'EQUIPAR'}</button>`}
        </section>
      </div>` : `
      <div class="frame-selector-grid" role="listbox" aria-label="${shopContext ? 'Fondos disponibles' : 'Colección de fondos'}">
        ${visibleFrames.map((frame) => {
          const unlocked = isFrameUnlocked(frame, lootState?.game);
          const equippedClass = frame.id === equippedFrameDefinition.id ? ' equipped' : '';
          const ownedClass = shopContext && unlocked ? ' frame-option--owned' : '';
          const lockedClass = !shopContext && !unlocked ? ' frame-option--locked' : '';
          const status = frame.id === equippedFrameDefinition.id
            ? ', equipado'
            : shopContext && unlocked ? ', conseguido' : '';
          return `<button type="button" class="frame-option${equippedClass}${ownedClass}${lockedClass}" data-select-frame="${frame.id}" role="option" aria-label="${escapeHtml(frame.name)}${status}">
            ${framePreview(classId, frame)}
          </button>`;
        }).join('')}
        ${shopContext
          ? ''
          : Array.from({ length: emptyFrameSlots }, (_, index) => `<div class="frame-option frame-option--locked" aria-label="Espacio de fondo bloqueado ${index + 1}"><span class="outfit-locked-mark" aria-hidden="true">?</span></div>`).join('')}
      </div>`) : section === 'owned' ? (selected ? `
      <div class="outfit-owned-view">
        <div class="outfit-owned-preview">
          <div class="outfit-option selected${selected.id === equipped.id ? ' equipped' : ''}${selected.provisional ? ' outfit-option--arcane' : ''}" aria-label="${escapeHtml(selected.name)}${selected.id === equipped.id ? ', equipado' : ''}">
            ${outfitFullBody(classId, selected)}
          </div>
        </div>
        <section class="outfit-weave-detail outfit-owned-detail">
          <h4>${escapeHtml(selected.name)}</h4>
          <p>${escapeHtml(selected.lore || 'Un atuendo que transforma la apariencia de tus cuatro héroes.')}</p>
          <small class="outfit-cosmetic-note">COSMÉTICO · NO MODIFICA ESTADÍSTICAS</small>
          <button type="button" class="outfit-equip-button" data-equip-outfit="${selected.id}"${selected.id === equipped.id ? ' disabled' : ''}>${selected.id === equipped.id ? 'EQUIPADO' : 'EQUIPAR'}</button>
        </section>
      </div>` : `
      <div class="outfit-selector-grid" role="listbox" aria-label="Colección de outfits">
        ${ownedOutfits.map((outfit) => `<button type="button" class="outfit-option${outfit.id === equipped.id ? ' equipped' : ''}${outfit.provisional ? ' outfit-option--arcane' : ''}" data-select-outfit="${outfit.id}" role="option" aria-label="${escapeHtml(outfit.name)}${outfit.id === equipped.id ? ', equipado' : ''}">
          ${outfitFullBody(classId, outfit)}
        </button>`).join('')}
        ${Array.from({ length: emptyCollectionSlots }, (_, index) => `<div class="outfit-option outfit-option--locked outfit-collection-empty" aria-label="Espacio de outfit bloqueado ${index + 1}">
          <span class="outfit-locked-mark" aria-hidden="true">?</span>
        </div>`).join('')}
      </div>`) : (selected ? `
      <div class="outfit-owned-view outfit-weave-view">
        <div class="outfit-owned-preview">
          <div class="outfit-option outfit-weave-option selected${alreadyOwned ? ' owned' : ''}" aria-label="${escapeHtml(selected.name)}">
            ${outfitFullBody(classId, selected)}
          </div>
        </div>
        <section class="outfit-weave-detail">
          <h4>${escapeHtml(selected.name)}</h4>
          <p>${escapeHtml(selected.lore || 'Un atuendo que transforma la apariencia de tus cuatro héroes.')}</p>
          <small class="outfit-cosmetic-note">COSMÉTICO · NO MODIFICA ESTADÍSTICAS</small>
          <div class="outfit-weave-cost">
            ${resourceValue('coin', recipe.coins, 'ORO')}
            ${resourceValue('arcane-fiber', recipe.arcaneFibers, 'FIBRAS ARCANAS')}
          </div>
          <button type="button" class="outfit-equip-button" data-weave-outfit="${selected.id}"${alreadyOwned || !hasResources ? ' disabled' : ''}>${alreadyOwned ? 'CONSEGUIDO' : 'TEJER'}</button>
        </section>
      </div>` : `
      <div class="outfit-weave-grid" role="listbox" aria-label="Outfits para tejer">
        ${craftableOutfits.map((outfit) => `<button type="button" class="outfit-option outfit-weave-option${isOutfitUnlocked(outfit, lootState?.game) ? ' owned' : ''}" data-select-weave-outfit="${outfit.id}" role="option" aria-label="${escapeHtml(outfit.name)}">
          ${outfitFullBody(classId, outfit)}
        </button>`).join('')}
        ${Array.from({ length: 4 }, (_, index) => `<div class="outfit-option outfit-weave-option outfit-weave-future" aria-label="Próximo outfit ${index + 1}">
          <span aria-hidden="true">?</span>
        </div>`).join('')}
      </div>`)}</div>`;
  return selected?.id || null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function relicArt(definition, overlay = '') {
  if (definition.ingredientIds?.length === 2 && !definition.image) {
    const ingredients = definition.ingredientIds.map((id) => relicDefinition(id));
    return `<div class="relic-art relic-art--fusion relic-art--${definition.id}">
      ${ingredients.map((ingredient, index) => `<img class="fusion-art-part fusion-art-part--${index + 1}" src="${ingredient.image}" alt="" aria-hidden="true" loading="lazy" decoding="async">`).join('')}
      <span class="fusion-art-sigil" aria-hidden="true">✦</span>
      ${overlay}
    </div>`;
  }
  const fusionClass = definition.ingredientIds?.length === 2 ? ' relic-art--fusion' : '';
  return `<div class="relic-art${fusionClass} relic-art--${definition.id}">
    <img src="${definition.image}" alt="${escapeHtml(definition.name)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="relic-art-fallback" style="display:none">${Number.isInteger(definition.bossIndex) ? definition.bossIndex + 1 : '✦'}</span>
    ${overlay}
  </div>`;
}

function potionArt(definition) {
  return `<span class="potion-art potion-art--${definition.tone}" aria-hidden="true">
    <img src="potions/potion_${definition.id}.webp" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
    <i style="display:none">${definition.symbol}</i>
  </span>`;
}

function potionFutureSlots() {
  return Array.from({ length: POTION_FUTURE_SLOTS }, (_, index) =>
    `<div class="potion-card potion-card--future" aria-label="Próxima poción ${index + 1}"><span>?</span></div>`).join('');
}

function potionGridMarkup(normalized, { mode = 'inventory', dayKey = '', bossKey = '', nowTimestamp = Date.now(), huntEnergy = 0, huntEnergyCapacity = 20 } = {}) {
  const potions = normalizePotionState(normalized.inventory.potions);
  const active = potions.active?.endsAt > nowTimestamp ? potions.active : null;
  const dailyUses = potions.dailyUses[dayKey] || {};
  const definitions=mode==='shop'
    ? [...POTION_DEFINITIONS].sort((a,b)=>{
      const shopOrder=['life','mana','fortune','experience','blood','energy'];
      return shopOrder.indexOf(a.id)-shopOrder.indexOf(b.id);
    })
    : POTION_DEFINITIONS.filter((definition)=>(potions.owned[definition.id]||0)>0);
  if(mode!=='shop'&&!definitions.length) return '';
  return `<div class="potion-grid">${definitions.map((definition) => {
    const owned = potions.owned[definition.id] || 0;
    if (mode === 'shop') {
      const lacksCoins = normalized.economy.coins < definition.price;
      return `<button type="button" class="potion-card potion-card--shop potion-tone--${definition.tone}${lacksCoins ? ' is-disabled' : ''}" data-open-shop-potion="${definition.id}" aria-label="Ver ${escapeHtml(definition.name)} · ${definition.price} de oro">
        ${potionArt(definition)}
      </button>`;
    }
    const used = Math.max(0, Number(dailyUses[definition.id]) || 0);
    const dailyLimit = POTION_DAILY_LIMITS[definition.id];
    const bloodUsed = definition.id === 'blood' ? Math.max(0, potions.bloodPrepared[bossKey] || 0) : 0;
    const temporalBlocked = ['fortune', 'experience'].includes(definition.id) && Boolean(active);
    const exhausted = definition.id === 'blood' ? bloodUsed >= 3 : dailyLimit && used >= dailyLimit;
    const energyBlocked=definition.id==='energy'&&huntEnergy>huntEnergyCapacity-(definition.energyRestore||0);
    const disabled = owned < 1 || temporalBlocked || exhausted || energyBlocked;
    const status = definition.id === 'blood'
      ? `${bloodUsed}/3 · +${potionBloodChance(potions, bossKey)}%`
      : dailyLimit ? `${used}/${dailyLimit}` : '';
    const activeCopy = active?.id === definition.id
      ? `ACTIVA · ${Math.max(1, Math.ceil((active.endsAt - nowTimestamp) / 60000))} MIN`
      : status;
    return `<article class="potion-card potion-card--inventory potion-tone--${definition.tone}${disabled ? ' is-disabled' : ''}">
      ${potionArt(definition)}
      <b>${escapeHtml(definition.name.replace('Poción de ', ''))}</b>
      <small>${escapeHtml(definition.shortEffect)}</small>
      <span class="potion-owned">x${owned}</span>
      <span class="potion-use-status">${activeCopy}</span>
      <button type="button" data-use-potion="${definition.id}"${disabled ? ' aria-disabled="true"' : ''}>${active?.id===definition.id?'ACTIVA':'USAR'}</button>
    </article>`;
  }).join('')}${mode==='shop'?potionFutureSlots():''}</div>`;
}

function inventoryPotionItemsMarkup(normalized, { dayKey = '', bossKey = '', nowTimestamp = Date.now() } = {}) {
  const potions=normalizePotionState(normalized.inventory.potions);
  const active=potions.active?.endsAt>nowTimestamp?potions.active:null;
  const dailyUses=potions.dailyUses[dayKey]||{};
  const ownedItems = POTION_DEFINITIONS.filter((definition)=>(potions.owned[definition.id]||0)>0).map((definition)=>{
    const owned=potions.owned[definition.id]||0;
    const used=Math.max(0,Number(dailyUses[definition.id])||0);
    const bloodUsed=definition.id==='blood'?Math.max(0,potions.bloodPrepared[bossKey]||0):0;
    const exhausted=definition.id==='blood'?bloodUsed>=3:used>=(POTION_DAILY_LIMITS[definition.id]||Infinity);
    const temporalBlocked=['fortune','experience'].includes(definition.id)&&Boolean(active);
    const disabled=exhausted||temporalBlocked;
    return `<button type="button" class="relic-collection-item potion-inventory-item potion-tone--${definition.tone}${disabled?' is-disabled':''}" data-relic-kind="potion" data-open-potion="${definition.id}" aria-label="Abrir ${escapeHtml(definition.name)} · ${owned} disponible${owned===1?'':'s'}" title="${escapeHtml(definition.name)}">${potionArt(definition)}<span class="potion-inventory-quantity">x${owned}</span></button>`;
  });
  const emptySlots = Array.from({ length: Math.max(0, POTION_BAG_SLOT_LIMIT - ownedItems.length) }, (_, index) =>
    `<button type="button" class="relic-collection-item potion-inventory-item bag-potion-empty" data-open-potion-shop aria-label="Comprar una poción para el hueco vacío ${index + 1}"><span aria-hidden="true">+</span></button>`);
  return [...ownedItems, ...emptySlots].join('');
}

export function renderPotionDetail(document, lootState, potionId, options = {}) {
  const normalized=normalizeLootState(lootState);
  const definition=POTION_DEFINITIONS.find((item)=>item.id===potionId);
  const body=document.getElementById('relicDetailBody');
  if(!body||!definition) return false;
  const title=document.getElementById('relicDetailTitle');
  if(title) title.textContent='Poción';
  const potions=normalizePotionState(normalized.inventory.potions);
  const owned=potions.owned[potionId]||0;
  const dayUses=potions.dailyUses[options.dayKey]||{};
  const used=potionId==='blood'?potions.bloodPrepared[options.bossKey]||0:dayUses[potionId]||0;
  const limit=potionId==='blood'?3:POTION_DAILY_LIMITS[potionId]||null;
  const active=potions.active?.endsAt>(options.nowTimestamp||Date.now());
  const energyBlocked=potionId==='energy'&&(options.huntEnergy||0)>(options.huntEnergyCapacity||20)-(definition.energyRestore||0);
  const blocked=owned<1||(limit!==null&&used>=limit)||(['fortune','experience'].includes(potionId)&&active)||energyBlocked;
  const shopMode=options.mode==='shop';
  const lacksCoins=normalized.economy.coins<definition.price;
  const occupiedSlots=Object.values(potions.owned).filter((quantity)=>Math.max(0,Number(quantity)||0)>0).length;
  const bagFull=shopMode&&owned<1&&occupiedSlots>=POTION_BAG_SLOT_LIMIT;
  const action=shopMode
    ? `<div class="potion-buy-quantity" aria-label="Cantidad a comprar"><button type="button" data-potion-quantity-step="-1" aria-label="Reducir cantidad">−</button><output data-potion-quantity>1</output><button type="button" data-potion-quantity-step="1" aria-label="Aumentar cantidad">+</button></div><button type="button" data-buy-potion="${potionId}" data-unit-price="${definition.price}"${lacksCoins||bagFull?' aria-disabled="true"':''}>${bagFull?'BOLSO LLENO':lacksCoins?'FALTA ORO':`COMPRAR · ${definition.price}`}</button>`
    : `<button type="button" data-use-potion="${potionId}"${blocked?' aria-disabled="true"':''}>${blocked?'NO DISPONIBLE':'USAR'}</button>`;
  const usageCopy=limit===null?'Usos diarios: SIN LÍMITE':`Usos: ${used}/${limit}${potionId==='blood'?` · Bonus preparado: +${potionBloodChance(potions,options.bossKey)}%`:''}`;
  body.innerHTML=`<div class="relic-detail-frame potion-detail-frame potion-tone--${definition.tone}"><div class="relic-detail-art">${potionArt(definition)}</div><div class="rarity-label">CONSUMIBLE</div><h3>${escapeHtml(definition.name)}</h3><div class="relic-rank">${shopMode?`PRECIO · ${definition.price} ORO`:`DISPONIBLES · ${owned}`}</div></div><div class="relic-effect potion-detail-effect"><span>EFECTO</span><p>${escapeHtml(definition.shortEffect)}</p><p>${escapeHtml(definition.detail)}</p>${shopMode?'':`<p>${usageCopy}</p>`}</div><div class="relic-equip-actions">${action}</div>`;
  return true;
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
  return Math.max(0, Math.floor((available - Math.min(reference, available)) / 2) - 10);
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
  if (leftId === relicId) return { leftId: rightId, rightId: null, errorId: null };
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
  if (relicId === 'relic_02') return `${value}% MANÁ MÁX.`;
  if (relicId === 'relic_05') return `${value}% MANÁ/DÍA`;
  const definition = relicDefinition(relicId);
  if (definition?.valueUnit) return `${value} ${definition.valueUnit}`;
  return `${value} XP`;
}

function fusionEffectDescription(definition, relic) {
  const value = (baseId) => Math.max(0, Number(relic.inheritedEffects?.[baseId]) || 0);
  if (definition.id === 'fusion_01') {
    return `Reduce ${value('relic_01')} HP de la primera fuente de daño del día. El primer hábito recupera ${value('relic_02') + 3}% del Maná máximo.`;
  }
  if (definition.id === 'fusion_02') {
    return `Reduce ${value('relic_01')} HP de la primera fuente de daño del día. La Constancia concede ${value('relic_04')} XP y alcanzar seis días cumplidos otorga 20 XP adicionales.`;
  }
  if (definition.id === 'fusion_04') {
    return `El primer hábito concede ${value('relic_03')} XP. Recupera ${value('relic_05')}% del Maná máximo al día, repartido cada 30 min. Completar todos los hábitos diarios otorga 5 XP adicionales.`;
  }
  if (definition.id === 'fusion_06') {
    const synergy = definition.synergy?.values?.[relic.rank] || 5;
    return `Reduce ${value('relic_01')} HP del primer daño. La recuperación concede ${value('relic_07')} XP y, si el escudo absorbe daño, suma ${synergy} XP al completar el día.`;
  }
  if (definition.id === 'fusion_07') {
    const synergy = definition.synergy?.values?.[relic.rank] || 5;
    return `El primer hábito recupera ${value('relic_02')}% del Maná máximo. La recuperación concede ${value('relic_07')} XP y, si recuperas Maná, suma ${synergy} XP al completar el día.`;
  }
  if (definition.id === 'fusion_08') {
    const synergy = definition.synergy?.values?.[relic.rank] || 10;
    return `Recupera ${value('relic_05')}% del Maná máximo al día, repartido cada 30 min. La recuperación concede ${value('relic_07')} XP y, si recuperas Maná, suma ${synergy} XP al completar el día.`;
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
  const fusion = Boolean(definition.recipeId);
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
  return `<button type="button" class="relic-card ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}${fusion ? ' fusion-relic' : ''}${chargeIndicator ? ' has-charge' : ''}" data-relic-kind="${fusion ? 'fusion' : 'normal'}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}"${isActiveSlot ? ` data-equipped-slot="${slot}" data-double-tap-unequip="${definition.id}"` : ''}>
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
  return `<button type="button" class="relic-collection-item ${rarityClass(relic.rarity)}${equipped ? ' equipped' : ''}${fusion ? ' fusion-relic' : ''}${relic.currentlyOwned === false ? ' not-owned' : ''}" data-relic-kind="${fusion ? 'fusion' : 'normal'}" data-open-relic="${definition.id}" aria-label="${escapeHtml(accessibleName)}" title="${escapeHtml(accessibleName)}">
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

export function renderInventoryView(document, lootState, options = {}) {
  const normalized = normalizeLootState(lootState);
  const potions = normalizePotionState(normalized.inventory.potions);
  const ownedPotionCount = Object.values(potions.owned)
    .reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0);
  const potionItems = inventoryPotionItemsMarkup(normalized, options);
  const body = document.getElementById('inventoryBody');
  if (!body) return;
  body.innerHTML = `
    <section class="inventory-resources bag-resources" aria-label="Recursos del bolso">
      ${resourceValue('coin', normalized.economy.coins, 'ORO')}
      ${resourceValue('boss-blood', normalized.economy.bossBlood, 'SANGRE DE JEFE')}
      ${resourceValue('arcane-fiber', normalized.economy.arcaneFibers, 'FIBRAS ARCANAS')}
      ${resourceValue('arcane-ink', normalized.economy.arcaneInks, 'TINTAS ARCANAS')}
    </section>
    <section class="inventory-section bag-potions-section">
      <div class="inventory-section-head"><span>POCIONES</span><small>${ownedPotionCount}</small></div>
      <p class="collection-hint">Toca una poción para consultar su efecto y usarla.</p>
      <div class="relic-grid bag-potion-grid">${potionItems}</div>
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
    <section class="inventory-section collection-section bag-collection-section">
      <div class="inventory-section-head"><span>COLECCIÓN</span><small>${Object.keys(normalized.inventory.collection).length}/?</small></div>
      <p class="collection-hint">Aquí permanecen todas las reliquias que has descubierto, incluso si ya no están en tu Inventario.</p>
      <div class="relic-kind-filters" role="group" aria-label="Filtrar colección">
        <button type="button" class="active" data-relic-filter="all" aria-pressed="true">TODAS</button>
        <button type="button" data-relic-filter="normal" aria-pressed="false">NORMALES</button>
        <button type="button" data-relic-filter="fusion" aria-pressed="false">FUSIONADAS</button>
      </div>
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
  const title = document.getElementById('relicDetailTitle');
  if (title) title.textContent = 'Reliquia';
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
  const combatBonuses = relicCombatBonuses(relicId, relic.rank, relic.ingredientSnapshots);
  const combatStatLabels = { physicalAttack: 'ATAQUE', magicAttack: 'PODER', defense: 'DEFENSA' };
  const combatMarkup = combatBonuses.length
    ? `<div class="relic-combat-bonus"><span>ESTADÍSTICAS DE CACERÍA</span><div class="relic-combat-values">${combatBonuses.map((bonus) => `<b>${combatStatLabels[bonus.stat]} +${bonus.value}</b>`).join('')}</div></div>`
    : '';
  const effect = fusion ? 0 : relicRankEffect(relicId, relic.rank);
  const effectDescription = `${escapeHtml(definition.effectLabel)} <b>Valor actual: ${relicEffectValue(relicId, effect)}</b>`;
  const constancy = relicId === 'relic_04' || relic.inheritedEffects?.relic_04
    ? `<div class="relic-constancy" aria-label="Carga de Constancia"><span>CONSTANCIA</span><b>Carga actual: ${Math.min(6, Math.max(0, Number(normalized.inventory.constancy?.charge) || 0))}/6</b></div>`
    : '';
  body.innerHTML = `<div class="relic-detail-frame ${rarityClass(relic.rarity)}">
      <div class="relic-detail-art">${relicArt(definition)}</div>
      <div class="rarity-label">${rarity.label}</div>
      <h3>${escapeHtml(definition.name)}</h3>
      <div class="relic-rank">RANGO ${relic.rank}${fusion ? ' · RELIQUIA FUSIONADA' : ''}</div>
    </div>
    ${combatMarkup}
    ${constancy}
    <div class="relic-effect"><span>EFECTO PRINCIPAL</span><p>${fusion ? escapeHtml(fusionEffectDescription(definition, relic)) : effectDescription}</p></div>
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
  const mode = ['fusion', 'defusion'].includes(options.mode) ? options.mode : 'upgrade';
  const ownedDefinitions = RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id]);
  const selectedDefinition = selectedRelicId
    ? ownedDefinitions.find((definition) => definition.id === selectedRelicId) || null
    : null;
  const body = document.getElementById('forgeBody');
  if (!body) return null;
  const cityHeading = options.cityEntry
    ? shopDestinationHeading('Forja del Crisol', 'Mejora, fusiona o separa reliquias entre fuego, metal y Sangre de Jefe.')
    : '';
  if (mode === 'fusion') {
    renderFusionView(document, normalized, options.fusionLeftId, options.fusionRightId, {
      errorId: options.fusionErrorId,
    });
    if (cityHeading) body.innerHTML = `${cityHeading}${body.innerHTML}`;
    return selectedRelicId;
  }
  if (mode === 'defusion') {
    const rendered = renderDefusionView(document, normalized, selectedRelicId);
    if (cityHeading) body.innerHTML = `${cityHeading}${body.innerHTML}`;
    return rendered;
  }
  if (!ownedDefinitions.length) {
    body.innerHTML = `${cityHeading}${forgeModeTabs('upgrade')}<div class="forge-empty">
      <div class="forge-empty-slot forge-animated-slot forge-animated-slot--upgrade">?</div>
      <h3>LA FORJA ESPERA</h3>
      <p>Derrota a un jefe para conseguir tu primera reliquia.</p>
    </div>`;
    return null;
  }
  if (!selectedDefinition) {
    body.innerHTML = `${cityHeading}${forgeModeTabs('upgrade')}
      <div class="forge-toolbar"><div class="forge-toolbar-title"><strong>MEJORAR</strong><details class="forge-info forge-toolbar-info">
        <summary aria-label="Cómo funciona Mejorar"><span aria-hidden="true">ⓘ</span></summary>
        <div class="forge-info-popover"><p>El oro se gasta en cada intento. La Sangre de Jefe solo se consume si la mejora tiene éxito.</p></div>
      </details></div><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div>
      <section class="forge-focus forge-focus--empty">
        <button type="button" class="forge-focus-art forge-focus-picker fusion-slot forge-animated-slot forge-animated-slot--upgrade" data-open-forge-picker="upgrade" aria-label="Elegir reliquia para mejorar"></button>
        <div class="forge-panel">
          <div class="forge-cost" aria-label="Coste pendiente de seleccionar una reliquia">
            <span>COSTE</span>
            <span class="resource-value">${resourceIcon('coin')}<b>?</b></span>
            <span class="resource-value">${resourceIcon('boss-blood')}<b>?</b></span>
          </div>
          <button type="button" class="forge-attempt" disabled>FORJAR</button>
        </div>
      </section>`;
    return null;
  }
  const relicId = selectedDefinition.id;
  const relic = normalized.inventory.relics[relicId];
  const rarity = RARITIES[relic.rarity] || RARITIES.rare;
  const preview = forgePreview(normalized, relicId);
  const upgradeInfoMarkup = `<details class="forge-info forge-toolbar-info">
    <summary aria-label="Cómo funciona Mejorar"><span aria-hidden="true">ⓘ</span></summary>
    <div class="forge-info-popover">${preview.ok ? `<div><span>Probabilidad <b>${preview.finalProbability}%</b></span><span>Pity <b>${preview.pityProbability}%</b></span><span>Fortuna <b>+${preview.fortune}%</b></span></div>` : ''}
    <p>El oro se gasta en cada intento. La Sangre de Jefe solo se consume si la mejora tiene éxito.</p></div>
  </details>`;
  const forgeControls = preview.ok
    ? `${forgeUpgradeMarkup(relicId, relic.rank, preview.targetRank)}
      <div class="forge-cost" aria-label="Coste de la mejora">
        <span>COSTE</span>
        ${resourceValue('coin', preview.cost)}
        ${resourceValue('boss-blood', preview.bloodRequired)}
      </div>
      <button type="button" class="forge-attempt" data-forge-relic="${relicId}"${preview.coinsAvailable < preview.cost || preview.bloodAvailable < preview.bloodRequired ? ' disabled' : ''}>FORJAR</button>`
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
    ${cityHeading}${forgeModeTabs('upgrade')}
    <div class="forge-toolbar"><div class="forge-toolbar-title"><strong>MEJORAR</strong>${upgradeInfoMarkup}</div><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div>
    <section class="forge-focus ${rarityClass(relic.rarity)}">
      <button type="button" class="forge-focus-art forge-focus-picker forge-animated-slot forge-animated-slot--upgrade" data-open-forge-picker="upgrade" aria-label="Cambiar ${escapeHtml(selectedDefinition.name)}">${relicArt(selectedDefinition)}</button>
      <h3>${escapeHtml(selectedDefinition.name)}</h3>
      <div class="forge-rank-line"><span>${forgeRankStars(relic.rank)}</span><b>${rarity.label} · RANGO ${relic.rank}</b></div>
      <p class="forge-current-effect">${escapeHtml(selectedDefinition.effectLabel)} <strong>${relicEffectValue(relicId, relicRankEffect(relicId, relic.rank))}</strong></p>
      <div class="forge-panel">${forgeControls}</div>
    </section>`;
  return relicId;
}

function forgeModeTabs(active) {
  return `<div class="forge-mode-tabs" role="tablist" aria-label="Modo de Forja">
    <button type="button" data-forge-mode="upgrade" class="${active === 'upgrade' ? 'active' : ''}" aria-selected="${active === 'upgrade'}">Mejorar</button>
    <button type="button" data-forge-mode="fusion" class="${active === 'fusion' ? 'active' : ''}" aria-selected="${active === 'fusion'}">Fusionar</button>
    <button type="button" data-forge-mode="defusion" class="${active === 'defusion' ? 'active' : ''}" aria-selected="${active === 'defusion'}">Desfusionar</button>
  </div>`;
}

export function renderDefusionView(document, lootState, selectedRelicId = null) {
  const normalized = normalizeLootState(lootState);
  const body = document.getElementById('forgeBody');
  if (!body) return null;
  const fusedDefinitions = FUSION_RELIC_DEFINITIONS
    .filter((definition) => normalized.inventory.relics[definition.id]);
  const selectedDefinition = fusedDefinitions.find((definition) => definition.id === selectedRelicId) || null;
  let content = `<div class="forge-empty"><div class="forge-focus-art fusion-slot forge-animated-slot forge-animated-slot--defusion" aria-hidden="true"></div><h3>NO HAY FUSIONES</h3><p>Las reliquias fusionadas que poseas aparecerán aquí.</p></div>`;
  if (fusedDefinitions.length && !selectedDefinition) {
    content = `<div class="forge-toolbar"><div class="forge-toolbar-title"><strong>DESFUSIONAR</strong><details class="forge-info forge-toolbar-info"><summary aria-label="Cómo funciona Desfusionar"><span aria-hidden="true">ⓘ</span></summary><div class="forge-info-popover"><p>Recuperas las dos reliquias originales con el rango, rareza y efectos que tenían antes de fusionarlas.</p><p>La reliquia fusionada se consume. El proceso cuesta oro y Sangre de Jefe.</p></div></details></div><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div><section class="forge-focus defusion-focus forge-focus--empty"><button type="button" class="forge-focus-art forge-focus-picker fusion-slot forge-animated-slot forge-animated-slot--defusion" data-open-forge-picker="defusion" aria-label="Elegir reliquia para desfusionar"></button><h3>ELIGE UNA RELIQUIA</h3><p class="fusion-status">Solo se mostrarán tus reliquias fusionadas.</p><div class="forge-panel"><div class="forge-cost"><span>COSTE</span>${resourceValue('coin', DEFUSION_COIN_COST)}${resourceValue('boss-blood', DEFUSION_BLOOD_COST)}</div><button type="button" class="forge-attempt defusion-attempt" disabled>DESFUSIONAR</button></div></section>`;
  } else if (selectedDefinition) {
    const relic = normalized.inventory.relics[selectedDefinition.id];
    const preview = getDefusionPreview(normalized, selectedDefinition.id);
    const ingredients = preview.ingredientIds.map((ingredientId) => {
      const definition = relicDefinition(ingredientId);
      const snapshot = relic.ingredientSnapshots?.[ingredientId];
      return `<div class="defusion-ingredient">${relicArt(definition)}<b>${escapeHtml(definition?.name || ingredientId)}</b><small>RANGO ${snapshot?.rank || 1}</small></div>`;
    }).join('');
    const reason = preview.reason === 'coins'
      ? 'No tienes suficiente oro.'
      : preview.reason === 'blood'
        ? 'No tienes suficiente Sangre de Jefe.'
        : preview.reason === 'ingredient-owned'
          ? 'Ya posees una de las reliquias originales.'
          : preview.reason === 'missing-snapshots'
            ? 'Esta fusión antigua no conserva los datos necesarios.'
            : 'Recuperarás exactamente las dos reliquias originales.';
    content = `<div class="forge-toolbar"><div class="forge-toolbar-title"><strong>DESFUSIONAR</strong><details class="forge-info forge-toolbar-info"><summary aria-label="Cómo funciona Desfusionar"><span aria-hidden="true">ⓘ</span></summary><div class="forge-info-popover"><p>Recuperas las dos reliquias originales con el rango, rareza y efectos que tenían antes de fusionarlas.</p></div></details></div><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div><section class="forge-focus defusion-focus ${rarityClass(relic.rarity)}"><button type="button" class="forge-focus-art forge-focus-picker forge-animated-slot forge-animated-slot--defusion" data-open-forge-picker="defusion" aria-label="Cambiar ${escapeHtml(selectedDefinition.name)}">${relicArt(selectedDefinition)}</button><h3>${escapeHtml(selectedDefinition.name)}</h3><div class="defusion-arrow" aria-hidden="true">↓</div><div class="defusion-ingredients">${ingredients}</div><p class="fusion-status ${preview.ok ? '' : 'error'}">${escapeHtml(reason)}</p><div class="forge-panel"><div class="forge-cost"><span>COSTE</span>${resourceValue('coin', preview.coinCost)}${resourceValue('boss-blood', preview.bloodCost)}</div><button type="button" class="forge-attempt defusion-attempt" data-defuse-relic="${selectedDefinition.id}"${preview.ok ? '' : ' disabled'}>DESFUSIONAR</button></div></section>`;
  }
  body.innerHTML = `${forgeModeTabs('defusion')}${content}`;
  return selectedDefinition?.id || null;
}

function fusionSlotMarkup(definition, label) {
  const slot = label === 'SLOT A' ? 'left' : 'right';
  return definition
    ? `<button type="button" class="fusion-slot filled forge-animated-slot forge-animated-slot--fusion" data-open-filled-fusion-slot="${slot}" aria-label="Cambiar ${escapeHtml(definition.name)} de la Fusión. Doble toque para quitarla">${relicArt(definition)}<small>${escapeHtml(definition.name)}</small></button>`
    : `<button type="button" class="fusion-slot forge-animated-slot forge-animated-slot--fusion" data-open-forge-picker="fusion" data-fusion-slot="${slot}" aria-label="Elegir reliquia para ${label}"></button>`;
}

export function renderForgeRelicPicker(document, lootState, {
  mode = 'upgrade', slot = 'left', leftId = null, rightId = null, currentId = null,
} = {}) {
  const normalized = normalizeLootState(lootState);
  const title = document.getElementById('forgeRelicPickerTitle');
  const body = document.getElementById('forgeRelicPickerBody');
  const unequipButton = document.getElementById('forgeRelicPickerUnequip');
  if (!title || !body) return;
  title.textContent = mode === 'fusion'
    ? `Elegir reliquia · Slot ${slot === 'right' ? 'B' : 'A'}`
    : mode === 'equip'
      ? `Slot ${Number(slot) + 1}`
      : mode === 'defusion'
        ? 'Elegir reliquia fusionada'
        : 'Elegir reliquia para mejorar';
  const otherSlotId = mode === 'fusion' ? (slot === 'right' ? leftId : rightId) : null;
  const currentSlotId = mode === 'fusion'
    ? (slot === 'right' ? rightId : leftId)
    : mode === 'defusion'
      ? currentId
      : null;
  const equippedSlotId = mode === 'equip' ? normalized.inventory.equipped[Number(slot)] : null;
  if (unequipButton) {
    unequipButton.hidden = !equippedSlotId;
    if (equippedSlotId) unequipButton.setAttribute('data-picker-unequip', equippedSlotId);
    else unequipButton.removeAttribute('data-picker-unequip');
  }
  const pickerDefinitions = mode === 'defusion' ? FUSION_RELIC_DEFINITIONS : ALL_RELIC_DEFINITIONS;
  const cards = pickerDefinitions.filter((definition) => normalized.inventory.relics[definition.id]).map((definition) => {
    const relic = normalized.inventory.relics[definition.id];
    const fusion = Boolean(definition.recipeId);
    const selected = definition.id === currentSlotId;
    const incompatible = Boolean(otherSlotId && (definition.id === otherSlotId || fusionRecipeStatus(otherSlotId, definition.id).status !== 'available'));
    const equipped = mode === 'equip' && normalized.inventory.equipped.includes(definition.id);
    const equipPreview = mode === 'equip' && !equipped
      ? equipRelic(normalized, definition.id, Number(slot))
      : null;
    const equipIncompatible = mode === 'equip' && !equipped && equipPreview?.ok === false;
    const unavailable = mode === 'equip'
      ? equipped || equipIncompatible
      : mode === 'defusion'
        ? selected
        : fusion || incompatible || selected;
    const unavailableCopy = selected
      ? 'SELECCIONADA'
      : equipped
      ? 'EQUIPADA'
      : equipIncompatible
        ? 'INCOMPATIBLE'
        : fusion
          ? 'FUSIONADA'
          : incompatible
            ? 'INCOMPATIBLE'
            : '';
    return `<button type="button" class="forge-picker-relic ${rarityClass(relic.rarity)}${selected ? ' selected' : ''}${incompatible ? ' incompatible' : ''}" data-picker-kind="${fusion ? 'fusion' : 'normal'}" data-pick-forge-relic="${definition.id}"${unavailable ? ' disabled aria-disabled="true"' : ''}>${relicArt(definition)}<b>${escapeHtml(definition.name)}</b><small>RANGO ${relic.rank}${unavailableCopy ? ` · ${unavailableCopy}` : ''}</small></button>`;
  }).join('');
  const filters = mode === 'defusion'
    ? ''
    : '<div class="relic-kind-filters forge-picker-filters" role="group" aria-label="Filtrar reliquias"><button type="button" class="active" data-picker-filter="all">TODAS</button><button type="button" data-picker-filter="normal">NORMALES</button><button type="button" data-picker-filter="fusion">FUSIONADAS</button></div>';
  body.innerHTML = `${filters}<div class="forge-picker-grid">${cards || '<p>No tienes reliquias fusionadas disponibles.</p>'}</div>`;
  const pickerModal = body.closest?.('.forge-relic-picker-modal');
  pickerModal?.classList.toggle('forge-relic-picker-modal--defusion', mode === 'defusion');
  pickerModal?.parentElement?.classList.toggle('forge-relic-picker-bg--defusion', mode === 'defusion');
  pickerModal?.classList.toggle(
    'forge-relic-picker-modal--compact',
    pickerDefinitions.filter((definition) => normalized.inventory.relics[definition.id]).length <= 6,
  );
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
            ? 'No tienes suficiente oro.'
            : preview.reason === 'blood'
              ? 'No tienes suficiente Sangre de Jefe.'
              : preview.definition ? `Resultado listo · ${preview.successProbability}% de éxito.` : 'Elige dos reliquias base.';
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
    <div class="forge-toolbar"><div class="forge-toolbar-title"><strong>FUSIONAR</strong><details class="forge-info forge-toolbar-info"><summary aria-label="Cómo funciona Fusionar"><span aria-hidden="true">ⓘ</span></summary><div class="forge-info-popover"><p>Cada intento consume oro. Si falla, conservas las dos reliquias y la Sangre de Jefe; la probabilidad aumenta hasta garantizar el tercer intento.</p><p>Al tener éxito se consumen las dos reliquias base y la Sangre de Jefe. La rareza y el rango más altos están garantizados.</p><p>Cada efecto conserva la potencia exacta que tenía en su reliquia de origen. Los efectos diferentes se conservan sin duplicarse.</p></div></details></div><span>${resourceValue('coin', normalized.economy.coins)} ${resourceValue('boss-blood', normalized.economy.bossBlood)}</span></div>
    <section class="fusion-flow${left && right ? ' has-pair' : ''}" aria-label="Receta de Fusión">
      <div class="fusion-ingredients">${fusionSlotMarkup(left, 'SLOT A')}<b>+</b>${fusionSlotMarkup(right, 'SLOT B')}</div>
      ${resultMarkup ? `<b class="fusion-result-arrow" aria-hidden="true">↓</b>${resultMarkup}` : ''}
    </section>
    ${selectionFeedback}
    <div class="forge-cost fusion-cost"><span>COSTE</span>${resourceValue('coin', preview.coinCost)}${resourceValue('boss-blood', preview.bloodCost)}${preview.successProbability ? `<b>${preview.successProbability}% ÉXITO</b>` : ''}</div>
    <button type="button" class="forge-attempt fusion-attempt" data-fuse-relics="${escapeHtml(leftId || '')}|${escapeHtml(rightId || '')}"${preview.ok ? '' : ' disabled'}>FUSIONAR</button>`;
  return { preview, leftId, rightId };
}

function shopTimeLabel(endsAt, nowTimestamp) {
  const remaining = Math.max(0, endsAt - nowTimestamp);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.ceil((remaining % 86400000) / 3600000);
  if (days > 0) return `${days} D · ${hours} H`;
  return `${Math.max(1, hours)} H`;
}

function shopCityMapMarkup() {
  return `<section class="shop-city" aria-label="El Callejón de los Oficios">
    <div class="shop-city-heading">
      <span>DISTRITO COMERCIAL</span>
      <h2>El Callejón de los Oficios</h2>
      <p>Elige un comercio para preparar a tu héroe.</p>
    </div>
    <div class="shop-city-map">
      <img src="shop/callejon-oficios.webp" alt="Callejón medieval con cinco comercios" loading="eager" decoding="async">
      <button type="button" class="shop-city-close" data-close-shop-map aria-label="Cerrar mapa de tiendas">✕</button>
      <button type="button" class="shop-city-zone shop-city-zone--forge" data-shop-destination="forge" aria-label="Entrar en Forja del Crisol"><span>Forja del Crisol</span></button>
      <button type="button" class="shop-city-zone shop-city-zone--potions" data-shop-destination="potions" aria-label="Entrar en Botica de Pociones"><span>Botica de Pociones</span></button>
      <button type="button" class="shop-city-zone shop-city-zone--weave" data-shop-destination="weave" aria-label="Entrar en Telar Arcano"><span>Telar Arcano</span></button>
      <button type="button" class="shop-city-zone shop-city-zone--frames" data-shop-destination="frames" aria-label="Entrar en Pintor de Mundos"><span>Pintor de Mundos</span></button>
      <button type="button" class="shop-city-zone shop-city-zone--relics" data-shop-destination="relics" aria-label="Entrar en Contrabandista de Reliquias"><span>Contrabandista de Reliquias</span></button>
    </div>
  </section>`;
}

function shopDestinationHeading(name, description) {
  return `<div class="shop-destination-nav">
      <span class="shop-destination-nav-spacer" aria-hidden="true"></span>
      <h2>${escapeHtml(name)}</h2>
      <button type="button" class="shop-destination-close" data-close-shop-destination aria-label="Cerrar ${escapeHtml(name)}">✕</button>
    </div>
    <p class="shop-destination-copy">${escapeHtml(description)}</p>`;
}

export function renderShopView(document, lootState, nowTimestamp = Date.now(), options = {}) {
  const normalized = ensureShopRotation(lootState, nowTimestamp);
  const body = document.getElementById('shopBody');
  if (!body) return;
  const section = ['map', 'relics', 'potions'].includes(options.section) ? options.section : 'market';
  if (section === 'map') {
    body.innerHTML = shopCityMapMarkup();
    return;
  }
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
          <button type="button" class="shop-relic-buy" data-buy-relic="${offer.relicId}" aria-label="Comprar ${escapeHtml(offer.definition.name)}"${lacksCoins || lacksBlood ? ' disabled' : ''}>${buttonText}</button>
        </article>`;
      }).join('')}</div>`
    : `<div class="shop-empty">
        <div class="shop-empty-art" aria-hidden="true">?</div>
        <h4>No hay reliquias disponibles</h4>
        <p>Las reliquias que no consigas al derrotar a un jefe podrán aparecer aquí. La tienda cambia cada 3 días y podrás recuperarlas usando Oro y Sangre de Jefe.</p>
      </div>`;
  const shopResourceValues = section === 'potions'
    ? resourceValue('coin', normalized.economy.coins, 'ORO')
    : section === 'relics'
      ? `${resourceValue('coin', normalized.economy.coins, 'ORO')}
        ${resourceValue('boss-blood', normalized.economy.bossBlood, 'SANGRE DE JEFE')}`
      : `${resourceValue('coin', normalized.economy.coins, 'ORO')}
        ${resourceValue('boss-blood', normalized.economy.bossBlood, 'SANGRE DE JEFE')}
        ${resourceValue('arcane-fiber', normalized.economy.arcaneFibers, 'FIBRAS')}
        ${resourceValue('arcane-ink', normalized.economy.arcaneInks, 'TINTAS')}`;
  const resources = `<section class="inventory-resources" aria-label="Recursos de esta tienda">
      ${shopResourceValues}
    </section>`;
  const relicShop = `<div class="shop-heading"><span>RELIQUIAS PERDIDAS</span><small>CAMBIA EN ${shopTimeLabel(rotation?.endsAt || nowTimestamp, nowTimestamp)}</small></div>
    ${content}`;
  const potionShop = `<div class="shop-heading shop-potion-heading"><span>POCIONES</span><small>SIEMPRE DISPONIBLES</small></div>
    ${potionGridMarkup(normalized, { ...options, mode: 'shop', nowTimestamp })}`;
  if (section === 'relics') {
    body.innerHTML = `${shopDestinationHeading('Contrabandista de Reliquias', 'Reliquias perdidas vuelven a circular por vías… poco oficiales.')}${resources}${relicShop}`;
    return;
  }
  if (section === 'potions') {
    body.innerHTML = `${shopDestinationHeading('Botica de Pociones', 'Brebajes para recuperar fuerzas y torcer la suerte a tu favor.')}${resources}${potionShop}`;
    return;
  }
  body.innerHTML = `
    ${resources}
    ${relicShop}
    ${potionShop}`;
}

export function renderLootNotice(document, lootState, notice) {
  const normalized = normalizeLootState(lootState);
  const rewards = notice.relicIds.map((relicId) => {
    const definition = relicDefinition(relicId);
    const relic = normalized.inventory.relics[relicId];
    if (!definition || !relic) return '';
    return `<button type="button" class="loot-reward-slot loot-relic-slot relic-collection-item ${rarityClass(relic.rarity)}" data-loot-open-relic="${escapeHtml(relicId)}" aria-label="Ver ${escapeHtml(definition.name)}">
      ${relicArt(definition)}
    </button>`;
  }).join('');
  const failedRewards = (notice.failedRelicIds || []).map((relicId) => {
    const definition = relicDefinition(relicId);
    const outcome = definition
      ? normalized.loot.bossRelicOutcomes[definition.rewardId]
      : null;
    if (!definition || !outcome) return '';
    return `<button type="button" class="loot-reward-slot loot-relic-slot relic-collection-item missed ${rarityClass(outcome.relic?.rarity)}" data-loot-open-relic="${escapeHtml(relicId)}" aria-label="Ver ${escapeHtml(definition.name)}, no conseguida">
      ${relicArt(definition)}
      <span class="loot-missed-mark">NO</span>
    </button>`;
  }).join('');
  const relicSlotCount = notice.relicIds.length + (notice.failedRelicIds || []).length;
  const resourceSlotCount = (notice.arcaneFibers > 0 ? 1 : 0) + (notice.arcaneInks > 0 ? 1 : 0);
  const emptyRewards = Array.from({ length: Math.max(0, 2 - relicSlotCount - resourceSlotCount) }, () =>
    '<span class="loot-reward-slot loot-reward-empty" aria-hidden="true"></span>').join('');
  const resourceRewards = `
    <div class="loot-reward-slot loot-resource-slot" aria-label="${notice.bossBlood} de Sangre de Jefe">
      ${resourceIcon('boss-blood')}<b>${notice.bossBlood}</b>
    </div>
    <div class="loot-reward-slot loot-resource-slot" aria-label="${notice.coins} de oro">
      ${resourceIcon('coin')}<b>${notice.coins}</b>
    </div>
    ${notice.arcaneFibers > 0 ? `<div class="loot-reward-slot loot-resource-slot loot-resource-slot--arcane" aria-label="${notice.arcaneFibers} Fibras Arcanas">
      ${resourceIcon('arcane-fiber')}<b>${notice.arcaneFibers}</b>
    </div>` : ''}
    ${notice.arcaneInks > 0 ? `<div class="loot-reward-slot loot-resource-slot loot-resource-slot--arcane" aria-label="${notice.arcaneInks} Tintas Arcanas">
      ${resourceIcon('arcane-ink')}<b>${notice.arcaneInks}</b>
    </div>` : ''}`;
  const retroactive = notice.source === 'retroactive';
  const bloodBonusMarkup = notice.bonusBossBlood > 0
    ? `<div class="loot-blood-bonus">¡GOLPE DE SUERTE! · SANGRE DOBLE (+${notice.bonusBossBlood})</div>`
    : '';
  const earlyVictoryMarkup = notice.earlyVictoryBonusCoins > 0
    ? `<div class="loot-early-victory-bonus"><b>BONUS VICTORIA ANTICIPADA</b><span>${resourceIcon('coin')} +${notice.earlyVictoryBonusCoins} oro</span>${notice.earlyVictoryBonusBossBlood > 0 ? `<span>${resourceIcon('boss-blood')} +${notice.earlyVictoryBonusBossBlood} Sangre de Jefe</span>` : ''}</div>`
    : '';
  document.getElementById('lootNoticeTitle').textContent =
    retroactive ? 'NUEVAS RECOMPENSAS' : 'BOTÍN CONSEGUIDO';
  document.getElementById('lootNoticeIntro').textContent = retroactive
    ? 'Tus victorias ahora tienen recompensa. Los jefes que ya habías derrotado han dejado nuevas reliquias y recursos.'
    : notice.relicIds.length
      ? 'El jefe ha dejado una reliquia exclusiva y recursos para la Forja.'
      : 'Has conseguido los recursos del jefe. Su reliquia podrá recuperarse en la Tienda.';
  document.getElementById('lootNoticeRewards').innerHTML =
    (retroactive ? '' : '<div class="loot-chest" aria-hidden="true"><img src="relics/boss_loot_chest_open_sapphire.webp" alt=""></div>') +
    `<div class="loot-reward-grid">${rewards}${failedRewards}${resourceRewards}${emptyRewards}</div>` +
    bloodBonusMarkup + earlyVictoryMarkup;
  const summary = document.getElementById('lootNoticeSummary');
  summary.innerHTML = '';
  summary.hidden = true;
  const actions = document.getElementById('lootNoticeActions');
  actions.innerHTML = retroactive
    ? '<button type="button" data-loot-inventory>IR AL INVENTARIO</button>'
    : notice.relicIds[0]
      ? '<button type="button" data-loot-continue>CONFIRMAR</button>'
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
  const refundCopy = result.coinsRefunded > 0
    ? `<p>La Malla de Escamas de Brea recupera ${result.coinsRefunded} de oro.</p>`
    : '';
  const netCoinsLost = Math.max(0, result.spentCoins - (result.coinsRefunded || 0));
  return `<div class="forge-result failure"><span>FORJA FALLIDA</span>${artMarkup}<h3>El poder de la reliquia se resiste.</h3><p>Has perdido ${netCoinsLost} de oro.</p>${refundCopy}<p>La Sangre de Jefe no se ha consumido.</p><b>Próxima probabilidad: ${result.nextProbability}%</b></div>`;
}

export function fusionResultMarkup(result) {
  const definition = fusionDefinition(result.historyEntry?.recipeId || result.preview?.definition?.recipeId);
  if (!definition) return '';
  if (!result.success) {
    return `<div class="forge-result failure fusion-result"><span>FUSIÓN FALLIDA</span><div class="forge-result-art">${relicArt(definition)}</div><h3>Las reliquias rechazan la unión.</h3><p>Has perdido ${result.spentCoins} de oro.</p><p>Las dos reliquias y la Sangre de Jefe se conservan.</p><b>Próxima probabilidad: ${result.nextProbability}%</b></div>`;
  }
  const rarity = RARITIES[result.fusedRelic?.rarity] || RARITIES.rare;
  const affixCount = result.fusedRelic?.affixes?.length || 0;
  return `<div class="forge-result success fusion-result"><span>${result.newlyDiscovered ? 'NUEVA RELIQUIA DESCUBIERTA' : 'FUSIÓN COMPLETADA'}</span><div class="forge-result-art">${relicArt(definition)}</div><h3>${escapeHtml(definition.name)}</h3><b class="fusion-result-rarity-label ${rarityClass(result.fusedRelic?.rarity)}">${rarity.label} · RANGO ${result.fusedRelic?.rank || 1} · ${affixCount} EFECTO${affixCount === 1 ? '' : 'S'} EXTRA${affixCount === 1 ? '' : 'S'}</b><p>Las dos reliquias base han sido consumidas.</p><div class="forge-cost"><span>COSTE</span>${resourceValue('coin', result.spentCoins)}${resourceValue('boss-blood', result.spentBossBlood)}</div></div>`;
}

export function defusionResultMarkup(result) {
  const restored = Object.keys(result.restoredRelics || {}).map((relicId) => {
    const definition = relicDefinition(relicId);
    const relic = result.restoredRelics[relicId];
    return `<div class="defusion-result-relic">${relicArt(definition)}<b>${escapeHtml(definition?.name || relicId)}</b><small>RANGO ${relic.rank}</small></div>`;
  }).join('');
  return `<div class="forge-result success fusion-result"><span>DESFUSIÓN COMPLETADA</span><h3>Las reliquias originales han regresado</h3><div class="defusion-result-grid">${restored}</div><p>Conservan la rareza, el rango y los efectos que tenían antes de fusionarse.</p><div class="forge-cost"><span>COSTE</span>${resourceValue('coin', result.spentCoins)}${resourceValue('boss-blood', result.spentBossBlood)}</div></div>`;
}
