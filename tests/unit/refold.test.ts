import { describe, expect, test, vi } from 'vitest';
import { REFOLD_MS, Refold } from '../../src/components/inspector/refold';

// The hero figure's change of figure (src/components/inspector/refold.ts): watched, the shown
// figure unfolds to the sheet and the next folds from it; unwatched (the hero off screen), the
// next one is simply there, with nothing left to play when the visitor comes back.
describe('refold', () => {
  test('watched: unfolds, swaps flat, folds the new figure, then rests', () => {
    const refold = new Refold('fox');
    const swap = vi.fn();
    refold.request('crane', 0);
    expect(refold.step(REFOLD_MS.unfold / 2, swap)).toBe(true);
    expect(refold.u).toBeCloseTo(0.5);
    expect(refold.step(REFOLD_MS.unfold, swap)).toBe(true); // flat: the swap
    expect(swap).toHaveBeenCalledWith('crane');
    expect(refold.shown).toBe('crane');
    expect(refold.step(REFOLD_MS.unfold + REFOLD_MS.fold, swap)).toBe(false);
    expect(refold.u).toBe(0);
  });

  test('unwatched: the new figure at once, folded, and nothing pending', () => {
    const refold = new Refold('fox');
    const swapNow = vi.fn();
    const swap = vi.fn();
    refold.request('crane', 0, swapNow);
    expect(swapNow).toHaveBeenCalledWith('crane');
    expect(refold.shown).toBe('crane');
    expect(refold.u).toBe(0);
    expect(refold.step(5_000, swap)).toBe(false);
    expect(swap).not.toHaveBeenCalled();
  });

  test('unwatched in the middle of a watched refold: it stops, and the last asked for is shown', () => {
    const refold = new Refold('fox');
    const swapNow = vi.fn();
    refold.request('crane', 0);
    refold.step(REFOLD_MS.unfold / 2, vi.fn());
    refold.request('morpho', REFOLD_MS.unfold / 2, swapNow);
    expect(swapNow).toHaveBeenCalledWith('morpho');
    expect(refold.step(REFOLD_MS.unfold * 3, vi.fn())).toBe(false);
    expect(refold.u).toBe(0);
  });

  test('the same figure asked for again, unwatched, swaps nothing', () => {
    const refold = new Refold('fox');
    const swapNow = vi.fn();
    refold.request('fox', 0, swapNow);
    expect(swapNow).not.toHaveBeenCalled();
  });
});
