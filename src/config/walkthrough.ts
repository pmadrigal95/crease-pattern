/**
 * The walkthrough's stops (src/components/site/walkthrough.ts), in order: the page each one lives
 * on (unlocalized; null for "any page") and the element it points at: the smallest part that tells
 * the stop's point, inside one of the Inspector's own data-inspect parts where there is one, so a
 * stop can't drift from a part the manifest knows;
 * tests/e2e/walkthrough.spec.ts opens every page and checks every anchor. The words are in
 * src/i18n/locales/<lang>/ui.json → walkthrough.stops, keyed like these.
 *
 * Dependency-free: the browser module and the tests both import it.
 */
export const STOPS = [
  { key: 'figure', page: '/', anchor: '[data-hero-fold] [data-stage]' },
  { key: 'inspect', page: '/', anchor: '[data-inspector-toggle]' },
  { key: 'measured', page: '/', anchor: '[data-inspect="index#work"] .readout' },
  { key: 'case', page: '/work/buo', anchor: '[data-inspect="CasePlate"] .fig' },
  { key: 'career', page: '/changelog', anchor: '[data-inspect="ExpeditionMap"]' },
  { key: 'precrease', page: '/precrease', anchor: '[data-inspect="PrecreaseMast"]' },
  { key: 'commands', page: null, anchor: '[data-command-open]' },
] as const;

export type StopKey = (typeof STOPS)[number]['key'];
