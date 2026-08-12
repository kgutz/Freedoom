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
import { inventoryAccessMarkup } from './inventory-view.js';

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
  const chips = [];
  if (buffs.shield > 0) chips.push(`🛡×${buffs.shield}`);
  if (buffs.certeroUntil > nowTimestamp) {
    chips.push(`🎯 ${Math.ceil((buffs.certeroUntil - nowTimestamp) / 60_000)}m`);
  }
  if (buffs.habitFocusCharges > 0) {
    chips.push(`🎯×${buffs.habitFocusCharges} hábitos`);
  }
  if (buffs.cenizaUntil > nowTimestamp) {
    chips.push(`☠ ${Math.ceil((buffs.cenizaUntil - nowTimestamp) / 60_000)}m`);
  }
  if (buffs.regenUntil > nowTimestamp) {
    chips.push(`🌿 ${Math.ceil((buffs.regenUntil - nowTimestamp) / 60_000)}m`);
  }
  if (buffs.pesteDay === today) chips.push('☠🍺 hoy');
  if ((game.pestXpDays || []).includes(today)) chips.push('☠ +20 XP hoy');
  if (buffs.bastion) chips.push('🏰 armado');
  if (buffs.renacer) chips.push('🌅 esta noche');
  if ((game.judgmentDays || []).includes(today)) chips.push('⚖️ hoy');
  if (intoxication?.level > 0) {
    chips.push(
      `🍺 ${intoxication.level}% · ${intoxication.remainingMinutes}m`,
    );
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
    chips,
    stats,
    boss,
    armor,
    perfectToday: todayRecord.s || 0,
    intoxication,
  };
}

function skillIcon(classId, level, ability, type) {
  const active = level >= ability.lvl;
  const ultimateClass = ability.ulti ? ' ulti' : '';
  const source =
    `spells/${classId}_spells/` +
    `${classId}_${type}_${ability.icon}.png`;
  const fallback = ability.name.charAt(0);
  const attributes =
    type === 'act'
      ? `data-cast="${ability.id}"`
      : `data-pas-name="${ability.name}" data-pas-lvl="${ability.lvl}"`;
  return `<div class="skill-box ${active ? 'on' : 'off'}${ultimateClass}" ${attributes}>
      <span class="sk-lv">Nv ${ability.lvl}</span>
      <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="sk-fallback" style="display:none">${fallback}</span>
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
          return `<div class="cls-card" data-cls="${classId}">
        ${spriteImage(classId, 'happy')}
        <div class="cn">${classData.name}</div>
        <div class="ce">${classData.es}</div>
        <div class="cd">${classData.desc}</div>
      </div>`;
        },
      )
      .join('');
    box.innerHTML = `<div class="card">
      <h2>Elige tu clase</h2>
      <p class="hint" style="margin:0 0 14px">Tu héroe vive de tus datos: gana XP cada día que cumples, sube de nivel, y su salud refleja cómo llevas el día de hoy. Elige con cabeza — el camino son 21 semanas.</p>
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
  const chipsHtml = model.chips.length
    ? `<div class="buff-row">${model.chips.map((chip) => `<span class="buff">${chip}</span>`).join('')}</div>`
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
    .map((ability) => skillIcon(classId, heroStats.lvl, ability, 'act'))
    .join('');
  const auraClass = heroStats.tier > 0 ? `t${heroStats.tier + 1}` : '';
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
  const bossMedals = Array.from({ length: totalBosses }, (_, index) => {
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
          <h4>Medallones de victoria · ${defeatedBosses} / ${totalBosses}</h4>
          <p>Cada jefe derrotado revela su medallón. Los rivales que todavía te esperan permanecen ocultos.</p>
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
        <div class="sprite-box"><img class="sprite-bg" src="hero_background/${classId}_bg.png" alt=""><div class="sprite-aura ${auraClass}"></div>${spriteImage(classId, model.mood)}${sleeping}</div>
        <div class="hero-id">
          <div class="hero-rank-row">
            <div class="rango">${classData.name}</div>
            <button class="hero-skills-jump" type="button" data-scroll-skills aria-label="Ir a habilidades" title="Ir a habilidades">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5h5.25A2.75 2.75 0 0 1 12 7.25V20a3.5 3.5 0 0 0-3.5-3.5H4V4.5Zm16 0h-5.25A2.75 2.75 0 0 0 12 7.25V20a3.5 3.5 0 0 1 3.5-3.5H20V4.5Z"/></svg>
            </button>
          </div>
          <div class="nombre">${game?.name || classData.name}</div>
          <div class="nivel">Nivel ${heroStats.lvl}</div>
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

    ${inventoryAccessMarkup(lootState || {})}

    <div class="card">
      <div class="boss-top">
        <div class="boss-box">
          <img src="bosses/boss_${String(bossState.bossNum).padStart(2, '0')}_${bossState.slug}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <span class="boss-fallback" style="display:none">💀</span>
        </div>
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
      <div class="boss-count">Jefes derrotados: <b>${defeatedBosses}</b> de <b>${totalBosses}</b> · quedan <b>${remainingBosses}</b> por delante</div>
    </div>

    <div class="card hero-skills-card" id="heroSkillsCard">
      <div class="skills-head">
        <h2 id="heroSkillsTitle" tabindex="-1" style="margin:0">Habilidades</h2>
        <button class="sk-info-btn" id="skInfoBtn" aria-label="Ver libro de habilidades">ⓘ</button>
      </div>
      <div class="sk-row-label">Pasivas</div>
      <div class="skill-row">${passiveIcons}</div>
      <div class="sk-row-label acts">Activas</div>
      <div class="skill-row">${activeIcons}</div>
    </div>`;
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
  intoxication,
  config,
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
  document.getElementById('skillsBody').innerHTML = `
    ${
      intoxication?.level > 0
        ? `<div class="drunk-warning">🍺 Borrachera ${intoxication.level}% · las pasivas tienen −${intoxication.level}% de potencia y las activas ${intoxication.level}% de fallo.</div>`
        : ''
    }
    <div class="grim-cls-tag" style="margin-top:0">Pasivas — ${classData.es}</div>
    ${passiveHtml}
    <div class="grim-cls-tag">Hechizos — ${classData.es}</div>
    ${activeHtml}`;
}
