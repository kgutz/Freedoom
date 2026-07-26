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

const EMPTY_DAY = { c: 0, p: 0 };

export function createCalendarModel({ cursor, now, config, days }) {
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
    entries.push({
      day,
      key,
      isToday: key === today,
      isFuture: daysBetween(now, date) > 0,
      cigarettes: record.c || 0,
      pills: record.p || 0,
      beers: record.b || 0,
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
  };
}

export function createWeeksModel({ now, config, days }) {
  const currentWeek = Math.max(0, weekIndexFor(config.startDate, now));
  const weeks = [];

  for (let week = 0; week <= currentWeek; week += 1) {
    const [firstDay, lastDay] = weekRangeFor(config.startDate, week);
    const limit = limitForWeek(config.startLimit, week);
    let total = 0;
    let daysOverLimit = 0;

    for (
      let date = new Date(firstDay);
      date <= lastDay;
      date.setDate(date.getDate() + 1)
    ) {
      if (daysBetween(now, date) > 0) break;
      const cigarettes = (days[keyOf(date)] || EMPTY_DAY).c || 0;
      total += cigarettes;
      if (cigarettes > limit) daysOverLimit += 1;
    }

    let status;
    let statusClass;
    if (week === currentWeek) {
      status = 'en curso';
      statusClass = 'curr';
    } else if (daysOverLimit === 0) {
      status = '✓ cumplida';
      statusClass = 'ok';
    } else {
      const plural = daysOverLimit > 1 ? 's' : '';
      status = `✗ ${daysOverLimit} día${plural} pasado${plural}`;
      statusClass = 'bad';
    }

    weeks.push({
      number: week + 1,
      limit,
      firstDay,
      lastDay,
      total,
      daysOverLimit,
      status,
      statusClass,
    });
  }

  return {
    currentWeek,
    completedPlan: limitForWeek(config.startLimit, currentWeek) <= 0,
    weeks,
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
    cell.innerHTML =
      `<span class="n">${entry.day}</span>` +
      (entry.cigarettes > 0
        ? `<span class="c${entry.overLimit ? ' over' : ''}">${entry.cigarettes}</span>`
        : '') +
      (extras.length ? `<span class="p">${extras.join(' ')}</span>` : '');
    if (!entry.isFuture) {
      cell.addEventListener('click', () => onDayClick(entry.key));
    }
    grid.appendChild(cell);
  });
}

export function renderWeeksView({ document, now, config, days }) {
  const model = createWeeksModel({ now, config, days });
  const list = document.getElementById('weekList');
  list.innerHTML = '';
  const formatDate = (date) =>
    `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;

  model.weeks.forEach((week) => {
    const row = document.createElement('div');
    row.className = 'wk-row';
    row.innerHTML = `<div>Semana ${week.number} · máx ${week.limit}/día<span class="rng">${formatDate(week.firstDay)} – ${formatDate(week.lastDay)}</span></div>
      <div class="stat ${week.statusClass}">${week.status}<span class="sub">${week.total} en total</span></div>`;
    list.appendChild(row);
  });

  if (model.completedPlan) {
    const done = document.createElement('p');
    done.className = 'hint';
    done.textContent =
      'Has llegado al final del plan. Enhorabuena por el camino recorrido.';
    list.appendChild(done);
  }
}
