import { daysBetween, parseKey } from './date-utils.js';

export function weekIndexFor(startDate, date) {
  const start = typeof startDate === 'string' ? parseKey(startDate) : startDate;
  return Math.floor(daysBetween(start, date) / 7);
}

export function weekRangeFor(startDate, weekIndex) {
  const start =
    typeof startDate === 'string' ? parseKey(startDate) : new Date(startDate);
  const firstDay = new Date(start);
  firstDay.setDate(firstDay.getDate() + weekIndex * 7);
  const lastDay = new Date(firstDay);
  lastDay.setDate(lastDay.getDate() + 6);
  return [firstDay, lastDay];
}

export function limitForWeek(startLimit, weekIndex) {
  return Math.max(0, startLimit - weekIndex);
}

export function bossCountForPlan(startLimit, availableBosses = 21) {
  const weeks = Number.isFinite(Number(startLimit))
    ? Math.max(1, Math.trunc(Number(startLimit)))
    : 1;
  return Math.min(weeks, Math.max(1, availableBosses));
}

export function limitForDate({ startDate, startLimit, date }) {
  const weekIndex = Math.max(0, weekIndexFor(startDate, date));
  return limitForWeek(startLimit, weekIndex);
}
