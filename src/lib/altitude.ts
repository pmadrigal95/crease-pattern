/**
 * Time and height for the career drawn as a climb: the releases as the drawings need them
 * (src/lib/ridge.ts draws the home page's paper ridge from them), and small shared helpers.
 * Pure functions, no DOM.
 */

/** One release as the drawing needs it: when it ran (decimal years) and how high it is. */
export interface Climb {
  major: number;
  codename: string;
  elevationM: number;
  theme: string;
  start: number;
  end: number;
}

/** "2019-09" → 2019.67; "2015" → 2015. */
export const decimalYear = (yearMonth: string): number => {
  const [y = 0, m = 1] = yearMonth.split('-').map(Number);
  return y + (m - 1) / 12;
};

/** Decimal year of a date, for "today" at the end of the climb. */
export const yearOf = (date: Date): number =>
  date.getUTCFullYear() + date.getUTCMonth() / 12 + (date.getUTCDate() - 1) / 365;

/** Text width estimate (average glyph width × length), generous so a fit is never a surprise. */
export const textWidth = (text: string, size: number): number => text.length * size * 0.58;
