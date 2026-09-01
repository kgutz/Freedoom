import {
  HUNT_ENEMIES,
  HUNT_DIFFICULTIES,
  HUNT_REGIONS,
  huntDifficultyMinLevel,
  normalizeHuntState,
} from '../domain/pve-combat-rules.js';
import { resourceIcon, resourceValue } from './resource-icons.js';

function remainingLabel(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function resourcePercent(value, maximum) {
  const safeMaximum = Math.max(0, Number(maximum) || 0);
  if (!safeMaximum) return 0;
  return Math.max(0, Math.min(100, Math.round((Math.max(0, Number(value) || 0) / safeMaximum) * 100)));
}

function enemyRoleClass(role) {
  const normalized = String(role || '').toLowerCase();
  if (normalized.includes('mini')) return 'miniboss';
  if (normalized.includes('líder') || normalized.includes('lider')) return 'leader';
  return 'soldier';
}

function monsterCard(enemy) {
  return `<button type="button" class="hunt-monster ${enemy.id}" data-hunt-monster="${enemy.id}" aria-label="Ver historia de ${enemy.name}">
    <div class="hunt-monster-art">
      <img src="${enemy.art}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
      <span class="hunt-art-fallback" style="display:none">?</span>
    </div>
    <span>${enemy.role}</span><b>${enemy.name}</b>
  </button>`;
}

function huntEnergyDisplay(hunt) {
  const maximum = Math.max(1, Number(hunt.baseEnergy) || 10);
  const bonus = Math.max(0, Number(hunt.bonusEnergyRemaining) || 0)
    + Math.max(0, Number(hunt.rewardEnergyRemaining) || 0);
  const base = Math.max(0, Math.min(maximum, (Number(hunt.energy) || 0) - bonus));
  const bonusMarkup = bonus ? `<em>+${bonus}</em>` : '';
  return {
    aria: `Energía de Cacería: ${base} de ${maximum}${bonus ? `, más ${bonus} extra` : ''}`,
    html: `${base}/${maximum}${bonusMarkup}`,
  };
}

export function renderHuntMonsterDetail({ document, enemyId }) {
  const enemy = HUNT_ENEMIES.find((candidate) => candidate.id === enemyId);
  const root = document.getElementById('huntMonsterBody');
  if (!enemy || !root) return false;
  root.innerHTML = `<div class="hunt-monster-detail-art ${enemy.id}">
      <img src="${enemy.art}" alt="${enemy.name}" loading="lazy" decoding="async">
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
    Number(rewards.arcaneInks) > 0
      ? `<div class="hunt-result-reward-slot">${resourceIcon('arcane-ink')}<b>${Math.max(0, Number(rewards.arcaneInks) || 0)}</b></div>`
      : '',
    Number(rewards.bossBlood) > 0
      ? `<div class="hunt-result-reward-slot">${resourceIcon('boss-blood')}<b>${Math.max(0, Number(rewards.bossBlood) || 0)}</b></div>`
      : '',
  ].filter(Boolean);
  if (!items.length) return '<div class="hunt-result-no-loot">Sin botín obtenido</div>';
  const fortuneGold = Math.max(0, Number(rewards.fortuneGold) || 0);
  const fortuneMarkup = fortuneGold
    ? `<div class="hunt-result-fortune-bonus">Poción de Fortuna · +${fortuneGold} oro (50%)</div>`
    : '';
  return `<div class="hunt-result-reward-grid items-${items.length}">${items.join('')}</div>${fortuneMarkup}`;
}

export function huntResultSummaryMarkup(report = {}) {
  const encounters = Array.isArray(report.encounters) ? report.encounters : [];
  const totalRounds = encounters.reduce((sum, encounter) => sum + Math.max(0, Number(encounter.rounds) || 0), 0);
  const damageDealt = encounters.reduce((sum, encounter) => sum + Math.max(0, Number(encounter.damageDealt) || 0), 0);
  const damageTaken = encounters.reduce((sum, encounter) => sum + Math.max(0, Number(encounter.damageTaken) || 0), 0);
  const potionUses = encounters.flatMap((encounter) => Array.isArray(encounter.potionUses) ? encounter.potionUses : []);
  const lifePotions = potionUses.filter((use) => use?.type === 'life').length;
  const manaPotions = potionUses.filter((use) => use?.type === 'mana').length;
  const defeatedEnemies = Math.max(0, Number(report.defeatedEnemies) || 0);
  const heroHp = Math.max(0, Number(report.heroHp) || 0);
  const heroMana = Math.max(0, Number(report.heroMana) || 0);
  const heroMaxHp = Math.max(heroHp, Number(report.heroMaxHp) || 0);
  const heroMaxMana = Math.max(heroMana, Number(report.heroMaxMana) || 0);
  const heroHpPercent = resourcePercent(heroHp, heroMaxHp);
  const heroManaPercent = resourcePercent(heroMana, heroMaxMana);
  const potionSummary = lifePotions || manaPotions
    ? `<small>Pociones usadas · Vida ×${lifePotions} · Maná ×${manaPotions}</small>`
    : '';
  const fortuneGold = Math.max(0, Number(report.rewards?.fortuneGold) || 0);
  const fortuneSummary = report.fortune
    ? `<small class="hunt-result-fortune-summary">Fortuna · +${fortuneGold} oro de bonificación</small>`
    : '';
  return `<div class="hunt-result-battle-summary">
    <div><span>Enemigos</span><b>${defeatedEnemies}/3</b></div>
    <div><span>Rondas</span><b>${totalRounds}</b></div>
    <div><span>Daño efectuado</span><b>${damageDealt}</b></div>
    <div><span>Daño recibido</span><b>${damageTaken}</b></div>
    <section class="hunt-result-exit-status">
      <span>Salida de la cacería</span>
      <b><i>Vida</i> ${heroHpPercent}%</b>
      <b><i>Maná</i> ${heroManaPercent}%</b>
    </section>
    ${potionSummary}
    ${fortuneSummary}
  </div>`;
}

function reportMarkup(report) {
  if (!report) return '';
  const region = HUNT_REGIONS[report.regionId] || HUNT_REGIONS['fields-of-mist'];
  const rows = report.encounters.map((encounter, encounterIndex) => {
    const recoveryAfterHp = Math.max(0, Number(encounter.recoveryAfter?.hp) || 0);
    const recoveryAfterMana = Math.max(0, Number(encounter.recoveryAfter?.mana) || 0);
    const nextHeroHp = Number.isFinite(Number(encounter.nextHeroHp))
      ? Math.max(0, Number(encounter.nextHeroHp))
      : Math.max(0, Number(encounter.heroHp) || 0) + recoveryAfterHp;
    const nextHeroMana = Number.isFinite(Number(encounter.nextHeroMana))
      ? Math.max(0, Number(encounter.nextHeroMana))
      : Math.max(0, Number(encounter.heroMana) || 0) + recoveryAfterMana;
    const heroMaxHp = Math.max(nextHeroHp, Number(report.heroMaxHp) || 0);
    const heroMaxMana = Math.max(nextHeroMana, Number(report.heroMaxMana) || 0);
    const movesToNextEnemy = encounter.won && encounterIndex < report.encounters.length - 1;
    const nextHpPercent = resourcePercent(nextHeroHp, heroMaxHp);
    const nextManaPercent = resourcePercent(nextHeroMana, heroMaxMana);
    const rewardsMarkup = encounter.won
      ? `<div class="hunt-encounter-rewards"><span>BOTÍN</span><b>✦ ${encounter.rewards?.xp || 0} XP</b>${resourceValue('coin', encounter.rewards?.gold || 0)}${encounter.rewards?.arcaneFibers ? resourceValue('arcane-fiber', encounter.rewards.arcaneFibers) : ''}${encounter.rewards?.arcaneInks ? resourceValue('arcane-ink', encounter.rewards.arcaneInks) : ''}${encounter.rewards?.bossBlood ? resourceValue('boss-blood', encounter.rewards.bossBlood) : ''}</div>`
      : '';
    const recoveryMarkup = recoveryAfterHp > 0 || recoveryAfterMana > 0
      ? `<div class="hunt-encounter-recovery"><span>RECUPERACIÓN</span><b>+${recoveryAfterHp} vida · +${recoveryAfterMana} maná</b></div>`
      : '';
    const roleClass = enemyRoleClass(encounter.role);
    return `<details class="hunt-report-row ${encounter.won ? 'won' : 'lost'}">
      <summary>
        <span class="hunt-report-enemy"><strong>${encounter.name}</strong><small class="hunt-report-role ${roleClass}">${encounter.role}</small></span>
        <b>${encounter.won ? 'VICTORIA' : 'DERROTA'}</b>
        <i class="hunt-report-chevron" aria-hidden="true"></i>
      </summary>
      <div class="hunt-report-detail">
        <div class="hunt-encounter-totals">
          <span><small>RONDAS</small><b>${encounter.rounds}</b></span>
          <span><small>DAÑO EFECTUADO</small><b>${encounter.damageDealt}</b></span>
          <span><small>DAÑO RECIBIDO</small><b>${Math.max(0, Number(encounter.damageTaken) || 0)}</b></span>
        </div>
        ${recoveryMarkup}
        ${rewardsMarkup}
        <div class="hunt-encounter-next"><span>${movesToNextEnemy ? 'SIGUIENTE COMBATE' : 'FIN DE LOS COMBATES'}</span><b>${nextHpPercent}% vida · ${nextManaPercent}% maná</b></div>
      </div>
    </details>`;
  }).join('');
  const rewards = report.rewards;
  const exitHp = Math.max(0, Number(report.heroHp) || 0);
  const exitMana = Math.max(0, Number(report.heroMana) || 0);
  const exitMaxHp = Math.max(exitHp, Number(report.heroMaxHp) || 0);
  const exitMaxMana = Math.max(exitMana, Number(report.heroMaxMana) || 0);
  const exitHpPercent = resourcePercent(exitHp, exitMaxHp);
  const exitManaPercent = resourcePercent(exitMana, exitMaxMana);
  const firstEncounter = report.encounters[0];
  const entryHp = Number.isFinite(Number(firstEncounter?.heroHpAtStart))
    ? Math.max(0, Number(firstEncounter.heroHpAtStart))
    : exitMaxHp;
  const entryMana = Number.isFinite(Number(firstEncounter?.heroManaAtStart))
    ? Math.max(0, Number(firstEncounter.heroManaAtStart))
    : exitMaxMana;
  const entryHpPercent = resourcePercent(entryHp, exitMaxHp);
  const entryManaPercent = resourcePercent(entryMana, exitMaxMana);
  const recoveryMarkup = `<div class="hunt-report-resource-comparison">
    <div><span>ENTRASTE</span><b>${entryHpPercent}% vida</b><b>${entryManaPercent}% maná</b></div>
    <i aria-hidden="true">→</i>
    <div><span>SALISTE</span><b>${exitHpPercent}% vida</b><b>${exitManaPercent}% maná</b></div>
  </div>`;
  const rewardItems = [
    Number(rewards.xp) > 0 ? `<span>✦ <b>${Math.max(0, Number(rewards.xp) || 0)}</b> XP</span>` : '',
    Number(rewards.gold) > 0 ? resourceValue('coin', rewards.gold) : '',
    Number(rewards.arcaneFibers) > 0 ? resourceValue('arcane-fiber', rewards.arcaneFibers) : '',
    Number(rewards.arcaneInks) > 0 ? resourceValue('arcane-ink', rewards.arcaneInks) : '',
    Number(rewards.bossBlood) > 0 ? resourceValue('boss-blood', rewards.bossBlood) : '',
  ].filter(Boolean).join('');
  const fortuneGold = Math.max(0, Number(rewards.fortuneGold) || 0);
  const fortuneMarkup = report.fortune
    ? `<span class="hunt-report-fortune">Fortuna · +${fortuneGold} oro (50%)</span>`
    : '';
  const resultLabel = report.won ? 'EXPEDICIÓN SUPERADA' : Number(report.defeatedEnemies) > 0 ? 'AVANCE PARCIAL' : 'EXPEDICIÓN FALLIDA';
  return `<section class="card hunt-report">
    <div class="hunt-section-title"><span>Último informe</span><b>${resultLabel}</b></div>
    <div class="hunt-report-result ${report.won ? 'won' : 'lost'}"><strong>${report.won ? region.victoryMessage : 'Tu héroe tuvo que retirarse'}</strong>${recoveryMarkup}</div>
    <div class="hunt-report-list">${rows}</div>
    <div class="hunt-rewards">${rewardItems || '<span>Sin botín obtenido</span>'}${fortuneMarkup}</div>
  </section>`;
}

function regionMapMarkup(hunt) {
  const energy = huntEnergyDisplay(hunt);
  const activeRegionId = hunt.active ? hunt.active.regionId || 'fields-of-mist' : null;
  return `<div class="hunt-map-heading">
    <span>MAPA DE CACERÍA</span>
    <div class="hunt-map-title-row">
      <h2>Elige tu destino</h2>
      <div class="hunt-map-energy" aria-label="${energy.aria}"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${energy.html}</strong></div>
    </div>
    <p>Cada región guarda enemigos, recursos y peligros diferentes.</p>
  </div>
  <section class="hunt-world-map" aria-label="Mapa de zonas de caza">
    <img src="hunt/world-map-bunker.webp" alt="Mapa de zonas de caza" loading="lazy" decoding="async" onerror="this.style.display='none'">
    <button type="button" class="hunt-map-zone hunt-map-zone--mist${activeRegionId === 'fields-of-mist' ? ' active' : ''}" data-open-hunt-region="fields-of-mist">
      Campos de la Bruma
    </button>
    <button type="button" class="hunt-map-zone hunt-map-zone--bunker${activeRegionId === 'dead-hours-bunker' ? ' active' : ''}" data-open-hunt-region="dead-hours-bunker">
      Búnker de las Horas Muertas
    </button>
    <div class="hunt-map-coming-soon hunt-map-coming-soon--northwest"><span>PRÓXIMAMENTE</span></div>
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
  const heroLevel = Math.max(1, Number(stats?.lvl) || 1);
  const isRegionScreen = root.dataset.huntScreen === 'region';
  if (!isRegionScreen) {
    root.innerHTML = regionMapMarkup(hunt);
    return;
  }
  const active = hunt.active;
  const activeRegionId = active ? active.regionId || 'fields-of-mist' : null;
  const selectedRegionId = HUNT_REGIONS[root.dataset.huntRegion]
    ? root.dataset.huntRegion
    : activeRegionId || 'fields-of-mist';
  const region = HUNT_REGIONS[selectedRegionId];
  const regionMinLevel = huntDifficultyMinLevel(region.id, 'easy');
  const regionLocked = heroLevel < regionMinLevel;
  const regionActive = Boolean(active) && activeRegionId === region.id;
  const energy = huntEnergyDisplay(hunt);
  const activeDifficulty = active ? HUNT_DIFFICULTIES[active.difficultyId] : null;
  const activeMarkup = regionActive ? `<div class="hunt-region-active" aria-label="Cacería en curso">
    <span>CACERÍA EN CURSO · ${activeDifficulty.name}</span>
    <strong data-hunt-countdown data-hunt-ends-at="${active.endsAt}">${remainingLabel(active.endsAt - nowTimestamp)}</strong>
    <button type="button" data-resolve-hunt ${nowTimestamp < active.endsAt ? 'disabled' : ''}>${nowTimestamp < active.endsAt ? 'Informe disponible al terminar' : 'VER INFORME'}</button>
  </div>` : '';
  const difficulties = Object.values(HUNT_DIFFICULTIES).map((difficulty) => {
    const requiredLevel = huntDifficultyMinLevel(region.id, difficulty.id);
    const levelLocked = heroLevel < requiredLevel;
    return `<button type="button" class="hunt-difficulty ${difficulty.id}${levelLocked ? ' level-locked' : ''}" data-start-hunt="${difficulty.id}" data-hunt-region="${region.id}" ${active || levelLocked || hunt.energy < difficulty.energyCost ? 'disabled' : ''}>
    <span class="hunt-difficulty-main"><span>${difficulty.name}</span><i aria-hidden="true">-</i><b><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span>${difficulty.energyCost}</b></span><small class="hunt-difficulty-level">${levelLocked ? '🔒 ' : ''}Nivel ${requiredLevel}</small>
  </button>`;
  }).join('');
  const otherRegionActive = active && !regionActive;
  root.innerHTML = `<div class="hunt-region hunt-region--${region.id}"><button type="button" class="hunt-map-back" data-back-hunt-map>‹ VOLVER AL MAPA</button><div class="hunt-heading"><div class="hunt-region-title-row"><h2>${region.name}</h2><div class="hunt-map-energy" aria-label="${energy.aria}"><span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><strong>${energy.html}</strong></div></div><p>${region.description}</p>${regionLocked ? `<div class="hunt-region-lock-notice"><span aria-hidden="true">🔒</span> Alcanza el nivel ${regionMinLevel} para iniciar esta cacería</div>` : ''}</div>
    <div class="hunt-region-art"><img src="${region.art}" alt="${region.name}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="hunt-region-fallback" style="display:none">${region.name.toUpperCase()}<br><small>ARTE DE REGIÓN PENDIENTE</small></span>${activeMarkup}</div>
    <section class="card hunt-roster"><div class="hunt-section-title"><span>Enemigos</span></div><div class="hunt-monsters">${region.enemies.map(monsterCard).join('')}</div></section>
    <section class="card hunt-launch"><div class="hunt-section-title"><span>Elegir dificultad</span>${active ? `<b>${otherRegionActive ? 'Expedición activa en otra zona' : 'Una expedición activa'}</b>` : ''}</div><div class="hunt-difficulties">${difficulties}</div><small>La energía se recupera al comenzar un nuevo día. La Sangre de Jefe solo puede caer en Difícil.</small></section>
    ${(hunt.lastReport?.regionId || 'fields-of-mist') === region.id ? reportMarkup(hunt.lastReport) : ''}</div>`;
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
