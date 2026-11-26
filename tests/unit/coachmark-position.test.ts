import { describe, expect, it } from 'vitest';
import { placeCoachmark } from '../../src/lib/coachmark-position';

const view = { width: 1280, height: 800, top: 60 };
const card = { width: 320, height: 160 };

describe('placeCoachmark', () => {
  it('puts the card below a small target, centered on it, with the arrow on the target', () => {
    const p = placeCoachmark({ x: 600, y: 100, width: 80, height: 40 }, card, view);
    expect(p.side).toBe('below');
    expect(p.y).toBe(100 + 40 + 8 + 14);
    expect(p.x + (p.arrow ?? 0)).toBe(640); // the arrow points at the target's center
  });

  it('goes above when there is no room below', () => {
    const p = placeCoachmark({ x: 600, y: 680, width: 80, height: 40 }, card, view);
    expect(p.side).toBe('above');
    expect(p.y + card.height).toBeLessThanOrEqual(680 - 8);
  });

  it('goes beside a tall target that leaves room on the left', () => {
    const p = placeCoachmark({ x: 700, y: 80, width: 500, height: 700 }, card, view);
    expect(p.side).toBe('left');
    expect(p.x + card.width).toBeLessThanOrEqual(700 - 8);
  });

  it('sits inside a target that fills the screen, without an arrow', () => {
    const p = placeCoachmark({ x: 0, y: -400, width: 1280, height: 2000 }, card, view);
    expect(p.side).toBe('inside');
    expect(p.arrow).toBeNull();
    expect(p.y + card.height).toBeLessThanOrEqual(view.height);
  });

  it('clips the ring to the visible area under the masthead', () => {
    const p = placeCoachmark({ x: 100, y: -300, width: 400, height: 2000 }, card, view);
    expect(p.ring.y).toBe(view.top + 4);
    expect(p.ring.y + p.ring.height).toBe(view.height - 4);
  });

  it('keeps the card on screen near the edges, and the arrow clear of its corners', () => {
    const p = placeCoachmark({ x: 4, y: 100, width: 24, height: 24 }, card, view);
    expect(p.x).toBeGreaterThanOrEqual(12);
    expect(p.arrow).toBeGreaterThanOrEqual(22);
  });
});
