import {
  DAY_NAMES,
  MONTH_NAMES,
  daysBetween,
  keyOf,
  parseKey,
} from '../domain/date-utils.js';
import { limitForDate, weekIndexFor, weekRangeFor } from '../domain/plan-rules.js';
import {
  SMOKE_FREE_STATUS_SMOKED,
  SMOKE_FREE_STATUS_SUCCESS,
  controlledWeeklyLimitOf,
  isControlledMode,
  isControlledSmokingDay,
  isSmokeFreeMode,
  journeyConfigForDate,
  smokeFreeStatusOf,
} from '../domain/journey-mode-rules.js';

const EMPTY_DAY = { c: 0 };

export function createChartModel({
  mode,
  weekIndex,
  month,
  now,
  config,
  records,
}) {
  const dates = [];
  const controlledUsage=(date,dateConfig)=>{
    const week=Math.max(0,weekIndexFor(config.startDate,date));
    const [first,last]=weekRangeFor(config.startDate,week);
    let used=0;
    for(let cursor=new Date(first);cursor<=last;cursor.setDate(cursor.getDate()+1)){
      if(isControlledSmokingDay(dateConfig,cursor)){
        used+=Math.max(0,(records[keyOf(cursor)]||EMPTY_DAY).c||0);
      }
    }
    return used;
  };
  let title = '';
  if (mode === 'semana') {
    const [firstDay, lastDay] = weekRangeFor(config.startDate, weekIndex);
    const formatDate = (date) =>
      `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
    title = `Semana ${weekIndex + 1} · ${formatDate(firstDay)} – ${formatDate(lastDay)}`;
    for (
      let date = new Date(firstDay);
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      dates.push(new Date(date));
    }
  } else {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    title = `${MONTH_NAMES[monthIndex]} ${year}`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      dates.push(new Date(year, monthIndex, day));
    }
  }

  const planStart = parseKey(config.startDate);
  const points = dates.map((date) => {
    const dayDistance = daysBetween(now, date);
    const past = dayDistance <= 0;
    const settled = dayDistance < 0;
    const isToday = dayDistance === 0;
    const tracked = past && daysBetween(planStart, date) >= 0;
    const dateConfig=journeyConfigForDate(config,date);
    const smokeFreeMode=isSmokeFreeMode(dateConfig);
    const controlledMode=isControlledMode(dateConfig);
    const controlledAllowed=isControlledSmokingDay(dateConfig,date);
    return {
      date,
      past,
      settled,
      isToday,
      tracked,
      cigarettes: (records[keyOf(date)] || EMPTY_DAY).c || 0,
      smokeFreeStatus: smokeFreeStatusOf(records[keyOf(date)] || EMPTY_DAY),
      smokeFreeMode,
      controlledMode,
      controlledAllowed,
      controlledBudgetExceeded:
        controlledMode &&
        controlledUsage(date,dateConfig) > controlledWeeklyLimitOf(dateConfig),
      limit: limitForDate({
        startDate: config.startDate,
        startLimit: config.startLimit,
        date,
      }),
    };
  });

  let yMax = 5;
  points.forEach((point) => {
    yMax = Math.max(
      yMax,
      point.cigarettes,
      point.controlledMode || point.smokeFreeMode ? 0 : point.limit,
    );
  });
  yMax = Math.ceil(yMax * 1.15);

  const trackedPoints = points.filter((point) => point.tracked);
  const settledTrackedPoints = trackedPoints.filter((point) => point.settled);
  let peak = null;
  let minimum = null;
  let total = 0;
  trackedPoints.forEach((point) => {
    total += point.cigarettes;
    if (!peak || point.cigarettes > peak.cigarettes) peak = point;
  });
  settledTrackedPoints.forEach((point) => {
    if (!minimum || point.cigarettes < minimum.cigarettes) minimum = point;
  });
  const smokeFreeDays = trackedPoints.filter(
    (point) => point.smokeFreeStatus === SMOKE_FREE_STATUS_SUCCESS,
  ).length;
  const smokedDays = trackedPoints.filter(
    (point) => point.smokeFreeStatus === SMOKE_FREE_STATUS_SMOKED,
  ).length;
  const decidedDays = smokeFreeDays + smokedDays;
  const journeyModes=new Set(
    trackedPoints.map((point)=>
      point.controlledMode?'controlled':point.smokeFreeMode?'smoke_free':'reduction',
    ),
  );
  const smokeFreeMode=journeyModes.size===1&&journeyModes.has('smoke_free');
  const controlledMode=journeyModes.size===1&&journeyModes.has('controlled');
  const disciplineMode=[...journeyModes].some((value)=>value!=='reduction');
  const completedDays=trackedPoints.filter((point)=>
    point.smokeFreeMode
      ? point.smokeFreeStatus===SMOKE_FREE_STATUS_SUCCESS
      : point.controlledMode
        ? point.controlledAllowed
          ? point.settled && !point.controlledBudgetExceeded
          : point.smokeFreeStatus===SMOKE_FREE_STATUS_SUCCESS
        : false,
  ).length;
  const failedDays=trackedPoints.filter((point)=>
    point.smokeFreeMode
      ? point.smokeFreeStatus===SMOKE_FREE_STATUS_SMOKED
      : point.controlledMode
        ? point.controlledAllowed
          ? point.controlledBudgetExceeded
          : point.smokeFreeStatus===SMOKE_FREE_STATUS_SMOKED
        : false,
  ).length;

  return {
    mode,
    title,
    points,
    yMax,
    peak,
    minimum,
    average: trackedPoints.length ? total / trackedPoints.length : null,
    smokeFreeMode,
    controlledMode,
    disciplineMode,
    completedDays,
    failedDays,
    smokeFreeDays,
    smokedDays,
    pendingDays: Math.max(0, trackedPoints.length - decidedDays),
    successRate: decidedDays ? (smokeFreeDays / decidedDays) * 100 : null,
  };
}

export function renderChartView({
  document,
  mode,
  weekIndex,
  month,
  now,
  config,
  records,
}) {
  const svg = document.getElementById('grafSvg');
  if (!svg) return;
  const model = createChartModel({
    mode,
    weekIndex,
    month,
    now,
    config,
    records,
  });
  document.getElementById('grafTitle').textContent = model.title;

  const left = 30;
  const right = 354;
  const top = 14;
  const bottom = 196;
  const xLabels = 222;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const slots = model.points.length;
  const slotWidth = plotWidth / slots;
  const barWidth = Math.max(4, Math.min(30, slotWidth * 0.62));
  const yOf = (value) => bottom - (value / model.yMax) * plotHeight;

  if (model.disciplineMode) {
    let content = `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#3A3229" stroke-width="0.8"/>`;
    model.points.forEach((point, index) => {
      const centerX = left + index * slotWidth + slotWidth / 2;
      if (point.tracked) {
        if (point.controlledMode && point.controlledAllowed) {
          if (point.controlledBudgetExceeded) {
            content += `<rect x="${centerX - barWidth / 2}" y="${bottom - 45}" width="${barWidth}" height="45" rx="3" fill="var(--warn)" opacity=".9"/>`;
            content += `<text x="${centerX}" y="${bottom - 51}" font-size="11" fill="var(--warn)" text-anchor="middle">×</text>`;
          } else if (point.cigarettes > 0) {
            content += `<rect x="${centerX - barWidth / 2}" y="${bottom - 70}" width="${barWidth}" height="70" rx="3" fill="var(--kodak)" opacity=".9"/>`;
            content += `<text x="${centerX}" y="${bottom - 76}" font-size="10" fill="var(--kodak)" text-anchor="middle">${point.cigarettes}</text>`;
          } else if (point.settled) {
            content += `<rect x="${centerX - barWidth / 2}" y="${top + 18}" width="${barWidth}" height="${plotHeight - 18}" rx="3" fill="var(--ok)" opacity=".9"/>`;
            content += `<text x="${centerX}" y="${top + 12}" font-size="11" fill="var(--ok)" text-anchor="middle">✓</text>`;
          } else {
            content += `<circle cx="${centerX}" cy="${bottom - 4}" r="2.5" fill="var(--kodak)" opacity=".7"/>`;
          }
        } else if (point.smokeFreeStatus === SMOKE_FREE_STATUS_SUCCESS) {
          content += `<rect x="${centerX - barWidth / 2}" y="${top + 18}" width="${barWidth}" height="${plotHeight - 18}" rx="3" fill="var(--ok)" opacity=".9"/>`;
          content += `<text x="${centerX}" y="${top + 12}" font-size="11" fill="var(--ok)" text-anchor="middle">✓</text>`;
        } else if (point.smokeFreeStatus === SMOKE_FREE_STATUS_SMOKED) {
          content += `<rect x="${centerX - barWidth / 2}" y="${bottom - 45}" width="${barWidth}" height="45" rx="3" fill="var(--warn)" opacity=".9"/>`;
          content += `<text x="${centerX}" y="${bottom - 51}" font-size="11" fill="var(--warn)" text-anchor="middle">×</text>`;
        } else {
          content += `<circle cx="${centerX}" cy="${bottom - 4}" r="2.5" fill="var(--muted)" opacity=".7"/>`;
        }
      }
      const showLabel =
        mode === 'semana' ||
        point.date.getDate() === 1 ||
        point.date.getDate() % 5 === 0;
      if (showLabel) {
        const label =
          mode === 'semana'
            ? `${DAY_NAMES[point.date.getDay()].slice(0, 2).toUpperCase()} ${point.date.getDate()}`
            : point.date.getDate();
        content += `<text x="${centerX}" y="${xLabels - 12}" font-size="8" fill="#9C8F7C" text-anchor="middle" font-family="Pixelify Sans">${label}</text>`;
      }
    });
    svg.innerHTML = content;
    document.getElementById('sumPico').textContent = model.completedDays;
    document.getElementById('sumPicoDia').textContent = 'cumplidos';
    document.getElementById('sumMin').textContent = model.failedDays;
    document.getElementById('sumMinDia').textContent = 'fallados';
    document.getElementById('sumMedia').textContent =
      model.completedDays+model.failedDays===0
        ? '–'
        : `${Math.round((model.completedDays/(model.completedDays+model.failedDays))*100)}%`;
    return;
  }

  let content = '';
  const stepY = model.yMax > 12 ? 5 : model.yMax > 6 ? 2 : 1;
  for (let value = 0; value <= model.yMax; value += stepY) {
    content += `<line x1="${left}" y1="${yOf(value)}" x2="${right}" y2="${yOf(value)}" stroke="#3A3229" stroke-width="0.6"/>`;
    content += `<text x="${left - 5}" y="${yOf(value) + 3}" font-size="8" fill="#9C8F7C" text-anchor="end" font-family="Pixelify Sans">${value}</text>`;
  }

  if (!model.controlledMode) {
    let limitPath = '';
    model.points.forEach((point, index) => {
      const xStart = left + index * slotWidth;
      const xEnd = left + (index + 1) * slotWidth;
      const y = yOf(point.limit);
      limitPath +=
        (index === 0 ? `M${xStart},${y}` : `L${xStart},${y}`) +
        `L${xEnd},${y}`;
    });
    content += `<path d="${limitPath}" stroke="#EDE3D2" stroke-width="1" stroke-dasharray="4 3" fill="none" opacity="0.55"/>`;
  }

  model.points.forEach((point, index) => {
    const centerX = left + index * slotWidth + slotWidth / 2;
    if (point.past && (point.cigarettes > 0 || point.tracked)) {
      const height = Math.max(
        point.cigarettes > 0 ? 2 : 0,
        (point.cigarettes / model.yMax) * plotHeight,
      );
      let color = 'var(--kodak)';
      if (
        model.controlledMode
          ? point.controlledBudgetExceeded
          : point.cigarettes > point.limit
      ) color = 'var(--warn)';
      else if (
        model.minimum &&
        keyOf(point.date) === keyOf(model.minimum.date)
      ) {
        color = 'var(--ok)';
      }
      if (height > 0) {
        content += `<rect x="${centerX - barWidth / 2}" y="${bottom - height}" width="${barWidth}" height="${height}" rx="2" fill="${color}"/>`;
        if (mode === 'semana' || slots <= 15) {
          content += `<text x="${centerX}" y="${bottom - height - 4}" font-size="9" fill="#EDE3D2" text-anchor="middle" font-family="Pixelify Sans">${point.cigarettes}</text>`;
        }
      }
    }

    const showLabel =
      mode === 'semana' ||
      point.date.getDate() === 1 ||
      point.date.getDate() % 5 === 0;
    if (showLabel) {
      const label =
        mode === 'semana'
          ? `${DAY_NAMES[point.date.getDay()].slice(0, 2).toUpperCase()} ${point.date.getDate()}`
          : point.date.getDate();
      content += `<text x="${centerX}" y="${xLabels - 12}" font-size="8" fill="#9C8F7C" text-anchor="middle" font-family="Pixelify Sans">${label}</text>`;
    }
  });
  svg.innerHTML = content;

  const formatDay = (point) =>
    point
      ? `${DAY_NAMES[point.date.getDay()].slice(0, 3)} ${point.date.getDate()}`
      : '';
  document.getElementById('sumPico').textContent = model.peak
    ? model.peak.cigarettes
    : '–';
  document.getElementById('sumPicoDia').textContent = formatDay(model.peak);
  document.getElementById('sumMin').textContent = model.minimum
    ? model.minimum.cigarettes
    : '–';
  document.getElementById('sumMinDia').textContent = formatDay(model.minimum);
  document.getElementById('sumMedia').textContent =
    model.average === null
      ? '–'
      : model.average.toFixed(1).replace('.', ',');
}
