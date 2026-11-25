/**
 * Where a coach mark goes (src/components/site/coachmark.ts): pure geometry, so it's tested
 * without a browser (tests/unit/coachmark-position.test.ts).
 *
 * The card sits beside its target with an arrow pointing at it, on the first side with room:
 * below, above, right, left. A target too big for any side (a section taller than the screen) gets
 * the card inside its visible part, at the bottom, without an arrow. The ring that marks the target
 * is clipped to what's visible below the masthead, so it always shows.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Placement {
  side: 'below' | 'above' | 'right' | 'left' | 'inside';
  x: number;
  y: number;
  /** Where the arrow meets the card, along its edge, in px from the card's corner; null inside. */
  arrow: number | null;
  ring: Rect;
}

const MARGIN = 12; // from the screen's edges
const GAP = 14; // between the ring and the card (the arrow lives here)
const PAD = 8; // the ring's room around the target
const ARROW_INSET = 22; // the arrow keeps clear of the card's rounded corners

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * @param target the target's box in the viewport
 * @param card the card's size
 * @param view the viewport, and `top`: what the sticky masthead covers
 */
export const placeCoachmark = (
  target: Rect,
  card: { width: number; height: number },
  view: { width: number; height: number; top: number },
): Placement => {
  // The ring: the target and its padding, clipped to the visible area.
  const top = Math.max(target.y - PAD, view.top + 4);
  const bottom = Math.min(target.y + target.height + PAD, view.height - 4);
  const left = Math.max(target.x - PAD, 4);
  const right = Math.min(target.x + target.width + PAD, view.width - 4);
  const ring = { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };

  const cx = ring.x + ring.width / 2;
  const cy = ring.y + ring.height / 2;
  const alongX = (x: number) => clamp(cx - x, ARROW_INSET, card.width - ARROW_INSET);
  const alongY = (y: number) => clamp(cy - y, ARROW_INSET, card.height - ARROW_INSET);
  const fitX = (x: number) => clamp(x, MARGIN, view.width - card.width - MARGIN);
  const fitY = (y: number) => clamp(y, view.top + MARGIN, view.height - card.height - MARGIN);

  const room = {
    below: view.height - (ring.y + ring.height) - GAP - MARGIN,
    above: ring.y - view.top - GAP - MARGIN,
    right: view.width - (ring.x + ring.width) - GAP - MARGIN,
    left: ring.x - GAP - MARGIN,
  };
  if (room.below >= card.height) {
    const x = fitX(cx - card.width / 2);
    return { side: 'below', x, y: ring.y + ring.height + GAP, arrow: alongX(x), ring };
  }
  if (room.above >= card.height) {
    const x = fitX(cx - card.width / 2);
    return { side: 'above', x, y: ring.y - GAP - card.height, arrow: alongX(x), ring };
  }
  if (room.right >= card.width) {
    const y = fitY(cy - card.height / 2);
    return { side: 'right', x: ring.x + ring.width + GAP, y, arrow: alongY(y), ring };
  }
  if (room.left >= card.width) {
    const y = fitY(cy - card.height / 2);
    return { side: 'left', x: ring.x - GAP - card.width, y, arrow: alongY(y), ring };
  }
  return {
    side: 'inside',
    x: fitX(cx - card.width / 2),
    y: fitY(ring.y + ring.height - card.height - MARGIN),
    arrow: null,
    ring,
  };
};
