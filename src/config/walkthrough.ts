/**
 * The walkthrough's stops (src/components/site/walkthrough.ts), in order: the page each one lives
 * on (unlocalized; null for "any page") and the element it points at. Anchors are the Inspector's
 * own data-inspect ids where they exist, so a stop can't drift from a part the manifest knows;
 * tests/e2e/walkthrough.spec.ts opens every page and checks every anchor. The words are in
 * src/i18n/locales/<lang>/ui.json → walkthrough.stops, keyed like these.
 *
 * Dependency-free: the browser module and the tests both import it.
 */
export const STOPS = [
  { key: 'figure', page: '/', anchor: '[data-inspect="HeroFold"]' },
  { key: 'inspect', page: '/', anchor: '[data-inspector-toggle]' },
  { key: 'measured', page: '/', anchor: '[data-inspect="index#work"]' },
  { key: 'case', page: '/work/buo', anchor: '[data-inspect="CasePlate"]' },
  { key: 'career', page: '/changelog', anchor: '[data-inspect="ExpeditionMap"]' },
  { key: 'precrease', page: '/precrease', anchor: '[data-inspect="PrecreaseMast"]' },
  { key: 'commands', page: null, anchor: '[data-command-open]' },
] as const;

export type StopKey = (typeof STOPS)[number]['key'];
