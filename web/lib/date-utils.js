/**
 * Format an ISO date string to Indonesian locale display
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Format a date range (start/end ISO strings) to Indonesian locale
 */
export function formatPeriod(start, end) {
  if (!start) return '—';
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d) => d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

/**
 * Get the ISO week number for a given Date.
 */
export function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

/**
 * Get the start (Monday) and end (Sunday) of an ISO week in a given year.
 */
export function getWeekRange(year, week) {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const start = new Date(startOfWeek1);
  start.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

/**
 * Get the number of ISO weeks in a given year.
 */
export function getWeeksInYear(year) {
  const dec28 = new Date(year, 11, 28);
  return getISOWeek(dec28);
}

/**
 * Get month name (Indonesian) for a given Date.
 */
export function getMonthName(date) {
  return new Date(date).toLocaleDateString('id-ID', { month: 'long' });
}

/**
 * Format a date as DD Mon YYYY (no time)
 */
export function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
