import { keyOf, minutesOf, parseKey } from './date-utils.js';

export const DEFAULT_DAY_START_TIME = '04:00';

export function dayStartMinutes(dayStartTime = DEFAULT_DAY_START_TIME) {
  const value = minutesOf(dayStartTime);
  return Number.isFinite(value) ? value : 240;
}

export function logicalDayDate(
  now = new Date(),
  dayStartTime = DEFAULT_DAY_START_TIME,
) {
  const date = new Date(now);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  if (currentMinutes < dayStartMinutes(dayStartTime)) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

export function logicalDayKey(
  now = new Date(),
  dayStartTime = DEFAULT_DAY_START_TIME,
) {
  return keyOf(logicalDayDate(now, dayStartTime));
}

export function logicalTimeMinutes(
  date,
  dayStartTime = DEFAULT_DAY_START_TIME,
) {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  return currentMinutes < dayStartMinutes(dayStartTime)
    ? currentMinutes + 1440
    : currentMinutes;
}

export function logicalClockMinutes(
  clockMinutes,
  dayStartTime = DEFAULT_DAY_START_TIME,
) {
  return clockMinutes < dayStartMinutes(dayStartTime)
    ? clockMinutes + 1440
    : clockMinutes;
}

export function timeLabel(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function timestampForLogicalDayTime({
  dayKey,
  time,
  dayStartTime = DEFAULT_DAY_START_TIME,
}) {
  const date = parseKey(dayKey);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  if (hours * 60 + minutes < dayStartMinutes(dayStartTime)) {
    date.setDate(date.getDate() + 1);
  }
  return date.getTime();
}
