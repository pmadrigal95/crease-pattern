/**
 * The earlier roles on /work as a timeline (src/components/work/EarlierWork.astro, doc 36): each
 * role a ribbon from its start month to its end month on a ruler of years, overlapping ones on
 * lanes of their own. Pure, so it can be tested: positions are fractions of the ruler's width.
 */
import { fill } from './template';

export interface Span {
  /** `YYYY-MM`. */
  start: string;
  /** `YYYY-MM`, the last month worked. */
  end: string;
}

export interface Ribbon<T extends Span> {
  role: T;
  lane: number;
  /** Fractions of the ruler, 0 to 1. */
  from: number;
  to: number;
  /** Too short for its name, which then sits just after it. */
  outside: boolean;
}

/** Months since year 0: `2019-09` is 2019 × 12 + 8. */
export const monthIndex = (yearMonth: string): number => {
  const [year, month] = yearMonth.split('-').map(Number);
  return (year ?? 0) * 12 + ((month ?? 1) - 1);
};

/** How many months a span covers, both ends included: May to July is 3. */
export const monthsOf = ({ start, end }: Span): number => monthIndex(end) - monthIndex(start) + 1;

/** Whole years and the months left over. */
export const yearsAndMonths = (months: number): { years: number; months: number } => ({
  years: Math.floor(months / 12),
  months: months % 12,
});

/** A ribbon shorter than this many months carries its name outside. */
export const SHORT = 9;
/** Months of ruler a name outside its ribbon takes up, so the next ribbon on its lane clears it. */
export const NAME_MONTHS = 15;
/** The ruler runs a year past the last role, for the case that follows. */
export const TAIL = 12;

/**
 * The ribbons, each on the first lane free when it starts, and the ruler's first and last month
 * (January of the first year; a year past the last role).
 */
export const timeline = <T extends Span>(roles: readonly T[]) => {
  const first = Math.floor(Math.min(...roles.map((r) => monthIndex(r.start))) / 12) * 12;
  const last = Math.max(...roles.map((r) => monthIndex(r.end))) + 1 + TAIL;
  const at = (month: number) => (month - first) / (last - first);
  const lanes: number[] = [];
  const ribbons = roles
    .toSorted((a, b) => a.start.localeCompare(b.start))
    .map((role): Ribbon<T> => {
      const outside = monthsOf(role) < SHORT;
      let lane = lanes.findIndex((busy) => busy < monthIndex(role.start));
      if (lane < 0) lane = lanes.length;
      lanes[lane] = monthIndex(role.end) + (outside ? NAME_MONTHS : 0);
      return { role, lane, from: at(monthIndex(role.start)), to: at(monthIndex(role.end) + 1), outside };
    });
  const years: { year: number; at: number }[] = [];
  for (let m = first; m < last; m += 12) years.push({ year: m / 12, at: at(m) });
  return { ribbons, lanes: lanes.length, years, at, first, last };
};

/** The words for a length of time, in the page's language (copy.cases.index.earlier). */
export interface LengthWords {
  year: string;
  years: string;
  month: string;
  months: string;
  and: string;
}

/** "3 months", "1 year", "2 years and 11 months". */
export const howLong = (total: number, w: LengthWords): string => {
  const { years, months } = yearsAndMonths(total);
  const m = months === 1 ? w.month : fill(w.months, { n: months });
  const y = years === 1 ? w.year : fill(w.years, { n: years });
  if (!years) return m;
  return months ? fill(w.and, { years: y, months: m }) : y;
};
