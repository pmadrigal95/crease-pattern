/**
 * The hero's pointer effect (decision 8f, revisited 2026-11-25): what moves behind the home page's
 * figure when the pointer crosses it. "surface" bends the identity's own texture around the
 * pointer; "ink" runs a fluid in the identity's colors; "off" keeps the page still.
 *
 * Read by the hero's loader (src/scripts/hero-pointer.ts) and set from the Inspector. The choice is
 * stored in localStorage (pm.pointer) only once the visitor makes one; /privacy says so. Without a
 * choice the surface plays, or nothing on a device that asks for reduced motion. A choice the
 * visitor made in the Inspector is theirs, so it holds even then.
 */
export const POINTER_EFFECTS = ['off', 'surface', 'ink'] as const;
export type PointerEffect = (typeof POINTER_EFFECTS)[number];

const KEY = 'pm.pointer';
/** Sent on window when the visitor picks an effect, so the hero swaps it without a reload. */
export const POINTER_EVENT = 'pm:pointer';

const isEffect = (value: string | null): value is PointerEffect =>
  value !== null && (POINTER_EFFECTS as readonly string[]).includes(value);

/** The effect to play now. */
export const pointerEffect = (): PointerEffect => {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    // Storage blocked: the default applies.
  }
  if (isEffect(saved)) return saved;
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'surface';
};

/** Remembers the visitor's choice and tells the hero. */
export const setPointerEffect = (effect: PointerEffect): void => {
  try {
    localStorage.setItem(KEY, effect);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: effect }));
};
