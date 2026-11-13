/**
 * The site's quality bar, as data. The accessibility suite audits these pages in these themes,
 * the budget script enforces these limits, and the home page's "This site, measured" reads the
 * same values, so what the site claims and what CI enforces can't drift apart.
 *
 * Dependency-free on purpose: Node scripts import this file directly (type stripping).
 */
export const auditedPages = [
  '/',
  '/changelog',
  '/about',
  '/colophon',
  '/privacy',
  '/precrease',
  '/precrease/map',
  '/precrease/the-work-before-the-shape',
  '/precrease/topics/frontend',
  '/precrease/subscribe',
  '/this-page-does-not-exist',
] as const;

export const themes = ['light', 'dark'] as const;

/** JavaScript budgets in KB, Brotli (decision 44). */
export const jsBudgetKb = {
  /** Every script an HTML page references directly. */
  page: 15,
  /** What those scripts can import later: today the Inspector. */
  onDemand: 32,
  /**
   * Everything one interactive essay (a post public/_headers isolates) can run, Web Workers
   * included: Crease No. 002 measured 42 KB when this was set. Checked on every build that has
   * one (production and preview); a build without an isolated post skips it.
   */
  essay: 45,
} as const;
