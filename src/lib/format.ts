/**
 * How the site writes a value for people to read: dates, month ranges, numbers, counts and Crease
 * numbers. Pages and components never format on their own; `tests/unit/guards.test.ts` fails if
 * they call `Intl` or pad numbers by hand, and says to use this module.
 *
 * Data stays raw (Date, `YYYY-MM`, numbers) everywhere else. Format only where a value is shown,
 * never to sort or compare.
 *
 * Depends on nothing but `Intl` and ./template, so browser scripts can use it too.
 */
import { fill } from './template';

const LOCALE = 'en';
// Dates are calendar days, stored at midnight UTC: formatting in local time would show the day before.
const longDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeZone: 'UTC' });
const shortMonth = new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' });
const integer = new Intl.NumberFormat(LOCALE);
const andList = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

/** "November 11, 2026". */
export const formatDate = (date: Date): string => longDate.format(date);

/** "Sep 2019" from `2019-09`; a bare year stays as it is. */
export function formatMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  return month ? `${shortMonth.format(new Date(Date.UTC(year ?? 0, month - 1, 1)))} ${year}` : String(year);
}

/** "Sep 2019 – Jul 2022", "Jul 2024 – Present" or "2015 – 2017". */
export function formatRange(start: string, end: string | null | undefined, present: string): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : present}`;
}

/** "3,432". */
export const formatNumber = (value: number): string => integer.format(value);

/** "English, Spanish and Japanese". */
export const formatList = (items: readonly string[]): string => andList.format(items);

/** Fixed-width serials: 1 → "001". */
export const padNumber = (value: number, digits = 3): string => String(value).padStart(digits, '0');

/** Picks the sentence for a count: `zero` (optional), `one`, or `many` with `{count}`. */
export function formatCount(count: number, forms: { zero?: string; one: string; many: string }): string {
  if (count === 0 && forms.zero) return forms.zero;
  if (count === 1) return forms.one;
  return fill(forms.many, { count: formatNumber(count) });
}
