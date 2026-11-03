import { env } from '../config/env';

const offsetMs = () => env.INSTITUTE_TZ_OFFSET_MINUTES * 60 * 1000;

/**
 * Due dates are stored as the last millisecond of the given calendar day in the
 * institute's timezone, so a fee due "10 Nov" becomes overdue only after 10 Nov ends locally.
 */
export function endOfLocalDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 23, 59, 59, 999) - offsetMs());
}

/** Parse "YYYY-MM-DD" (or ISO) to end of that local day. */
export function dueDateFromInput(input: string | Date): Date {
  if (input instanceof Date) return endOfLocalDay(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) throw new Error('Invalid date');
  return endOfLocalDay(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Start of local day as a UTC Date. */
export function startOfLocalDay(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) throw new Error('Invalid date');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - offsetMs());
}

export function localParts(date: Date) {
  const d = new Date(date.getTime() + offsetMs());
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function monthKey(date: Date) {
  const { year, month } = localParts(date);
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function monthLabel(year: number, monthIndex: number) {
  return `${MONTHS[monthIndex]} ${year}`;
}
export function fullMonthLabel(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
