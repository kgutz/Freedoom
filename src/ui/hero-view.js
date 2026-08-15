import {
  BOSSES,
  BOSS_SLUGS,
  CLASSES,
  classDataForJourney,
} from '../data/game-data.js';
import { keyOf, minutesOf } from '../domain/date-utils.js';
import {
  logicalClockMinutes,
  logicalTimeMinutes,
} from '../domain/day-boundary-rules.js';
import {
  bossCountForJourney,
  isControlledMode,
  isSmokeFreeMode,
  usesSmokeFreeSkills,
} from '../domain/journey-mode-rules.js';
import { resourceValue } from './inventory-view.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function spriteImage(classId, mood, extraClass = '') {
  const available = {
    knight: ['happy'],
    paladin: ['happy'],
    sorcerer: ['happy'],
    druid: ['happy'],
  };
  const file = (available[classId] || ['happy']).includes(mood)
    ? mood
    : 'happy';
  const hurt = mood === 'hurt' ? ' hurt' : '';
  return `<img class="sprite-svg${hurt} ${extraClass}" src="sprites/${classId}_${file}.png" alt="${classId}" draggable="false">`;
}

const HERO_ENERGY_CLASSES = new Set(['knight', 'paladin', 'sorcerer', 'druid']);
const HERO_ENERGY_MILESTONES = [0, 0.18, 0.34, 0.5, 0.66];

export function heroEnergyBaseline(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const milestone = clamp(Math.floor(safeLevel / 5), 0, HERO_ENERGY_MILESTONES.length - 1);
  return HERO_ENERGY_MILESTONES[milestone];
}

export function heroEnergyModel({
  progress = 0,
  level = 1,
  classId,
  levelUp = false,
} = {}) {
  const normalizedProgress = clamp(Number(progress) || 0, 0, 1);
  const baseline = heroEnergyBaseline(level);
  const energyProgress = baseline + normalizedProgress * (1 - baseline);
  const stage = energyProgress < 0.25
    ? 0
    : energyProgress < 0.5
      ? 1
      : energyProgress < 0.75
        ? 2
        : 3;

  return {
    progress: normalizedProgress,
    percent: Math.round(normalizedProgress * 100),
    level: Math.max(1, Math.floor(Number(level) || 1)),
    baseline,
    energyProgress,
    energyPercent: Math.round(energyProgress * 100),
    glowOpacity: (0.02 + energyProgress * 0.58).toFixed(3),
    glowScale: (0.82 + energyProgress * 0.18).toFixed(3),
    particleOpacity: (0.18 + energyProgress * 0.82).toFixed(3),
    breatheLowOpacity: (0.02 + energyProgress * 0.5).toFixed(3),
    breatheHighOpacity: (0.08 + energyProgress * 0.62).toFixed(3),
    breatheLowScale: (0.82 + energyProgress * 0.16).toFixed(3),
    breatheHighScale: (0.86 + energyProgress * 0.18).toFixed(3),
    stage,
    classId: HERO_ENERGY_CLASSES.has(classId) ? classId : 'paladin',
    levelUp: Boolean(levelUp),
  };
}

export function didHeroLevelUp(previousLevel, currentLevel) {
  return Number.isFinite(previousLevel)
    && Number.isFinite(currentLevel)
    && currentLevel > previousLevel;
}

function heroEnergyMarkup(energy) {
  const particles = Array.from(
    { length: 8 },
    (_, index) => `<i class="hero-energy-particle p${index + 1}"></i>`,
  ).join('');
  const classes = [
    'hero-energy',
    `hero-energy--${energy.classId}`,
    `hero-energy--stage-${energy.stage}`,
    energy.levelUp ? 'is-leveling-up' : '',
  ].filter(Boolean).join(' ');

  return {
    classes,
    style: [
      `--hero-energy-progress:${energy.energyProgress.toFixed(3)}`,
      `--hero-energy-opacity:${energy.glowOpacity}`,
      `--hero-energy-scale:${energy.glowScale}`,
      `--hero-particle-opacity:${energy.particleOpacity}`,
      `--hero-breathe-low-opacity:${energy.breatheLowOpacity}`,
      `--hero-breathe-high-opacity:${energy.breatheHighOpacity}`,
      `--hero-breathe-low-scale:${energy.breatheLowScale}`,
      `--hero-breathe-high-scale:${energy.breatheHighScale}`,
    ].join(';'),
    markup: `<div class="hero-energy-field" aria-hidden="true">
      <span class="hero-energy-glow"></span>
      <span class="hero-energy-particles">${particles}</span>
      <span class="hero-level-up-burst"></span>
    </div>`,
  };
}

export function createHeroModel({
  now,
  config,
  days,
  game,
  stats,
  boss,
  armor,
  intoxication,
  dayKey = keyOf(now),
}) {
  const classId = game?.cls;
  if (!classId || !CLASSES[classId]) {
    return { selection: true };
  }

  const classData = classDataForJourney(classId,{
    smokeFree:usesSmokeFreeSkills(config),
  });
  const hp = Math.max(0, Math.round(game.hp ?? 100));
  const mana = Math.max(0, Math.round(game.mp ?? 0));
  const hpPercent = clamp((hp / stats.maxHp) * 100, 0, 100);
  const manaPercent = clamp((mana / stats.maxMp) * 100, 0, 100);
  const dayStartTime = config.dayStartTime || '04:00';
  const nowMinutes = logicalTimeMinutes(now, dayStartTime);
  const wakeMinutes = logicalClockMinutes(
    minutesOf(config.wakeTime || '09:00'),
    dayStartTime,
  );
  const today = dayKey;
  const todayRecord = days[today] || { c: 0, p: 0 };
  let mood;
  if (nowMinutes < wakeMinutes && todayRecord.c === 0) mood = 'sleep';
  else if (hpPercent > 70) mood = 'happy';
  else if (hpPercent > 40) mood = 'neutral';
  else if (hpPercent > 15) mood = 'worried';
  else mood = 'hurt';

  let hpClass = 'hp-crit';
  if (hpPercent > 70) hpClass = 'hp-hi';
  else if (hpPercent > 40) hpClass = 'hp-mid';
  else if (hpPercent > 15) hpClass = 'hp-low';

  const buffs = game.buffs || {};
  const nowTimestamp = now.getTime();
  const skillEffects = classData.act
    .map((ability) => ({
      spellId: ability.id,
      icon: ability.icon,
      name: ability.name,
      remaining: activeSpellStatus({
        spellId: ability.id,
        game,
        nowTimestamp,
        today,
        smokeFreeMode: usesSmokeFreeSkills(config),
      }),
    }))
    .filter((effect) => /^\d+m$/.test(effect.remaining || ''));
  if (intoxication?.level > 0) {
    skillEffects.push({
      kind: 'intoxication',
      spellId: 'intoxication',
      name: 'Borrachera',
      level: intoxication.level,
      remaining: `${intoxication.remainingMinutes}m`,
    });
  }

  return {
    selection: false,
    classId,
    classData,
    hp,
    mana,
    hpPercent,
    manaPercent,
    hpClass,
    mood,
    skillEffects,
    stats,
    boss,
    armor,
    perfectToday: todayRecord.s || 0,
    intoxication,
  };
}

function remainingMinutesLabel(until, nowTimestamp) {
  if (!Number.isFinite(until) || until <= nowTimestamp) return null;
  return `${Math.max(1, Math.ceil((until - nowTimestamp) / 60_000))}m`;
}

export function activeSpellStatus({
  spellId,
  game,
  nowTimestamp,
  today,
  smokeFreeMode = false,
}) {
  const buffs = game?.buffs || {};
  if (spellId === 'ceniza') return remainingMinutesLabel(buffs.cenizaUntil, nowTimestamp);
  if (spellId === 'regen') return remainingMinutesLabel(buffs.regenUntil, nowTimestamp);
  if (spellId === 'certero') {
    if (smokeFreeMode) return buffs.habitFocusCharges > 0 ? `×${buffs.habitFocusCharges}` : null;
    return remainingMinutesLabel(buffs.certeroUntil, nowTimestamp);
  }
  if (spellId === 'muro') return buffs.shield > 0 ? `×${buffs.shield}` : null;
  if (spellId === 'bastion') return buffs.bastion ? 'LISTO' : null;
  if (spellId === 'renacer') return buffs.renacer ? 'HOY' : null;
  if (spellId === 'juicio') return (game?.judgmentDays || []).includes(today) ? 'HOY' : null;
  if (spellId === 'peste') {
    const active = smokeFreeMode
      ? (game?.pestXpDays || []).includes(today)
      : buffs.pesteDay === today;
    return active ? 'HOY' : null;
  }
  return null;
}

function skillIcon(classId, level, ability, type, status = null) {
  const active = level >= ability.lvl;
  const ultimateClass = ability.ulti ? ' ulti' : '';
  const statusClass = status ? ' spell-effect-active' : '';
  const passiveActiveClass = type === 'pas' && active ? ' passive-effect-active' : '';
  const source =
    `spells/${classId}_spells/` +
    `${classId}_${type}_${ability.icon}.png`;
  const fallback = ability.name.charAt(0);
  const attributes =
    type === 'act'
      ? `data-cast="${ability.id}"`
      : `data-pas-name="${ability.name}" data-pas-lvl="${ability.lvl}"`;
  return `<div class="skill-box ${active ? 'on' : 'off'}${ultimateClass}${statusClass}${passiveActiveClass}" ${attributes}>
      <span class="sk-lv">Nv ${ability.lvl}</span>
      <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="sk-fallback" style="display:none">${fallback}</span>
      ${status ? `<span class="skill-active-timer" aria-label="Efecto activo: ${status}">${status}</span>` : ''}
    </div>`;
}

export function renderHeroView({
  document,
  now,
  config,
  days,
  game,
  stats,
  boss,
  armor,
  intoxication,
  dayKey,
  lootState,
  classChange = false,
  currentClass = null,
  levelUp = false,
}) {
  const box = document.getElementById('heroContent');
  if (!box) return;
  const model = createHeroModel({
    now,
    config,
    days,
    game,
    stats,
    boss,
    armor,
    intoxication,
    dayKey,
  });

  if (model.selection) {
    const cards = Object.keys(CLASSES)
      .map(
        (classId) => {
          const classData=classDataForJourney(classId,{
            smokeFree:usesSmokeFreeSkills(config),
          });
          const isCurrent=classChange&&classId===currentClass;
          return `<div class="cls-card${isCurrent?' current-class':''}" data-cls="${classId}">
        ${spriteImage(classId, 'happy')}
        <div class="cn">${classData.name}</div>
        <div class="ce">${classData.es}</div>
        <div class="cd">${classData.desc}</div>
      </div>`;
        },
      )
      .join('');
    box.innerHTML = `<div class="card class-selection-card">
      ${classChange ? '<button type="button" class="class-change-back" id="classChangeBack" aria-label="Volver sin cambiar de clase">← Volver</button>' : ''}
      <h2>Elige tu clase</h2>
      <p class="hint" style="margin:0 0 14px">${classChange
        ? 'Puedes revisar todos los héroes. La Sangre de Jefe solo se gastará cuando confirmes tu nueva clase.'
        : 'Tu héroe vive de tus datos: gana XP cada día que cumples, sube de nivel, y su salud refleja cómo llevas el día de hoy. Elige con cabeza — el camino son 21 semanas.'}</p>
      <div class="cls-grid">${cards}</div>
    </div>`;
    return;
  }

  const {
    classId,
    classData,
    stats: heroStats,
    boss: bossState,
  } = model;
  const skillEffectsHtml = model.skillEffects
    .map((effect) => {
      const intoxicationEffect = effect.kind === 'intoxication';
      const source = intoxicationEffect
        ? 'spells/effect_icons/beer_effect_intoxication.png'
        : `spells/effect_icons/${classId}_effect_${effect.spellId}.png`;
      const effectLabel = intoxicationEffect
        ? `${effect.name} ${effect.level}%: ${effect.remaining} restantes`
        : `${effect.name}: ${effect.remaining} restantes`;
      const modifier = intoxicationEffect ? ' skill-buff--intoxication' : '';
      const iconModifier = intoxicationEffect
        ? ' skill-buff-icon--intoxication'
        : '';
      return `<span class="skill-buff${modifier}" aria-label="${effectLabel}">
      <span class="skill-buff-icon${iconModifier}">
        <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="sk-fallback" style="display:none">${effect.name.charAt(0)}</span>
      </span>
      <b>${effect.remaining}</b>
    </span>`;
    })
    .join('');
  const chipsHtml = skillEffectsHtml
    ? `<div class="buff-row">${skillEffectsHtml}</div>`
    : '';
  const pips = bossState.pips
    .map((pip) => {
      const symbol =
        pip === 'hit' ? '✕' : pip === 'fail' ? '!' : pip === 'today' ? '●' : '·';
      return `<div class="pip ${pip}">${symbol}</div>`;
    })
    .join('');
  const passiveIcons = classData.pas
    .map((ability) => skillIcon(classId, heroStats.lvl, ability, 'pas'))
    .join('');
  const activeIcons = classData.act
    .map((ability) => skillIcon(
      classId,
      heroStats.lvl,
      ability,
      'act',
      activeSpellStatus({
        spellId: ability.id,
        game,
        nowTimestamp: now.getTime(),
        today: dayKey || keyOf(now),
        smokeFreeMode: usesSmokeFreeSkills(config),
      }),
    ))
    .join('');
  const energy = heroEnergyModel({
    progress: heroStats.prog,
    level: heroStats.lvl,
    classId,
    levelUp,
  });
  const energyView = heroEnergyMarkup(energy);
  const sleeping = model.mood === 'sleep' ? '<span class="sprite-zzz">z z</span>' : '';
  const todayBreakdown = [
    ['Día', bossState.breakdownToday.completion],
    ['Margen', bossState.breakdownToday.margin],
    ['Perfectos', bossState.breakdownToday.perfect],
    ['Cero', bossState.breakdownToday.zero],
  ]
    .filter(([, value]) => value > 0)
    .map(
      ([label, value]) =>
        `<span class="boss-hit-chip">${label} <b>−${value}</b></span>`,
    )
    .join('');
  const smokeFreeMode = isSmokeFreeMode(config);
  const controlledMode = isControlledMode(config);
  const totalBosses = bossCountForJourney(config, BOSSES.length);
  const defeatedBosses = Math.min(totalBosses, heroStats.bossesDown);
  const currentBossIndex = Math.min(totalBosses - 1, bossState.bossNum - 1);
  const remainingBosses = Math.max(0, totalBosses - defeatedBosses);
  const revealedBossCount = Math.min(
    totalBosses,
    Math.max(defeatedBosses, currentBossIndex + 1),
  );
  const visibleBossMedalCount = Math.min(
    totalBosses,
    revealedBossCount + (revealedBossCount < totalBosses ? 1 : 0),
  );
  const bossMedals = Array.from({ length: visibleBossMedalCount }, (_, index) => {
    const defeated = index < defeatedBosses;
    const fighting = !defeated && index === currentBossIndex;
    if (!defeated && !fighting) {
      return `<div class="boss-medal locked">
        <div class="boss-medal-art"><img src="bosses/boss_medal_locked.png" alt="Jefe todavía desconocido"></div>
        <div class="boss-medal-name">DESCONOCIDO</div>
      </div>`;
    }
    const bossNumber = index + 1;
    const bossName = BOSSES[index];
    const bossSlug = BOSS_SLUGS[index];
    const bossFile = `boss_${String(bossNumber).padStart(2, '0')}_${bossSlug}.png`;
    if (fighting) {
      return `<div class="boss-medal fighting">
        <button class="boss-medal-open" type="button" data-open-boss-medal="${index}" data-boss-file="${bossFile}" aria-label="Abrir medallón de ${bossName}">
          <div class="boss-medal-art"><img src="bosses/${bossFile}" alt="${bossName}" onerror="this.style.display='none'"></div>
          <div class="boss-medal-name">${bossName}<strong>EN COMBATE</strong></div>
        </button>
      </div>`;
    }
    return `<div class="boss-medal won">
      <button class="boss-medal-open" type="button" data-open-boss-medal="${index}" data-boss-file="${bossFile}" aria-label="Abrir medallón de ${bossName}">
        <div class="boss-medal-art"><img src="bosses/${bossFile}" alt="${bossName}" onerror="this.style.display='none'"></div>
        <div class="boss-medal-name">${bossName}</div>
      </button>
      <button class="boss-medal-share" type="button" data-share-boss="${index}" data-share-file="${bossFile}">Compartir</button>
    </div>`;
  }).join('');
  const combatLog = (bossState.recentHits || [])
    .map((hit) => {
      const parts = [
        hit.completion ? `día ${hit.completion}` : '',
        hit.margin ? `margen ${hit.margin}` : '',
        hit.perfect ? `perfectos ${hit.perfect}` : '',
        hit.zero ? `cero ${hit.zero}` : '',
      ].filter(Boolean);
      return `<div class="boss-log-row"><span>${hit.key.slice(8, 10)}/${hit.key.slice(5, 7)} · ${parts.join(' + ')}</span><b>−${hit.total} HP</b></div>`;
    })
    .join('');
  const bossHistoryBody = document.getElementById('bossHistoryBody');
  if (bossHistoryBody) {
    bossHistoryBody.innerHTML = `
      <section class="boss-medals">
        <div class="boss-medals-head">
          <h4>Medallones de victoria · ${defeatedBosses}</h4>
          <p>Cada jefe derrotado revela su medallón. La incógnita representa los rivales que aún permanecen ocultos.</p>
        </div>
        <div class="boss-medals-grid">${bossMedals}</div>
      </section>
      <div class="boss-history-divider"></div>
      <h4 class="boss-combat-head">Combate actual</h4>
      <p class="boss-history-intro">Aquí puedes consultar los golpes registrados contra ${bossState.name} durante esta semana.</p>
      <div class="boss-gate">
        <span>SELLOS DE VICTORIA</span>
        <b>${bossState.completedDays} / ${bossState.requiredDays} días cumplidos</b>
      </div>
      <div class="boss-damage-summary">
        <span>Daño esta semana <b>${bossState.damageThisWeek}</b></span>
        <span>Daño hoy <b>${bossState.damageToday}</b></span>
      </div>
      ${bossState.earlyVictoryActive && !bossState.won
        ? '<div class="boss-early-victory-badge">VICTORIA ANTICIPADA · BONUS PENDIENTE</div>'
        : ''}
      ${
        todayBreakdown
          ? `<div class="boss-hit-chips">${todayBreakdown}</div>`
          : ''
      }
      ${
        bossState.controlledBudgetExceeded
          ? `<div class="boss-gate-warning">🔒 Has superado el máximo semanal (${bossState.controlledWeekUsed}/${bossState.controlledWeeklyLimit}). Los días permitidos de esta semana no rompen sellos.</div>`
          : bossState.lockedByDays
            ? `<div class="boss-gate-warning">🔒 El jefe resiste con 1 HP. Necesitas ${smokeFreeMode ? 'confirmar sin fumar' : controlledMode ? 'cumplir' : 'cerrar dentro del límite'} ${bossState.requiredDays - bossState.completedDays} día${bossState.requiredDays - bossState.completedDays === 1 ? '' : 's'} más.</div>`
          : (smokeFreeMode || controlledMode) && bossState.todayStatus === 'hit' && !bossState.won
          ? '<div class="boss-projection">✓ El golpe de hoy ya está registrado.</div>'
          : (smokeFreeMode || controlledMode) && bossState.todayStatus === 'fail' && !bossState.won
          ? '<div class="boss-projection">Hoy no causa daño al jefe.</div>'
          : !bossState.won
          ? `<div class="boss-projection">${smokeFreeMode ? 'Si confirmas el día sin fumar' : controlledMode ? 'Si cumples el objetivo de hoy' : 'Si cerraras el día así'}: <b>−${bossState.projectedToday} HP</b> en total hoy</div>`
          : '<div class="boss-victory">✓ Jefe vencido. El siguiente llegará al comenzar tu próxima semana.</div>'
      }
      ${
        combatLog
          ? `<div class="boss-log boss-log-sheet"><div class="boss-log-title">Últimos golpes</div>${combatLog}</div>`
          : '<div class="boss-log-empty">Todavía no has golpeado a este jefe.</div>'
      }`;
  }

  box.innerHTML = `
    <div class="card">
      <div class="hero-top">
        <div class="sprite-box ${energyView.classes}" style="${energyView.style}" data-xp-progress="${energy.percent}" data-xp-energy="${energy.energyPercent}"><img class="sprite-bg" src="hero_background/${classId}_bg.png" alt="">${energyView.markup}${spriteImage(classId, model.mood)}${sleeping}</div>
        <div class="hero-id">
          <div class="hero-rank-row">
            <div class="rango">${classData.name}</div>
          </div>
          <div class="hero-quick-actions">
            <button class="hero-quick-action hero-inventory-jump" type="button" data-open-inventory aria-label="Abrir inventario y forja" title="Abrir inventario y forja">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.5a4 4 0 0 1 8 0V7M7 7h10a2 2 0 0 1 2 2v11H5V9a2 2 0 0 1 2-2Zm1 5h8v5H8v-5ZM5 11H3.5v6H5m14-6h1.5v6H19"/></svg>
            </button>
            <button class="hero-quick-action" type="button" data-open-hero-skills aria-label="Abrir habilidades" title="Abrir habilidades">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h5.25A2.75 2.75 0 0 1 12 7.25V20a3.5 3.5 0 0 0-3.5-3.5H4V4.5Zm16 0h-5.25A2.75 2.75 0 0 0 12 7.25V20a3.5 3.5 0 0 1 3.5-3.5H20V4.5Z"/></svg>
            </button>
          </div>
          <div class="nombre">${game?.name || classData.name}</div>
          <div class="nivel">Nivel ${heroStats.lvl}</div>
          <button class="hero-resource-wallet" type="button" data-open-inventory aria-label="Abrir inventario y forja">
            ${resourceValue('coin', lootState?.economy?.coins)}
            ${resourceValue('boss-blood', lootState?.economy?.bossBlood)}
          </button>
          <div class="hero-summary">
            <span>Racha: <b>${heroStats.streak}</b> día${heroStats.streak === 1 ? '' : 's'}</span>
            <span>Armadura: <b>−${model.armor}</b></span>
            ${smokeFreeMode ? '' : `<span>Disparos perfectos hoy: <b>${model.perfectToday}</b></span>`}
          </div>
        </div>
      </div>
      ${chipsHtml}
      <div class="stat-bar">
        <div class="lbl"><span>SALUD</span><b>${model.hp} / ${heroStats.maxHp}</b></div>
        <div class="stat-track"><div class="stat-fill ${model.hpClass}" style="width:${model.hpPercent}%"></div></div>
      </div>
      <div class="stat-bar">
        <div class="lbl"><span>MANÁ</span><b>${model.mana} / ${heroStats.maxMp}</b></div>
        <div class="stat-track"><div class="stat-fill mp" style="width:${model.manaPercent}%"></div></div>
      </div>
      <div class="stat-bar">
        <div class="lbl"><span>EXPERIENCIA</span><b>${heroStats.xp} / ${heroStats.nextTh} XP</b></div>
        <div class="stat-track"><div class="stat-fill xp" style="width:${Math.round(heroStats.prog * 100)}%"></div></div>
      </div>
    </div>

    <div class="card">
      <div class="boss-top">
        <button type="button" class="boss-box boss-box-open" data-open-current-boss-medal="${currentBossIndex}" data-boss-file="boss_${String(bossState.bossNum).padStart(2, '0')}_${bossState.slug}.png" aria-label="Abrir medallón de ${bossState.name}">
          <img src="bosses/boss_${String(bossState.bossNum).padStart(2, '0')}_${bossState.slug}.png" alt="${bossState.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="boss-fallback" style="display:none">💀</span>
        </button>
        <div class="boss-id">
          <div class="boss-head">
            <h2 style="margin:0">Jefe de la semana</h2>
            <button class="sk-info-btn boss-info-btn" id="bossInfoBtn" aria-label="Ver historial de golpes">ⓘ</button>
          </div>
          <div class="boss-name">${bossState.name}<small>Seis días cumplidos garantizan la victoria</small></div>
          <div class="pips">${pips}</div>
        </div>
      </div>
      <div class="boss-hp-label">
        <span>${bossState.won ? 'DERROTADO' : 'VIDA DEL JEFE'}</span>
        <b>${bossState.hp} / ${bossState.maxHp} HP</b>
      </div>
      <div class="boss-hp-track"><div class="boss-hp-fill${bossState.won ? ' defeated' : ''}" style="width:${bossState.hpPercent}%"></div></div>
      <div class="boss-count">Jefes derrotados: <b>${defeatedBosses}</b>${remainingBosses > 0 ? ' de <b>?</b> · ¡Aún quedan jefes por derrotar!' : ' · campaña completada'}</div>
    </div>`;

  const skillsModalBody = document.getElementById('heroSkillsModalBody');
  if (skillsModalBody) {
    skillsModalBody.innerHTML = `
      <div class="sk-row-label">Activas</div>
      <div class="skill-row">${activeIcons}</div>
      <div class="sk-row-label secondary">Pasivas</div>
      <div class="skill-row">${passiveIcons}</div>`;
  }
}

function detailedIcon(classId, ability, type) {
  const source =
    `spells/${classId}_spells/` +
    `${classId}_${type}_${ability.icon}.png`;
  return `<div class="abil-ico"><img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="sk-fallback" style="display:none">${ability.name.charAt(0)}</span></div>`;
}

export function renderSkillsView({
  document,
  classId,
  level,
  config,
  targetId = 'skillsBody',
}) {
  if (!classId || !CLASSES[classId]) return;
  const classData = classDataForJourney(classId,{
    smokeFree:usesSmokeFreeSkills(config),
  });
  const passiveHtml = classData.pas
    .map((ability) => {
      const active = level >= ability.lvl;
      return `<div class="abil ${active ? 'on' : 'off'}">
      ${detailedIcon(classId, ability, 'pas')}
      <div style="flex:1">
        <span class="lv" style="float:right">Nv ${ability.lvl}</span>
        <div class="an">${ability.name}${active ? ' · <span style="color:var(--ok);font-size:11px">activa</span>' : ''}</div>
        <div class="ad">${ability.d}</div>
      </div>
    </div>`;
    })
    .join('');
  const activeHtml = classData.act
    .map((ability) => {
      const active = level >= ability.lvl;
      return `<div class="abil ${active ? 'on' : 'off'}">
      ${detailedIcon(classId, ability, 'act')}
      <div style="flex:1">
        <span class="lv" style="float:right">Nv ${ability.lvl}</span>
        <div class="an">${ability.name}${ability.ulti ? ' <span style="color:var(--kodak);font-size:10px">ULTI</span>' : ''}</div>
        <div class="ad">${ability.d}</div>
        <div class="ad-cost">Coste: ${ability.cost} 💧</div>
      </div>
    </div>`;
    })
    .join('');
  const target=document.getElementById(targetId);
  if(!target) return;
  target.innerHTML = `
    <div class="grim-cls-tag" style="margin-top:0">Hechizos — ${classData.es}</div>
    ${activeHtml}
    <div class="grim-cls-tag">Pasivas — ${classData.es}</div>
    ${passiveHtml}`;
}
