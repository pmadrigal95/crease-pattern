/**
 * The visitor's hands on the folded page (fold.ts), the way paper answers:
 *
 * - Drag up or down: the accordion closes or opens, as a Miura-ori deploys in one motion.
 * - Drag sideways: the page turns, within a readable range, and settles back when let go.
 * - Keys, with focus outside the Inspector panel: ↑ ↓ open and close, ← → turn, R rests it.
 *
 * Opening a single crease is a button on the crease itself (fold-drawings.ts).
 */
import { REST_SQUEEZE, type Shape } from './fold-pose';

const SQUEEZE = { min: 0.08, max: 1, perPixel: 0.0022, perKey: 0.08 } as const;
const YAW = { limit: 35, perPixel: 0.12, perKey: 8 } as const;
/** How long a turn from the keys holds before the page settles back, in ms. */
const KEY_HOLD = 900;

const swallow = (e: Event) => {
  e.stopPropagation();
  e.preventDefault();
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Wires the gestures to `surface`. `change(live)`: the shape changed; live while a hand is on the
 * page (draw it now, no transition), not live when it should glide to the new shape.
 */
export const foldGestures = (surface: HTMLElement, shape: Shape, change: (live: boolean) => void) => {
  let drag: { x: number; y: number; squeeze: number; yaw: number; id: number } | null = null;
  let settle: ReturnType<typeof setTimeout> | undefined;

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, squeeze: shape.squeeze, yaw: shape.yaw, id: e.pointerId };
    surface.setPointerCapture(e.pointerId);
    surface.classList.add('grabbing');
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    shape.squeeze = clamp(drag.squeeze + (e.clientY - drag.y) * SQUEEZE.perPixel, SQUEEZE.min, SQUEEZE.max);
    shape.yaw = clamp(drag.yaw + (e.clientX - drag.x) * YAW.perPixel, -YAW.limit, YAW.limit);
    change(true);
  };
  const up = (e: PointerEvent) => {
    if (!drag) return;
    // A drag that moved the page isn't a click: the Inspector would pin the section under it.
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) {
      addEventListener('click', swallow, { capture: true, once: true });
      // The click, if any, comes right after; never let the guard eat a later one.
      setTimeout(() => removeEventListener('click', swallow, { capture: true }), 0);
    }
    drag = null;
    surface.classList.remove('grabbing');
    // The turn was to look; the fold the visitor chose stays.
    shape.yaw = 0;
    change(false);
  };
  const key = (e: KeyboardEvent) => {
    if (typing(e.target) || (e.target instanceof Element && e.target.closest('#pm-inspector'))) return;
    const steps: Record<string, () => void> = {
      ArrowUp: () => (shape.squeeze = clamp(shape.squeeze - SQUEEZE.perKey, SQUEEZE.min, SQUEEZE.max)),
      ArrowDown: () => (shape.squeeze = clamp(shape.squeeze + SQUEEZE.perKey, SQUEEZE.min, SQUEEZE.max)),
      ArrowLeft: () => (shape.yaw = clamp(shape.yaw - YAW.perKey, -YAW.limit, YAW.limit)),
      ArrowRight: () => (shape.yaw = clamp(shape.yaw + YAW.perKey, -YAW.limit, YAW.limit)),
      r: () => {
        shape.squeeze = REST_SQUEEZE;
        shape.yaw = 0;
        shape.open.fill(false);
      },
    };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    step();
    change(false);
    clearTimeout(settle);
    if (shape.yaw !== 0)
      settle = setTimeout(() => {
        shape.yaw = 0;
        change(false);
      }, KEY_HOLD);
  };

  surface.addEventListener('pointerdown', down);
  surface.addEventListener('pointermove', move);
  surface.addEventListener('pointerup', up);
  surface.addEventListener('pointercancel', up);
  addEventListener('keydown', key);
  return () => {
    clearTimeout(settle);
    surface.removeEventListener('pointerdown', down);
    surface.removeEventListener('pointermove', move);
    surface.removeEventListener('pointerup', up);
    surface.removeEventListener('pointercancel', up);
    removeEventListener('keydown', key);
  };
};
