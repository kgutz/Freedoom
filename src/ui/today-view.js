import { CLASSES } from '../data/game-data.js';
import {
  DAY_NAMES,
  MONTH_NAMES,
  daysBetween,
  keyOf,
  minutesOf,
} from '../domain/date-utils.js';
import { limitForWeek, weekIndexFor, weekRangeFor } from '../domain/plan-rules.js';
import {
  DEFAULT_DAY_START_TIME,
  logicalClockMinutes,
  logicalTimeMinutes,
} from '../domain/day-boundary-rules.js';
import {
  isSmokeFreeMode,
  isControlledMode,
  isControlledSmokingDay,
  controlledDaysOf,
  controlledWeeklyLimitOf,
  smokeFreeStatusOf,
} from '../domain/journey-mode-rules.js';
import { parseKey } from '../domain/date-utils.js';

const EMPTY_DAY = { c: 0, p: 0 };

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMinutes(value) {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function createPaceModel({ now, smoked, limit, config, record }) {
  const dayStartTime = config.dayStartTime || DEFAULT_DAY_START_TIME;
  const wake = logicalClockMinutes(
    minutesOf(record.w || config.wakeTime || '09:00'),
    dayStartTime,
  );
  const sleep = logicalClockMinutes(
    minutesOf(config.sleepTime || '23:00'),
    dayStartTime,
  );
  const awakeMinutes = Math.max(60, sleep - wake);
  const nowMinutes = logicalTimeMinutes(now, dayStartTime);
  const fraction = clamp((nowMinutes - wake) / awakeMinutes, 0, 1);
  const expected = limit * fraction;
  const smokedPercent = Math.min(
    100,
    limit > 0 ? (smoked / limit) * 100 : 100,
  );

  let statusClass;
  let status;
  if (limit <= 0) {
    statusClass = 'r';
    status = 'Semana de 0';
  } else if (nowMinutes < wake) {
    if (smoked === 0) {
      statusClass = 'g';
      status = 'Tu día aún no empieza';
    } else {
      statusClass = 'o';
      status = 'Antes de hora';
    }
  } else if (smoked >= limit) {
    statusClass = 'r';
    status = smoked > limit ? 'Límite superado' : 'Límite alcanzado';
  } else if (smoked === 1) {
    statusClass = 'g';
    status = 'Vas bien';
  } else {
    const ratio = expected > 0.3 ? smoked / expected : smoked <= 1 ? 0 : 2;
    if (ratio <= 1) {
      statusClass = 'g';
      status = 'Vas bien';
    } else if (ratio <= 1.25) {
      statusClass = 'y';
      status = 'Un poco por encima';
    } else if (ratio <= 1.55) {
      statusClass = 'o';
      status = 'Vas rápido';
    } else {
      statusClass = 'r';
      status = 'Vas muy rápido';
    }
  }

  const minutesPerCigarette = Math.round(
    awakeMinutes / Math.max(1, limit),
  );
  const roundedExpected = Math.round(expected);
  let differenceText = '';
  if (nowMinutes >= wake && nowMinutes <= sleep && limit > 0) {
    const difference = smoked - roundedExpected;
    if (difference < 0) {
      differenceText = ` · vas <b>${-difference}</b> por debajo <span class="pace-check">✓</span>`;
    } else if (difference === 0) {
      differenceText = ' · justo en el ritmo';
    } else {
      differenceText = ` · vas <b>${difference}</b> por encima`;
    }
  }

  const left = limit - smoked;
  let nextLine = '';
  if (left <= 0) {
    nextLine = 'Límite de hoy completo — el siguiente, mañana';
  } else if (record.t) {
    const lastSmoke = new Date(record.t);
    const lastMinutes = logicalTimeMinutes(lastSmoke, dayStartTime);
    const remainingWindow = sleep - lastMinutes;
    const editableLast =
      `<span class="edit-time" data-edit-time="1">` +
      `${formatMinutes(lastMinutes)}</span>`;
    if (remainingWindow > 0) {
      const interval = Math.max(10, Math.round(remainingWindow / left));
      const nextMinutes = lastMinutes + interval;
      if (nextMinutes <= nowMinutes) {
        nextLine = `Último: ${editableLast} · ya podría tocar el siguiente — tú decides`;
      } else {
        nextLine = `Último: ${editableLast} · el siguiente aprox. a las <b>~${formatMinutes(nextMinutes)}</b>`;
      }
    } else {
      nextLine = `Último: ${editableLast} — ya fuera de tu horario, el siguiente mañana`;
    }
  }

  return {
    expectedPercent: fraction * 100,
    smokedPercent,
    gradientWidth: smokedPercent > 0 ? (100 / smokedPercent) * 100 : 100,
    statusClass,
    status,
    info:
      `Ritmo objetivo: <b>1</b> cada <b><span class="pace-approx">~</span>&nbsp;${minutesPerCigarette} min</b>` +
      `<br>A esta hora tocarían <b><span class="pace-approx">~</span>&nbsp;${roundedExpected}</b>${differenceText}` +
      (nextLine ? `<br>${nextLine}` : ''),
  };
}

export function createTodayModel({
  now,
  config,
  days,
  game,
  stats,
  intoxication,
  currentDate = now,
}) {
  const today = keyOf(currentDate);
  const record = days[today] || EMPTY_DAY;
  const smokeFreeMode = isSmokeFreeMode(config);
  const controlledMode = isControlledMode(config);
  const weekIndex = Math.max(0, weekIndexFor(config.startDate, currentDate));
  const [weekStart, weekEnd] = weekRangeFor(config.startDate, weekIndex);
  let controlledWeekUsed = 0;
  for (
    let date = new Date(weekStart);
    date <= weekEnd;
    date.setDate(date.getDate() + 1)
  ) {
    controlledWeekUsed += Math.max(0, days[keyOf(date)]?.c || 0);
  }
  const limit = limitForWeek(config.startLimit, weekIndex);
  const abbreviatedDay = DAY_NAMES[currentDate.getDay()].slice(0, 3);
  const abbreviatedMonth = MONTH_NAMES[currentDate.getMonth()].slice(0, 3);
  const dateLabel =
    `${abbreviatedDay.charAt(0).toUpperCase()}${abbreviatedDay.slice(1)}, ` +
    `${currentDate.getDate()}/${abbreviatedMonth.charAt(0).toUpperCase()}${abbreviatedMonth.slice(1)}`;

  let hero = null;
  if (game?.cls && CLASSES[game.cls] && stats) {
    const hp = Math.max(0, Math.round(game.hp));
    const hpPercent = clamp((hp / stats.maxHp) * 100, 0, 100);
    let hpClass = 'hp-hi';
    if (hpPercent <= 15) hpClass = 'hp-crit';
    else if (hpPercent <= 40) hpClass = 'hp-low';
    else if (hpPercent <= 70) hpClass = 'hp-mid';
    hero = {
      classId: game.cls,
      name: game.name || CLASSES[game.cls].es,
      className: CLASSES[game.cls].name,
      hp,
      maxHp: stats.maxHp,
      hpPercent,
      hpClass,
    };
  }

  return {
    dateLabel,
    smokeFreeMode,
    controlledMode,
    controlledAllowedToday: isControlledSmokingDay(config, currentDate),
    controlledWeekUsed,
    controlledWeeklyLimit: controlledWeeklyLimitOf(config),
    controlledDays: controlledDaysOf(config),
    smokeFreeStatus: smokeFreeStatusOf(record),
    journeyDay: Math.max(
      1,
      daysBetween(parseKey(config.startDate), currentDate) + 1,
    ),
    weekNumber: weekIndex + 1,
    limit,
    record,
    hero,
    frameCount: Math.max(limit, record.c, 1),
    remaining: limit - record.c,
    pace: createPaceModel({
      now,
      smoked: record.c,
      limit,
      config,
      record,
    }),
    intoxication,
    wakeTime: record.w || config.wakeTime || '09:00',
    wakeEstimated: Boolean(record.we),
  };
}

export function renderTodayView({
  document,
  now,
  config,
  days,
  game,
  stats,
  intoxication,
  currentDate = now,
}) {
  const model = createTodayModel({
    now,
    config,
    days,
    game,
    stats,
    intoxication,
    currentDate,
  });
  const pillCard = document.getElementById('pillCard');
  if (pillCard) pillCard.style.display = config.takesPills === false ? 'none' : '';
  const beerCounter = document.getElementById('beerCounter');
  if (beerCounter) {
    beerCounter.style.display = config.tracksBeer === false ? 'none' : '';
  }

  document.getElementById('fechaHoy').textContent = model.dateLabel;
  document.getElementById('semanaNum').textContent = model.weekNumber;
  const maxLine = document.querySelector('.semana-tag .max-line');
  if (maxLine) {
    maxLine.style.display = model.smokeFreeMode ? 'none' : '';
    maxLine.innerHTML = model.controlledMode
      ? `máx <b>${model.controlledWeeklyLimit}</b>/semana`
      : `máx <b id="limiteDia">${model.limit}</b>/día`;
  }
  const limitElement = document.getElementById('limiteDia');
  if (limitElement) limitElement.textContent = model.limit;
  const cigaretteCounter = document.getElementById('cigCounter');
  const reductionProgress = document.getElementById('reductionProgress');
  const smokeFreeCounter = document.getElementById('smokeFreeCounter');
  const showDailyConfirmation =
    model.smokeFreeMode ||
    (model.controlledMode && !model.controlledAllowedToday);
  if (cigaretteCounter) {
    cigaretteCounter.style.display =
      model.smokeFreeMode ||
      (model.controlledMode && !model.controlledAllowedToday)
        ? 'none'
        : '';
    const label = cigaretteCounter.querySelector('.pc-label');
    if (label) label.textContent = 'Cigarros hoy';
  }
  if (reductionProgress) {
    reductionProgress.style.display =
      model.smokeFreeMode || model.controlledMode ? 'none' : '';
  }
  if (smokeFreeCounter) {
    smokeFreeCounter.style.display = showDailyConfirmation ? '' : 'none';
    document.getElementById('smokeFreeJourneyDay').textContent =
      model.controlledMode
        ? 'Hoy no es un día permitido'
        : `Día ${model.journeyDay} de tu camino`;
    const statusCopy = {
      pending: ['Día en curso', 'Cuando termine tu día, registra cómo ha ido.'],
      success: ['Te mantuviste sin fumar', '✓ Este día ya golpea al jefe.'],
      smoked: ['Hoy fumaste', 'Puedes corregirlo antes del cambio de día.'],
    }[model.smokeFreeStatus];
    document.getElementById('smokeFreeStatusTitle').textContent = statusCopy[0];
    document.getElementById('smokeFreeStatusNote').textContent = statusCopy[1];
    const successButton = smokeFreeCounter.querySelector(
      '[data-smoke-free-status="success"]',
    );
    if (successButton) {
      successButton.textContent = model.controlledMode
        ? '✓ Hoy no fumé'
        : '✓ Me mantuve sin fumar';
    }
    smokeFreeCounter.dataset.status = model.smokeFreeStatus;
    smokeFreeCounter.querySelectorAll('[data-smoke-free-status]').forEach(
      (button) => {
        button.classList.toggle(
          'active',
          button.dataset.smokeFreeStatus === model.smokeFreeStatus,
        );
      },
    );
  }
  const controlledSummary = document.getElementById('controlledSummary');
  if (controlledSummary) {
    controlledSummary.style.display = model.controlledMode ? '' : 'none';
    document.getElementById('controlledWeekUsed').textContent =
      model.controlledWeekUsed;
    document.getElementById('controlledWeekLimit').textContent =
      model.controlledWeeklyLimit;
    const dayNames = model.controlledDays
      .map((day) => DAY_NAMES[day].toLowerCase())
      .join(', ');
    document.getElementById('controlledDaysLabel').textContent =
      `Días permitidos: ${dayNames} · cambian a las 00:00`;
    controlledSummary.classList.toggle(
      'over',
      model.controlledWeekUsed > model.controlledWeeklyLimit,
    );
  }
  document.getElementById('cigHoy').textContent = model.record.c;
  document.getElementById('pillHoy').textContent = model.record.p;
  document.getElementById('beerHoy').textContent = model.record.b || 0;
  const wakeInput = document.getElementById('todayWakeInput');
  if (wakeInput) wakeInput.value = model.wakeTime;
  const beerStatus = document.getElementById('beerStatus');
  if (beerStatus) {
    const level = model.intoxication?.level || 0;
    beerStatus.style.display = level > 0 ? 'block' : 'none';
    if (level > 0) {
      document.getElementById('beerDrunkPercent').textContent = `${level}%`;
      document.getElementById('beerDrunkFill').style.width = `${level}%`;
      document.getElementById('beerDrunkInfo').textContent =
        `Fallo de activas ${level}% · pasivas −${level}% · ` +
        `sobrio en ~${model.intoxication.remainingMinutes} min`;
    }
  }

  if (model.hero) {
    const heroBackground = document.getElementById('hoyHeroBg');
    heroBackground.style.display = '';
    heroBackground.onerror = () => {
      heroBackground.style.display = 'none';
    };
    heroBackground.src =
      `hero_background/${model.hero.classId}_today_bg.png`;
    document.getElementById('hoyHeroName').textContent = model.hero.name;
    document.getElementById('hoyHeroCls').textContent = model.hero.className;
    document.getElementById('hoyFace').innerHTML =
      `<img src="hero_face/${model.hero.classId}_face.png" alt="" ` +
      `onerror="this.onerror=null;this.src='sprites/${model.hero.classId}_happy.png';this.className='face-full'">`;
    const fill = document.getElementById('hoyHpFill');
    fill.style.width = `${model.hero.hpPercent}%`;
    fill.className = `stat-fill ${model.hero.hpClass}`;
    document.getElementById('hoyHpVal').textContent =
      `${model.hero.hp} / ${model.hero.maxHp}`;
  }

  document.getElementById('hoyTotal').textContent = model.record.c;
  document.getElementById('hoyLimite').textContent = model.limit;

  const strip = document.getElementById('filmstrip');
  strip.innerHTML = '';
  for (let index = 0; index < model.frameCount; index += 1) {
    const frame = document.createElement('div');
    frame.className =
      'frame' +
      (index < model.record.c
        ? index < model.limit
          ? ' used'
          : ' over'
        : '');
    strip.appendChild(frame);
  }

  document.getElementById('paceExpected').style.width =
    `${model.pace.expectedPercent}%`;
  document.getElementById('paceClip').style.width =
    `${model.pace.smokedPercent}%`;
  document.getElementById('paceGrad').style.width =
    `${model.pace.gradientWidth}%`;
  const status = document.getElementById('paceEstado');
  status.className = `estado ${model.pace.statusClass}`;
  status.textContent = model.pace.status;
  document.getElementById('paceInfo').innerHTML = model.pace.info;

  const remaining = document.getElementById('restantes');
  if (model.remaining >= 0) {
    remaining.className = 'restantes';
    remaining.innerHTML =
      `Llevas <b>${model.record.c}</b> de un máximo de <b>${model.limit}</b>` +
      ` — te quedan <b>${model.remaining}</b>`;
  } else {
    remaining.className = 'restantes excedido';
    remaining.innerHTML =
      `Hoy te has pasado <b>${-model.remaining}</b> del máximo de ${model.limit}` +
      ' — mañana empiezas de cero';
  }
}
