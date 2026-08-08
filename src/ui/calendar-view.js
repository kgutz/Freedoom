import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  daysBetween,
  keyOf,
} from '../domain/date-utils.js';
import {
  limitForDate,
  limitForWeek,
  weekIndexFor,
  weekRangeFor,
} from '../domain/plan-rules.js';
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

const EMPTY_DAY = { c: 0, p: 0 };

function controlledWeekUsage(config, days, date) {
  const week = Math.max(0, weekIndexFor(config.startDate, date));
  const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
  let used = 0;
  for (
    let cursor = new Date(firstDay);
    cursor <= lastDay;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const cursorConfig = journeyConfigForDate(config, cursor);
    if (isControlledSmokingDay(cursorConfig, cursor)) {
      used += Math.max(0, days[keyOf(cursor)]?.c || 0);
    }
  }
  return used;
}

export function createDayEditorModel({ config, date }) {
  const dateConfig = journeyConfigForDate(config, date);
  const smokeFreeMode = isSmokeFreeMode(dateConfig);
  const controlledMode = isControlledMode(dateConfig);
  const controlledAllowed =
    controlledMode && isControlledSmokingDay(dateConfig, date);

  return {
    showCigarettes:
      !smokeFreeMode && (!controlledMode || controlledAllowed),
    showSmokeFreeStatus:
      smokeFreeMode || (controlledMode && !controlledAllowed),
    showPills:
      config?.takesPills !== false &&
      Math.max(0, Number(config?.pillsGoal) || 0) > 0,
    showBeers: config?.tracksBeer !== false,
  };
}

export function createCalendarModel({ cursor, now, config, days }) {
  const smokeFreeMode = isSmokeFreeMode(config);
  const controlledMode = isControlledMode(config);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = keyOf(now);
  const entries = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const key = keyOf(date);
    const record = days[key] || EMPTY_DAY;
    const dateConfig = journeyConfigForDate(config, date);
    const entrySmokeFreeMode = isSmokeFreeMode(dateConfig);
    const entryControlledMode = isControlledMode(dateConfig);
    const controlledAllowed = isControlledSmokingDay(dateConfig, date);
    const controlledWeekUsed = entryControlledMode
      ? controlledWeekUsage(config, days, date)
      : 0;
    const controlledBudgetExceeded =
      controlledWeekUsed > controlledWeeklyLimitOf(dateConfig);
    const isSettled = daysBetween(now, date) < 0;
    entries.push({
      day,
      key,
      isToday: key === today,
      isFuture: daysBetween(now, date) > 0,
      isSettled,
      cigarettes: record.c || 0,
      pills: record.p || 0,
      beers: record.b || 0,
      smokeFreeStatus: smokeFreeStatusOf(record),
      controlledAllowed,
      controlledBudgetExceeded,
      smokeFreeMode: entrySmokeFreeMode,
      controlledMode: entryControlledMode,
      overLimit:
        (record.c || 0) >
        limitForDate({
          startDate: config.startDate,
          startLimit: config.startLimit,
          date,
        }),
    });
  }

  return {
    title: `${MONTH_NAMES[month]} ${year}`,
    weekdays: WEEKDAY_INITIALS,
    offset,
    entries,
    smokeFreeMode,
    controlledMode,
  };
}

export function createWeeksModel({ now, config, days }) {
  const smokeFreeMode = isSmokeFreeMode(config);
  const controlledMode = isControlledMode(config);
  const currentWeek = Math.max(0, weekIndexFor(config.startDate, now));
  const weeks = [];

  for (let week = 0; week <= currentWeek; week += 1) {
    const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
    let weekSmokeFreeMode = false;
    let weekControlledMode = false;
    let controlledWeekConfig = config;
    const limit = limitForWeek(config.startLimit, week);
    let total = 0;
    let daysOverLimit = 0;
    let smokeFreeDays = 0;
    let smokedDays = 0;
    let pendingDays = 0;
    let controlledAllowedDays = 0;
    let controlledConfirmedDays = 0;
    let controlledWeekUsed = 0;

    for (
      let date = new Date(firstDay);
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      if (daysBetween(now, date) > 0) break;
      const record = days[keyOf(date)] || EMPTY_DAY;
      const dateConfig = journeyConfigForDate(config, date);
      const daySmokeFreeMode = isSmokeFreeMode(dateConfig);
      const dayControlledMode = isControlledMode(dateConfig);
      if (daySmokeFreeMode) weekSmokeFreeMode = true;
      if (dayControlledMode) {
        weekControlledMode = true;
        controlledWeekConfig = dateConfig;
      }
      const cigarettes = record.c || 0;
      total += cigarettes;
      if (cigarettes > limit) daysOverLimit += 1;
      if (daySmokeFreeMode) {
        const smokeFreeStatus = smokeFreeStatusOf(record);
        if (smokeFreeStatus === SMOKE_FREE_STATUS_SUCCESS) smokeFreeDays += 1;
        else if (smokeFreeStatus === SMOKE_FREE_STATUS_SMOKED) smokedDays += 1;
        else pendingDays += 1;
      }
      if (dayControlledMode) {
        if (isControlledSmokingDay(dateConfig, date)) {
          controlledAllowedDays += 1;
          controlledWeekUsed += cigarettes;
        }
        else {
          const status = smokeFreeStatusOf(record);
          if (status === SMOKE_FREE_STATUS_SUCCESS) controlledConfirmedDays += 1;
          else if (status === SMOKE_FREE_STATUS_SMOKED) smokedDays += 1;
          else pendingDays += 1;
        }
      }
    }

    const controlledWeeklyLimit = controlledWeeklyLimitOf(controlledWeekConfig);
    const controlledBudgetExceeded =
      weekControlledMode && controlledWeekUsed > controlledWeeklyLimit;
    const controlledCompliantDays = weekControlledMode
      ? smokeFreeDays + controlledConfirmedDays +
        (controlledBudgetExceeded ? 0 : controlledAllowedDays)
      : 0;

    let status;
    let statusClass;
    if (week === currentWeek) {
      status = 'en curso';
      statusClass = 'curr';
    } else if (weekControlledMode && controlledCompliantDays >= 6 && !controlledBudgetExceeded) {
      status = '✓ jefe vencido';
      statusClass = 'ok';
    } else if (weekControlledMode) {
      status = controlledBudgetExceeded
        ? '✗ límite semanal superado'
        : `✗ ${controlledCompliantDays} de 6 días`;
      statusClass = 'bad';
    } else if (weekSmokeFreeMode && smokeFreeDays >= 6) {
      status = '✓ jefe vencido';
      statusClass = 'ok';
    } else if (weekSmokeFreeMode) {
      status = `✗ ${smokeFreeDays} de 6 días`;
      statusClass = 'bad';
    } else if (daysOverLimit === 0) {
      status = '✓ cumplida';
      statusClass = 'ok';
    } else {
      const plural = daysOverLimit > 1 ? 's' : '';
      status = `✗ ${daysOverLimit} día${plural} pasado${plural}`;
      statusClass = 'bad';
    }

    weeks.push({
      index: week,
      number: week + 1,
      limit,
      firstDay,
      lastDay,
      total,
      daysOverLimit,
      status,
      statusClass,
      smokeFreeDays,
      smokedDays,
      pendingDays,
      controlledCompliantDays,
      controlledWeekUsed,
      controlledWeeklyLimit,
      controlledBudgetExceeded,
      smokeFreeMode: weekSmokeFreeMode && !weekControlledMode,
      controlledMode: weekControlledMode,
    });
  }

  return {
    currentWeek,
    completedPlan: limitForWeek(config.startLimit, currentWeek) <= 0,
    weeks,
    smokeFreeMode,
    controlledMode,
  };
}

export function renderCalendarView({
  document,
  cursor,
  now,
  config,
  days,
  onDayClick,
}) {
  const model = createCalendarModel({ cursor, now, config, days });
  document.getElementById('calTitle').textContent = model.title;
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  model.weekdays.forEach((weekday) => {
    const element = document.createElement('div');
    element.className = 'cal-dow';
    element.textContent = weekday;
    grid.appendChild(element);
  });
  for (let index = 0; index < model.offset; index += 1) {
    const element = document.createElement('div');
    element.className = 'cal-day empty';
    grid.appendChild(element);
  }

  model.entries.forEach((entry) => {
    const cell = document.createElement('div');
    cell.className =
      'cal-day' +
      (entry.isToday ? ' today' : '') +
      (entry.isFuture ? ' future' : '');
    const extras = [];
    if (entry.pills > 0) extras.push(`💊${entry.pills}`);
    if (entry.beers > 0) extras.push(`🍺${entry.beers}`);
    const smokeFreeMark = {
      success: '<span class="sf success" aria-label="Día sin fumar">✓</span>',
      smoked: '<span class="sf smoked" aria-label="Día fumado">×</span>',
      pending: '<span class="sf pending" aria-label="Día pendiente">·</span>',
    }[entry.smokeFreeStatus];
    cell.innerHTML =
      `<span class="n">${entry.day}</span>` +
      (entry.controlledMode
        ? entry.controlledAllowed
          ? entry.controlledBudgetExceeded
            ? '<span class="sf smoked" aria-label="Límite semanal superado">×</span>'
            : entry.cigarettes > 0
              ? `<span class="c">${entry.cigarettes}</span>`
              : entry.isSettled
                ? '<span class="sf success" aria-label="Día permitido cumplido sin fumar">✓</span>'
                : '<span class="sf pending" aria-label="Día permitido en curso">·</span>'
          : smokeFreeMark
        : entry.smokeFreeMode
        ? smokeFreeMark
        : entry.cigarettes > 0
          ? `<span class="c${entry.overLimit ? ' over' : ''}">${entry.cigarettes}</span>`
          : '') +
      (extras.length ? `<span class="p">${extras.join(' ')}</span>` : '');
    if (!entry.isFuture) {
      cell.addEventListener('click', () => onDayClick(entry.key));
    }
    grid.appendChild(cell);
  });
}

export function renderWeeksView({ document, now, config, days, onWeekClick }) {
  const model = createWeeksModel({ now, config, days });
  const list = document.getElementById('weekList');
  list.innerHTML = '';
  const formatDate = (date) =>
    `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;

  model.weeks.forEach((week) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'wk-row';
    row.dataset.weekIndex = String(week.index);
    row.setAttribute(
      'aria-label',
      `Abrir la gráfica de la semana ${week.number}`,
    );
    row.innerHTML = week.controlledMode
      ? `<div>Semana ${week.number} · máx ${week.controlledWeeklyLimit}/semana<span class="rng">${formatDate(week.firstDay)} – ${formatDate(week.lastDay)}</span></div>
        <div class="stat ${week.statusClass}">${week.status}<span class="sub">${week.controlledWeekUsed} consumidos · ${week.controlledCompliantDays} días cumplidos</span></div>`
      : week.smokeFreeMode
      ? `<div>Semana ${week.number}<span class="rng">${formatDate(week.firstDay)} – ${formatDate(week.lastDay)}</span></div>
        <div class="stat ${week.statusClass}">${week.status}<span class="sub">${week.smokeFreeDays} sin fumar · ${week.smokedDays} fumado · ${week.pendingDays} pendiente</span></div>`
      : `<div>Semana ${week.number} · máx ${week.limit}/día<span class="rng">${formatDate(week.firstDay)} – ${formatDate(week.lastDay)}</span></div>
        <div class="stat ${week.statusClass}">${week.status}<span class="sub">${week.total} en total</span></div>`;
    row.addEventListener('click', () => onWeekClick?.(week.index));
    list.appendChild(row);
  });

  if (model.completedPlan && !model.smokeFreeMode && !model.controlledMode) {
    const done = document.createElement('p');
    done.className = 'hint';
    done.textContent =
      'Has llegado al final del plan. Enhorabuena por el camino recorrido.';
    list.appendChild(done);
  }
}
