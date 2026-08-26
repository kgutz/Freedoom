import {
  BRUMA_ENEMIES,
  HUNT_DIFFICULTIES,
  normalizeHuntState,
} from '../domain/pve-combat-rules.js';

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

function reportMarkup(report) {
  if (!report) return '';
  const canDropBossBlood = report.difficultyId === 'hard';
  const rows = report.encounters.map((encounter) => `<div class="hunt-report-row ${encounter.won ? 'won' : 'lost'}">
    <span>${encounter.role} · ${encounter.name}</span>
    <b>${encounter.won ? 'VICTORIA' : 'DERROTA'}</b>
    <small>${encounter.rounds} rondas · ${encounter.damageDealt} daño · ${encounter.heroHp} HP restante${encounter.won ? ` · +${encounter.rewards?.xp || 0} XP · +${encounter.rewards?.gold || 0} oro${encounter.rewards?.arcaneFibers ? ` · +${encounter.rewards.arcaneFibers} fibra${encounter.rewards.arcaneFibers === 1 ? '' : 's'}` : ''}${encounter.rewards?.bossBlood ? ' · +1 sangre' : ''}` : ''}</small>
  </div>`).join('');
  const rewards = report.rewards;
  return `<section class="card hunt-report">
    <div class="hunt-section-title"><span>Último informe</span><b>${report.won ? 'EXPEDICIÓN SUPERADA' : 'EXPEDICIÓN FALLIDA'}</b></div>
    <div class="hunt-report-result ${report.won ? 'won' : 'lost'}">${report.won ? 'La bruma retrocede' : 'Tu héroe tuvo que retirarse'}</div>
    <div class="hunt-report-list">${rows}</div>
    <div class="hunt-rewards">
      <span>✦ <b>${Math.max(0, Number(rewards.xp) || 0)}</b> XP</span>
      <span aria-label="Oro obtenido">🪙 <b>${rewards.gold}</b></span>
      <span aria-label="Fibra Arcana obtenida">🧵 <b>${rewards.arcaneFibers}</b></span>
      ${canDropBossBlood ? `<span aria-label="Sangre de Jefe obtenida">🩸 <b>${rewards.bossBlood}</b></span>` : ''}
    </div>
  </section>`;
}

function regionMapMarkup(hunt) {
  return `<div class="hunt-map-heading">
    <span>MAPA DE CACERÍA</span>
    <div class="hunt-map-title-row">
      <h2>Elige tu destino</h2>
      <div class="hunt-map-energy" aria-label="Energía de Cacería: ${hunt.energy} de 5"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${hunt.energy}/5</strong></div>
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
  root.innerHTML = `<button type="button" class="hunt-map-back" data-back-hunt-map>‹ VOLVER AL MAPA</button><div class="hunt-heading"><div class="hunt-region-title-row"><h2>Campos de la Bruma</h2><div class="hunt-map-energy" aria-label="Energía de Cacería: ${hunt.energy} de 5"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${hunt.energy}/5</strong></div></div><p>Cultivos corrompidos alimentan una niebla que doblega la voluntad. Envía a tu héroe a purificarlos.</p></div>
    <div class="hunt-region-art"><img src="hunt/fields-of-mist/region.png" alt="Campos de la Bruma" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="hunt-region-fallback" style="display:none">CAMPOS DE LA BRUMA<br><small>ARTE DE REGIÓN PENDIENTE</small></span></div>
    ${activeMarkup}
    <section class="card hunt-roster"><div class="hunt-section-title"><span>Enemigos</span></div><div class="hunt-monsters">${BRUMA_ENEMIES.map(monsterCard).join('')}</div></section>
    <section class="card hunt-launch"><div class="hunt-section-title"><span>Elegir dificultad</span><b>Una expedición activa</b></div><div class="hunt-difficulties">${difficulties}</div><small>La energía se recupera al comenzar un nuevo día. La Sangre de Jefe solo puede caer en Difícil.</small></section>
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
