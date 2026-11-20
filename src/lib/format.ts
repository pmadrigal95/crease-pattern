/**
 * How the site writes a value for people to read: dates, month ranges, numbers, counts and Crease
 * numbers. Pages and components never format on their own; `tests/unit/guards.test.ts` fails if
 * they call `Intl` or pad numbers by hand, and says to use this module.
 *
 * Data stays raw (Date, `YYYY-MM`, numbers) everywhere else. Format only where a value is shown,
 * never to sort or compare.
 *
 * Each formatter takes the page's language (English when left out). Depends on nothing but `Intl`,
 * ./template and src/i18n/config, so browser scripts can use it too.
 */
import { fill } from './template';
import { DEFAULT_LANG, LOCALES, type Lang } from '../i18n/config';

/**
 * Each formatter is built the first time a language uses it. Building one loads locale data, which
 * on a slow phone costs tens of milliseconds; browser scripts that import this module use one or
 * two of them, and shouldn't pay for all of them while the page loads.
 */
const lazy = <T>(make: (locale: string) => T): ((lang: Lang) => T) => {
  const made = new Map<Lang, T>();
  return (lang) => {
    let value = made.get(lang);
    if (value === undefined) made.set(lang, (value = make(LOCALES[lang].intl)));
    return value;
  };
};
// Dates are calendar days, stored at midnight UTC: formatting in local time would show the day before.
const longDate = lazy((l) => new Intl.DateTimeFormat(l, { dateStyle: 'long', timeZone: 'UTC' }));
const shortMonth = lazy((l) => new Intl.DateTimeFormat(l, { month: 'short', timeZone: 'UTC' }));
const integer = lazy((l) => new Intl.NumberFormat(l));
const oneDecimal = lazy(
  (l) => new Intl.NumberFormat(l, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);
const andList = lazy((l) => new Intl.ListFormat(l, { type: 'conjunction' }));

/** "November 11, 2026". */
export const formatDate = (date: Date, lang: Lang = DEFAULT_LANG): string => longDate(lang).format(date);

/** "Sep 2019" from `2019-09`; a bare year stays as it is. */
export const formatMonth = (value: string, lang: Lang = DEFAULT_LANG): string => {
  const [year, month] = value.split('-').map(Number);
  return month
    ? `${shortMonth(lang).format(new Date(Date.UTC(year ?? 0, month - 1, 1)))} ${year}`
    : String(year);
};

/** "Sep 2019 – Jul 2022", "Jul 2024 – Present" or "2015 – 2017". */
export const formatRange = (
  start: string,
  end: string | null | undefined,
  present: string,
  lang: Lang = DEFAULT_LANG,
): string => {
  return `${formatMonth(start, lang)} – ${end ? formatMonth(end, lang) : present}`;
};

/** "3,432". */
export const formatNumber = (value: number, lang: Lang = DEFAULT_LANG): string => integer(lang).format(value);

/** "2.4": speedups and milliseconds in the Threads essay, always one decimal. */
export const formatDecimal = (value: number, lang: Lang = DEFAULT_LANG): string =>
  oneDecimal(lang).format(value);

/** "English, Spanish and Japanese". */
export const formatList = (items: readonly string[], lang: Lang = DEFAULT_LANG): string =>
  andList(lang).format(items);

/** Fixed-width serials: 1 → "001". */
export const padNumber = (value: number, digits = 3): string => String(value).padStart(digits, '0');

/** Picks the sentence for a count: `zero` (optional), `one`, or `many` with `{count}`. */
export const formatCount = (
  count: number,
  forms: { zero?: string; one: string; many: string },
  lang: Lang = DEFAULT_LANG,
): string => {
  if (count === 0 && forms.zero) return forms.zero;
  if (count === 1) return forms.one;
  return fill(forms.many, { count: formatNumber(count, lang) });
};
