import { sceneMediaMarkup } from './scene-media.js';
import { BLESSINGS, blessingPrice } from '../domain/blessing-rules.js';
import { resourceValue } from './resource-icons.js';

export function blessingArt(id,alt='') {
  return `<span class="blessing-art"><img src="blessings/${id}.png" alt="${alt}">${['one','two','three','four','five'].map(spark=>`<i class="blessing-spark blessing-spark--${spark}" aria-hidden="true"></i>`).join('')}</span>`;
}

export function templeShopMarkup(game={},economy={},level=1) {
  return `<div class="shop-destination-nav"><span class="shop-destination-nav-spacer" aria-hidden="true"></span><h2>Bendiciones de Azariel</h2><button type="button" class="shop-destination-close" data-temple-back aria-label="Volver al templo">✕</button></div>
    <p class="shop-destination-copy">Protección para tu próximo desafío.</p>
    <section class="outfit-weave-resources" aria-label="Oro disponible">${resourceValue('coin',Math.max(0,Math.trunc(Number(economy.coins)||0)),'ORO')}</section>
    <div class="blessing-grid">${Object.entries(BLESSINGS).map(([id,definition])=>`<button type="button" class="blessing-card" data-open-blessing="${id}" ${game.blessings?.[id]?.active?'disabled':''} aria-label="${game.blessings?.[id]?.active?'Activa:':'Ver'} ${definition.name}">
      ${blessingArt(id)}<b>${definition.name}</b>
      <span>${game.blessings?.[id]?.active?'Activa':id==='experience'&&level<5?'Desde nivel 5':`${blessingPrice(id,level)} oro`}</span>
    </button>`).join('')}</div><p>No caducan. Solo se consumen cuando evitan su penalización.</p>`;
}

export function renderBlessingDetail(document,game,economy,level,id) {
  const definition=BLESSINGS[id];
  if(!definition) return false;
  const price=blessingPrice(id,level);
  const active=game.blessings?.[id]?.active;
  const protectedLevel=id==='experience'&&level<5;
  const blocked=active||protectedLevel||(economy.coins||0)<price;
  document.getElementById('relicDetailTitle').textContent='Bendición';
  document.getElementById('relicDetailBody').innerHTML=`<div class="shop-potion-detail blessing-detail">
    <div class="relic-detail-frame"><div class="relic-detail-art">${blessingArt(id,definition.name)}</div><div class="rarity-label">BENDICIÓN CELESTIAL</div><h3>${definition.name}</h3><div class="relic-rank">${active?'PROTECCIÓN ACTIVA':`PRECIO · ${price} ORO`}</div></div>
    <div class="relic-effect potion-detail-effect"><span>PROTECCIÓN</span><p>${definition.description}</p><p>Se activa al comprarla, no caduca y solo puedes tener una de este tipo. Al consumirse, puedes comprarla de nuevo.</p>${protectedLevel?'<p>Los niveles 1–4 ya están protegidos frente a la pérdida de experiencia.</p>':''}</div>
    <div class="relic-equip-actions"><button type="button" data-buy-blessing="${id}" ${blocked?'disabled':''}>${active?'YA ESTÁ ACTIVA':protectedLevel?'DESDE NIVEL 5':blocked?'FALTA ORO':`COMPRAR · ${price} ORO`}</button></div></div>`;
  return true;
}

export function templeMarkup(game={},economy={},level=1) {
  return `<section class="temple-scene" aria-label="Templo de Azariel">
    ${sceneMediaMarkup('temple', 'Santuario celestial con Azariel, el ángel guardián')}
    <button type="button" class="shop-city-close" data-close-temple aria-label="Cerrar templo">✕</button>
    <button type="button" class="temple-guardian" data-temple-blessings aria-label="Ver las bendiciones de Azariel"><span>Azariel<small>Ángel guardián</small></span></button>
    <button type="button" class="temple-dialogue" data-temple-dialogue><strong>Azariel</strong><span class="temple-dialogue-copy" aria-hidden="true"><span data-dialogue-reserve></span><span data-dialogue-text></span></span><small data-dialogue-hint aria-hidden="true"></small></button>
  </section>
  <section class="temple-blessings" id="templeBlessings" hidden tabindex="-1" aria-label="Bendiciones de Azariel">
    ${templeShopMarkup(game,economy,level)}
  </section>`;
}
