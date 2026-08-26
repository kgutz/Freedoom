import {
  BRUMA_ENEMIES,
  HUNT_DIFFICULTIES,
  normalizeHuntState,
} from '../domain/pve-combat-rules.js';
import { resourceIcon, resourceValue } from './resource-icons.js';

function remainingLabel(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function monsterCard(enemy) {
  return `<button type="button" class="hunt-monster ${enemy.id}" data-hunt-monster="${enemy.id}" aria-label="Ver historia de ${enemy.name}">
    <div class="hunt-monster-art">
      <img src="hunt/fields-of-mist/${enemy.id}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <span class="hunt-art-fallback" style="display:none">?</span>
    </div>
    <span>${enemy.role}</span><b>${enemy.name}</b>
  </button>`;
}

function huntEnergyDisplay(hunt) {
  const maximum = Math.max(1, Number(hunt.baseEnergy) || 5);
  const bonus = Math.max(0, Number(hunt.bonusEnergyRemaining) || 0);
  const base = Math.max(0, Math.min(maximum, (Number(hunt.energy) || 0) - bonus));
  const bonusMarkup = bonus ? `<em>+${bonus}</em>` : '';
  return {
    aria: `Energía de Cacería: ${base} de ${maximum}${bonus ? `, más ${bonus} extra` : ''}`,
    html: `${base}/${maximum}${bonusMarkup}`,
  };
}

export function renderHuntMonsterDetail({ document, enemyId }) {
  const enemy = BRUMA_ENEMIES.find((candidate) => candidate.id === enemyId);
  const root = document.getElementById('huntMonsterBody');
  if (!enemy || !root) return false;
  root.innerHTML = `<div class="hunt-monster-detail-art ${enemy.id}">
      <img src="hunt/fields-of-mist/${enemy.id}.png" alt="${enemy.name}">
    </div>
    <span class="hunt-monster-detail-role">${enemy.role}</span>
    <h2>${enemy.name}</h2>
    <p>${enemy.lore}</p>`;
  return true;
}

export function huntResultRewardsMarkup(rewards = {}) {
  const items = [
    Number(rewards.xp) > 0
      ? `<div class="hunt-result-reward-slot"><span class="hunt-result-xp-icon" aria-hidden="true">✦</span><b>${Math.max(0, Number(rewards.xp) || 0)}<small> XP</small></b></div>`
      : '',
    Number(rewards.gold) > 0
      ? `<div class="hunt-result-reward-slot">${resourceIcon('coin')}<b>${Math.max(0, Number(rewards.gold) || 0)}</b></div>`
      : '',
    Number(rewards.arcaneFibers) > 0
      ? `<div class="hunt-result-reward-slot">${resourceIcon('arcane-fiber')}<b>${Math.max(0, Number(rewards.arcaneFibers) || 0)}</b></div>`
      : '',
    Number(rewards.bossBlood) > 0
      ? `<div class="hunt-result-reward-slot">${resourceIcon('boss-blood')}<b>${Math.max(0, Number(rewards.bossBlood) || 0)}</b></div>`
      : '',
  ].filter(Boolean);
  if (!items.length) return '<div class="hunt-result-no-loot">Sin botín obtenido</div>';
  return `<div class="hunt-result-reward-grid items-${items.length}">${items.join('')}</div>`;
}

function reportMarkup(report) {
  if (!report) return '';
  const rows = report.encounters.map((encounter) => `<div class="hunt-report-row ${encounter.won ? 'won' : 'lost'}">
    <span>${encounter.role} · ${encounter.name}</span>
    <b>${encounter.won ? 'VICTORIA' : 'DERROTA'}</b>
    <small>${encounter.rounds} rondas · ${encounter.damageDealt} daño · ${encounter.heroHp} HP restante${encounter.won ? ` · ✦ +${encounter.rewards?.xp || 0} XP · ${resourceIcon('coin')} +${encounter.rewards?.gold || 0}${encounter.rewards?.arcaneFibers ? ` · ${resourceIcon('arcane-fiber')} +${encounter.rewards.arcaneFibers}` : ''}${encounter.rewards?.bossBlood ? ` · ${resourceIcon('boss-blood')} +${encounter.rewards.bossBlood}` : ''}` : ''}</small>
  </div>`).join('');
  const rewards = report.rewards;
  const rewardItems = [
    Number(rewards.xp) > 0 ? `<span>✦ <b>${Math.max(0, Number(rewards.xp) || 0)}</b> XP</span>` : '',
    Number(rewards.gold) > 0 ? resourceValue('coin', rewards.gold) : '',
    Number(rewards.arcaneFibers) > 0 ? resourceValue('arcane-fiber', rewards.arcaneFibers) : '',
    Number(rewards.bossBlood) > 0 ? resourceValue('boss-blood', rewards.bossBlood) : '',
  ].filter(Boolean).join('');
  return `<section class="card hunt-report">
    <div class="hunt-section-title"><span>Último informe</span><b>${report.won ? 'EXPEDICIÓN SUPERADA' : 'EXPEDICIÓN FALLIDA'}</b></div>
    <div class="hunt-report-result ${report.won ? 'won' : 'lost'}">${report.won ? 'La bruma retrocede' : 'Tu héroe tuvo que retirarse'}</div>
    <div class="hunt-report-list">${rows}</div>
    <div class="hunt-rewards">${rewardItems || '<span>Sin botín obtenido</span>'}</div>
  </section>`;
}

function regionMapMarkup(hunt) {
  const energy = huntEnergyDisplay(hunt);
  return `<div class="hunt-map-heading">
    <span>MAPA DE CACERÍA</span>
    <div class="hunt-map-title-row">
      <h2>Elige tu destino</h2>
      <div class="hunt-map-energy" aria-label="${energy.aria}"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${energy.html}</strong></div>
    </div>
    <p>Cada región guarda enemigos, recursos y peligros diferentes.</p>
  </div>
  <section class="hunt-world-map" aria-label="Mapa de zonas de caza">
    <img src="hunt/world-map.jpg" alt="Mapa de zonas de caza" onerror="this.style.display='none'">
    <button type="button" class="hunt-map-zone" data-open-hunt-region>
      Campos de la Bruma
    </button>
    <div class="hunt-map-coming-soon"><span>PRÓXIMAMENTE</span></div>
  </section>
  `;
}

export function renderHuntView({ document, game, stats, intoxication, nowTimestamp = Date.now() }) {
  const root = document.getElementById('huntContent');
  if (!root) return;
  if (!game?.cls) {
    root.innerHTML = '<div class="card hunt-locked"><h2>Cacería</h2><p>Elige primero una clase para entrar en los Campos de la Bruma.</p></div>';
    return;
  }
  const hunt = normalizeHuntState(game.hunt, nowTimestamp);
  const isRegionScreen = root.dataset.huntScreen === 'region';
  if (!isRegionScreen) {
    root.innerHTML = regionMapMarkup(hunt);
    return;
  }
  const active = hunt.active;
  const energy = huntEnergyDisplay(hunt);
  const heroLevel = Math.max(1, Number(stats?.lvl) || 1);
  const activeDifficulty = active ? HUNT_DIFFICULTIES[active.difficultyId] : null;
  const activeMarkup = active ? `<section class="card hunt-active">
    <span>CACERÍA EN CURSO · ${activeDifficulty.name}</span>
    <strong data-hunt-countdown data-hunt-ends-at="${active.endsAt}">${remainingLabel(active.endsAt - nowTimestamp)}</strong>
    <p>Tu héroe atraviesa los Campos de la Bruma. Puedes cerrar la aplicación.</p>
    <button type="button" data-resolve-hunt ${nowTimestamp < active.endsAt ? 'disabled' : ''}>${nowTimestamp < active.endsAt ? 'Informe disponible al terminar' : 'VER INFORME'}</button>
  </section>` : '';
  const difficulties = Object.values(HUNT_DIFFICULTIES).map((difficulty) => {
    const levelLocked = heroLevel < difficulty.minLevel;
    return `<button type="button" class="hunt-difficulty ${difficulty.id}${levelLocked ? ' level-locked' : ''}" data-start-hunt="${difficulty.id}" ${active || levelLocked || hunt.energy < difficulty.energyCost ? 'disabled' : ''}>
    <span>${difficulty.name}</span><b>${levelLocked ? `🔒 Nivel ${difficulty.minLevel}` : `<span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span>${difficulty.energyCost}`}</b>
  </button>`;
  }).join('');
  root.innerHTML = `<button type="button" class="hunt-map-back" data-back-hunt-map>‹ VOLVER AL MAPA</button><div class="hunt-heading"><div class="hunt-region-title-row"><h2>Campos de la Bruma</h2><div class="hunt-map-energy" aria-label="${energy.aria}"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${energy.html}</strong></div></div><p>Cultivos corrompidos alimentan una niebla que doblega la voluntad. Envía a tu héroe a purificarlos.</p></div>
    <div class="hunt-region-art"><img src="hunt/fields-of-mist/region.png" alt="Campos de la Bruma" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="hunt-region-fallback" style="display:none">CAMPOS DE LA BRUMA<br><small>ARTE DE REGIÓN PENDIENTE</small></span></div>
    ${activeMarkup}
    <section class="card hunt-roster"><div class="hunt-section-title"><span>Enemigos</span></div><div class="hunt-monsters">${BRUMA_ENEMIES.map(monsterCard).join('')}</div></section>
    <section class="card hunt-launch"><div class="hunt-section-title"><span>Elegir dificultad</span>${active ? '<b>Una expedición activa</b>' : ''}</div><div class="hunt-difficulties">${difficulties}</div><small>La energía se recupera al comenzar un nuevo día. La Sangre de Jefe solo puede caer en Difícil.</small></section>
    ${reportMarkup(hunt.lastReport)}`;
}

export function updateHuntCountdown(document, nowTimestamp = Date.now()) {
  const countdown = document.querySelector('[data-hunt-countdown]');
  if (!countdown) return false;
  const endsAt = Number(countdown.dataset.huntEndsAt) || 0;
  countdown.textContent = remainingLabel(endsAt - nowTimestamp);
  const ready = nowTimestamp >= endsAt;
  const button = document.querySelector('[data-resolve-hunt]');
  if (button && ready) {
    button.disabled = false;
    button.textContent = 'VER INFORME';
  }
  return ready;
}
