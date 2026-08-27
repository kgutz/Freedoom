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
import { weekIndexFor } from '../domain/plan-rules.js';
import { intoxicationStage } from '../domain/intoxication-rules.js';
import {
  levelEightSpellAvailability,
  levelTwoSpellAvailability,
  ultimateSpellAvailability,
} from '../domain/spell-rules.js';
import { heroSpriteSource } from '../data/outfit-data.js';
import { heroBackgroundSource } from '../data/frame-data.js';
import { resourceValue } from './inventory-view.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function spriteImage(classId, mood, extraClass = '', outfitId = 'original') {
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
  const outfitClass = outfitId !== 'original'
    ? ` sprite-svg--outfit-${outfitId} sprite-svg--${classId}`
    : '';
  return `<img class="sprite-svg${hurt}${outfitClass} ${extraClass}" src="${heroSpriteSource(classId, file, outfitId)}" alt="${classId}" draggable="false">`;
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

export function heroVisualMarkup({
  classId,
  mood = 'happy',
  outfitId = 'original',
  frameId = 'original',
  game = {},
  progress = 0,
  level = 1,
  levelUp = false,
  intoxication = null,
  interactive = true,
} = {}) {
  const energy = heroEnergyModel({ progress, level, classId, levelUp });
  const energyView = heroEnergyMarkup(energy);
  const intoxicated = Number(intoxication?.level) > 0;
  const intoxicationStageValue = intoxicated ? intoxicationStage(intoxication) : 0;
  const intoxicationParticles = intoxicated
    ? `<span class="hero-intoxication-particles hero-intoxication-particles--stage-${intoxicationStageValue}" aria-hidden="true">
        ${Array.from({ length: 8 }, (_, index) => `<i class="hero-intoxication-particle p${index + 1}"></i>`).join('')}
      </span>`
    : '';
  const sleeping = mood === 'sleep' ? '<span class="sprite-zzz">z z</span>' : '';
  const interaction = interactive
    ? ` data-open-character-sheet data-xp-progress="${energy.percent}" data-xp-energy="${energy.energyPercent}" role="button" tabindex="0" aria-label="Abrir ficha de personaje"`
    : ' aria-label="Vista animada del héroe"';
  return `<div class="sprite-box ${energyView.classes}${intoxicated ? ` sprite-box--intoxicated intoxication-stage-${intoxicationStageValue}` : ''}" style="${energyView.style}"${interaction}>
    <img class="sprite-bg" src="${heroBackgroundSource(frameId, classId, 'hero', game)}" alt="">
    ${energyView.markup}
    ${spriteImage(classId, mood, '', outfitId)}
    ${sleeping}${intoxicationParticles}
  </div>`;
}

export function heroIntoxicationBadgeMarkup(intoxication, extraClass = '') {
  if (!(Number(intoxication?.level) > 0)) return '';
  const minutes = Math.max(1, Math.ceil(Number(intoxication?.remainingMinutes) || 0));
  return `<span class="hero-intoxication-badge${extraClass ? ` ${extraClass}` : ''}" title="Borrachera: ${minutes} minutos restantes" aria-label="Borrachera: ${minutes} minutos restantes">
    <img src="spells/effect_icons/beer_effect_intoxication.png" alt="">
    <b>${minutes} min</b>
  </span>`;
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
  const skillEffects = [];
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
  const powers = game?.powerProgress || {};
  if (powers.ultimateChallenge?.spellId === spellId) {
    const ultimate = powers.ultimateChallenge;
    const completed = ultimate.completedIds?.length || 0;
    return ultimate.day === today && !ultimate.rewarded
      ? `${completed}/${ultimate.habitIds?.length || 3}`
      : null;
  }
  if (powers.habitChallenge?.spellId === spellId) {
    const challenge = powers.habitChallenge;
    const completed = challenge.completedIds?.length || 0;
    const target = challenge.autoNextHabitCount || challenge.habitIds?.length || 2;
    if (challenge.day === today && completed < target) {
      return `${completed}/${target}`;
    }
  }
  const levelEightUse = levelEightSpellAvailability({ game, spellId, today, nowTimestamp });
  if (levelEightUse.count === 1 && levelEightUse.cooldownRemainingMs > 0) {
    return `${Math.max(1, Math.ceil(levelEightUse.cooldownRemainingMs / 1000))}s`;
  }
  if (spellId === 'ceniza') return remainingMinutesLabel(buffs.cenizaUntil, nowTimestamp);
  if (spellId === 'regen') return remainingMinutesLabel(buffs.regenUntil, nowTimestamp);
  if (spellId === 'balsamo') return remainingMinutesLabel(buffs.balm?.until, nowTimestamp);
  if (spellId === 'certero') {
    if (smokeFreeMode) return buffs.habitFocusCharges > 0 ? `×${buffs.habitFocusCharges}` : null;
    return remainingMinutesLabel(buffs.certeroUntil, nowTimestamp);
  }
  if (spellId === 'muro') return buffs.shield > 0 ? `×${buffs.shield}` : null;
  if (spellId === 'renacer') {
    if (powers.rebirthHabit && !powers.rebirthHabit.completed) return `${powers.rebirthHabit.progress || 0}/3`;
    return buffs.renacer ? 'HOY' : null;
  }
  if (spellId === 'juicio') {
    if (powers.judgment && !powers.judgment.rewarded) return `${powers.judgment.completedIds?.length || 0}/${powers.judgment.habitIds?.length || 2}`;
    return (game?.judgmentDays || []).includes(today) ? 'HOY' : null;
  }
  if (spellId === 'alma' && powers.soulWager && !powers.soulWager.completed) return '24H';
  return null;
}

export function spellUnavailableAfterUse({ ability, game, currentWeek, today }) {
  if (ability?.ulti) return ability.modern
    ? ultimateSpellAvailability({ game, currentWeek, today }).exhausted
    : game?.ultiW === currentWeek;
  if (ability?.lvl !== 8) return false;
  return levelEightSpellAvailability({ game, spellId: ability.id, today }).exhausted;
}

export function cooldownStatusLabel(remainingMs = 0) {
  const safeMs = Math.max(0, Number(remainingMs) || 0);
  if (safeMs < 60_000) return `${Math.max(1, Math.ceil(safeMs / 1000))}s`;
  if (safeMs < 3_600_000) return `${Math.ceil(safeMs / 60_000)}m`;
  return `${Math.ceil(safeMs / 3_600_000)}h`;
}

export function nextLogicalDayStart(now = new Date(), dayStartTime = '04:00') {
  const [hours, minutes] = String(dayStartTime).split(':').map(Number);
  const next = new Date(now);
  next.setHours(Number.isFinite(hours) ? hours : 4, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

function skillIcon(classId, level, ability, type, status = null, used = false, cooldown = false, cooldownUntil = 0) {
  const active = level >= ability.lvl;
  const ultimateClass = ability.ulti ? ' ulti' : '';
  const statusClass = status && !cooldown ? ' spell-effect-active' : '';
  const usedClass = used ? ' spell-week-used' : '';
  const cooldownClass = cooldown ? ' spell-cooldown' : '';
  const passiveActiveClass = type === 'pas' && active ? ' passive-effect-active' : '';
  const source =
    `spells/${classId}_spells/` +
    `${classId}_${type}_${ability.icon}.png`;
  const fallback = ability.name.charAt(0);
  const attributes =
    type === 'act'
      ? `data-cast="${ability.id}"`
      : `data-pas-name="${ability.name}" data-pas-lvl="${ability.lvl}"`;
  return `<div class="skill-box ${active ? 'on' : 'off'}${ultimateClass}${statusClass}${usedClass}${cooldownClass}${passiveActiveClass}" ${attributes}${cooldown ? ' aria-disabled="true"' : ''}>
      <span class="sk-lv">Nv ${ability.lvl}</span>
      <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="sk-fallback" style="display:none">${fallback}</span>
      ${status ? `<span class="skill-active-timer${cooldown ? ' skill-cooldown-timer' : ''}"${cooldownUntil ? ` data-cooldown-until="${cooldownUntil}"` : ''} aria-label="${cooldown ? 'Enfriamiento' : 'Efecto activo'}: ${status}">${status}</span>` : ''}
      ${used ? `<span class="skill-used-label" aria-label="Habilidad usada">${ability.ulti ? 'USADA' : 'USADA HOY'}</span>` : ''}
    </div>`;
}

function quickSkillIcon(classId, level, ability, status = null, used = false, cooldown = false, cooldownUntil = 0) {
  const unlocked = level >= ability.lvl;
  const source = `spells/${classId}_spells/${classId}_act_${ability.icon}.png`;
  return `<button type="button" class="hero-skill-slot${unlocked ? ' on' : ' off'}${status && !cooldown ? ' spell-effect-active' : ''}${used ? ' spell-week-used' : ''}${cooldown ? ' spell-cooldown' : ''}" data-cast="${ability.id}" aria-label="${ability.name}${unlocked ? '' : ` · Nivel ${ability.lvl} necesario`}${used ? (ability.ulti ? ' · Usada dos veces esta semana' : ' · Usada hoy') : ''}${cooldown ? ` · Enfriamiento ${status}` : ''}" title="${ability.name}"${cooldown ? ' disabled' : ''}>
    <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="hero-skill-fallback" style="display:none">${ability.name.charAt(0)}</span>
    ${status ? `<span class="skill-active-timer hero-skill-timer${cooldown ? ' skill-cooldown-timer' : ''}"${cooldownUntil ? ` data-cooldown-until="${cooldownUntil}"` : ''} aria-label="${cooldown ? 'Enfriamiento' : 'Efecto activo'}: ${status}">${status}</span>` : ''}
    ${used ? `<span class="skill-used-label hero-skill-used">${ability.ulti ? 'USADA' : 'HOY'}</span>` : ''}
  </button>`;
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
  huntEnergy = 0,
  huntEnergyMax = 5,
  huntEnergyBonus = 0,
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
  const visibleSkillEffects = model.skillEffects.filter((effect) => effect.kind !== 'intoxication');
  const skillEffectsHtml = visibleSkillEffects
    .map((effect) => {
      const source = `spells/effect_icons/${classId}_effect_${effect.spellId}.png`;
      const effectLabel = `${effect.name}: ${effect.remaining} restantes`;
      return `<span class="skill-buff" aria-label="${effectLabel}">
      <span class="skill-buff-icon">
        <img src="${source}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <span class="sk-fallback" style="display:none">${effect.name.charAt(0)}</span>
      </span>
      <b>${effect.remaining}</b>
    </span>`;
    })
    .join('');
  const potionActive=lootState?.inventory?.potions?.active;
  const potionRemaining=potionActive?.endsAt>now.getTime()
    ? `${Math.max(1,Math.ceil((potionActive.endsAt-now.getTime())/60000))}m`
    : '';
  const potionEffectHtml=potionRemaining&&['fortune','experience'].includes(potionActive.id)
    ? `<span class="skill-buff skill-buff--potion" aria-label="Poción de ${potionActive.id==='fortune'?'Fortuna':'Experiencia'}: ${potionRemaining} restantes"><span class="skill-buff-icon skill-buff-icon--potion"><img src="potions/potion_${potionActive.id}.png" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="sk-fallback" style="display:none">${potionActive.id==='fortune'?'¤':'✦'}</span></span><b>${potionRemaining}</b></span>`
    : '';
  const visibleEffectCount=visibleSkillEffects.length+(potionEffectHtml?1:0);
  const chipsHtml = skillEffectsHtml||potionEffectHtml
    ? `<div class="buff-row${visibleEffectCount>2?' buff-row--compact':''}">${skillEffectsHtml}${potionEffectHtml}</div>`
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
  const currentWeek = config.startDate
    ? Math.max(0, weekIndexFor(config.startDate, now))
    : 0;
  const abilityUiState = (ability) => {
    const today = dayKey || keyOf(now);
    const levelEightAvailability = ability.lvl === 8 && !ability.ulti
      ? levelEightSpellAvailability({ game, spellId: ability.id, today, nowTimestamp: now.getTime() })
      : null;
    const levelTwoAvailability = ability.lvl === 2 && !ability.ulti
      ? levelTwoSpellAvailability({ game, spellId: ability.id, nowTimestamp: now.getTime() })
      : null;
    let cooldownUntil = 0;
    if (levelTwoAvailability?.cooldownRemainingMs > 0) {
      cooldownUntil = levelTwoAvailability.cooldownUntil;
    } else if (levelEightAvailability?.exhausted) {
      cooldownUntil = nextLogicalDayStart(now, config.dayStartTime || '04:00');
    } else if (levelEightAvailability?.cooldownRemainingMs > 0) {
      cooldownUntil = levelEightAvailability.cooldownUntil;
    }
    const cooldown = cooldownUntil > now.getTime();
    const status = cooldown
      ? cooldownStatusLabel(cooldownUntil - now.getTime())
      : activeSpellStatus({
        spellId: ability.id,
        game,
        nowTimestamp: now.getTime(),
        today,
        smokeFreeMode: usesSmokeFreeSkills(config),
      });
    return {
      status,
      cooldown,
      cooldownUntil,
      used: !cooldown && !status && spellUnavailableAfterUse({ ability, game, currentWeek, today }),
    };
  };
  const activeIcons = classData.act
    .map((ability) => {
      const ui = abilityUiState(ability);
      return skillIcon(classId, heroStats.lvl, ability, 'act', ui.status, ui.used, ui.cooldown, ui.cooldownUntil);
    })
    .join('');
  const quickActiveIcons = classData.act
    .map((ability) => {
      const ui = abilityUiState(ability);
      return quickSkillIcon(classId, heroStats.lvl, ability, ui.status, ui.used, ui.cooldown, ui.cooldownUntil);
    })
    .join('');
  const futureActiveIcons = Array.from({ length: Math.max(0, 6 - classData.act.length) }, (_, index) =>
    `<button type="button" class="hero-skill-slot future" data-future-skill aria-label="Habilidad futura ${index + 1}" title="Próximamente">?</button>`,
  ).join('');
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
      <div class="hero-top${chipsHtml ? ' hero-top--with-effects' : ''}">
        <div class="hero-visual-column">
          ${heroVisualMarkup({classId,mood:model.mood,outfitId:game?.outfit,frameId:game?.frame,game,progress:heroStats.prog,level:heroStats.lvl,levelUp,intoxication:model.intoxication})}
          ${chipsHtml ? `<div class="hero-visual-effects">${chipsHtml}</div>` : ''}
        </div>
        <div class="hero-id">
          <div class="hero-rank-row">
            <div class="rango">${classData.name}</div>
            <button class="hero-hunt-energy-shortcut" type="button" data-open-hunt-from-hero aria-label="Energía de Cacería: ${Math.max(0, huntEnergy - huntEnergyBonus)} de ${huntEnergyMax}${huntEnergyBonus ? `, más ${huntEnergyBonus} extra` : ''}. Abrir Cacería">
              <span class="resource-icon resource-icon--hunt-energy" aria-hidden="true"></span><b>${Math.max(0, huntEnergy - huntEnergyBonus)}/${huntEnergyMax}${huntEnergyBonus ? `<em>+${huntEnergyBonus}</em>` : ''}</b>
            </button>
          </div>
          <div class="nombre">${game?.name || classData.name}</div>
          <div class="nivel">Nivel ${heroStats.lvl}</div>
          <button class="hero-resource-wallet" type="button" data-open-inventory aria-label="Abrir inventario y forja">
            ${resourceValue('coin', lootState?.economy?.coins)}
            ${resourceValue('boss-blood', lootState?.economy?.bossBlood)}
            ${resourceValue('arcane-fiber', lootState?.economy?.arcaneFibers)}
          </button>
          <div class="hero-summary">
            <div class="hero-summary-primary">
              <span>Racha: <b>${heroStats.streak}</b> día${heroStats.streak === 1 ? '' : 's'}</span>
              <span>Armadura: <b>−${model.armor}</b></span>
            </div>
            ${smokeFreeMode ? '' : `<span class="hero-summary-perfect">Disparos perfectos hoy: <b>${model.perfectToday}</b></span>`}
          </div>
        </div>
      </div>
      <div class="stat-bar" data-hero-stat="hp">
        <div class="lbl"><span>SALUD</span><b>${model.hp} / ${heroStats.maxHp}</b></div>
        <div class="stat-track"><div class="stat-fill ${model.hpClass}" style="width:${model.hpPercent}%"></div></div>
      </div>
      <div class="stat-bar" data-hero-stat="mana">
        <div class="lbl"><span>MANÁ</span><b>${model.mana} / ${heroStats.maxMp}</b></div>
        <div class="stat-track"><div class="stat-fill mp" style="width:${model.manaPercent}%"></div></div>
      </div>
      <div class="stat-bar" data-hero-stat="xp">
        <div class="lbl"><span>EXPERIENCIA</span><b>${heroStats.xp} / ${heroStats.nextTh} XP</b></div>
        <div class="stat-track"><div class="stat-fill xp" style="width:${Math.round(heroStats.prog * 100)}%"></div></div>
      </div>
    </div>

    <div class="hero-skill-hotbar" aria-label="Habilidades activas rápidas">
      ${quickActiveIcons}${futureActiveIcons}
    </div>

    <div class="card" id="heroBossCard">
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
          <div class="boss-detail-content">
            <div class="boss-name">${bossState.name}<small>Seis días cumplidos garantizan la victoria</small></div>
            <div class="pips">${pips}</div>
          </div>
        </div>
      </div>
      <div class="boss-progress-summary">
        <div class="boss-hp-label">
          <span>${bossState.won ? 'DERROTADO' : 'VIDA DEL JEFE'}</span>
          <b>${bossState.hp} / ${bossState.maxHp} HP</b>
        </div>
        <div class="boss-hp-track"><div class="boss-hp-fill${bossState.won ? ' defeated' : ''}" style="width:${bossState.hpPercent}%"></div></div>
        <div class="boss-count">Derrotados: <b>${defeatedBosses}</b>${remainingBosses > 0 ? ' de <b>?</b> · ¡Aún quedan jefes por derrotar!' : ' · campaña completada'}</div>
      </div>
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
  const passiveDescription=(ability)=>{
    if(classId!=='druid'||ability.name!=='Poción Mayor') return ability.d;
    const pills=config?.takesPills!==false;
    const beer=config?.tracksBeer!==false;
    if(pills&&beer) return 'Completa todas tus pastillas y no bebas cerveza para ganar 1 de oro. Máximo 4 por semana.';
    if(pills) return 'Completa todas tus pastillas para ganar 1 de oro. Máximo 4 por semana.';
    if(beer) return 'No bebas cerveza para ganar 1 de oro. Máximo 4 por semana.';
    return 'Configura un objetivo de salud para activar esta pasiva.';
  };
  const passiveHtml = classData.pas
    .map((ability) => {
      const active = level >= ability.lvl;
      return `<div class="abil ${active ? 'on' : 'off'}">
      ${detailedIcon(classId, ability, 'pas')}
      <div style="flex:1">
        <span class="lv" style="float:right">Nv ${ability.lvl}</span>
        <div class="an">${ability.name}${active ? ' · <span style="color:var(--ok);font-size:11px">activa</span>' : ''}</div>
        <div class="ad">${passiveDescription(ability)}</div>
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
