/**
 * Small DOM helpers for the site's browser scripts. Components pass server data to their script
 * as JSON in a `data-*` attribute (never inline script, which the CSP blocks); this reads it back.
 */

/** Parses `el.dataset[key]` as JSON, or returns `fallback` when it's missing. */
export const readJsonData = <T>(el: HTMLElement | null, key: string, fallback: T): T => {
  const raw = el?.dataset[key];
  return raw ? (JSON.parse(raw) as T) : fallback;
};
