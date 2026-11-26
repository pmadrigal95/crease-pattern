/**
 * The hero figure's change of figure (scene3d.ts), on its own so it can be tested without three.js.
 */
import type { ModelId } from '../../lib/origami/models';

export const REFOLD_MS = { unfold: 1500, fold: 1800 };

/**
 * Changing figure: the shown one unfolds to the sheet, then the next folds from it. One value u
 * (0 folded … 1 flat) and the figure waiting for the sheet; a new request while it runs only
 * changes which figure that is.
 */
export class Refold {
  u = 0;
  private from = 0;
  private to = 0;
  private start = 0;
  private ms = 0;
  private next: ModelId | null = null;
  constructor(public shown: ModelId) {}
  /**
   * Refolds into `id`. With `swapNow` (nobody watching: the hero off screen), the figure is swapped
   * at once, folded, with nothing pending: a refold left waiting would play half-done later.
   */
  request(id: ModelId, now: number, swapNow?: (id: ModelId) => void) {
    if (swapNow) {
      if (id !== this.shown) swapNow(id);
      Object.assign(this, { next: null, u: 0, ms: 0, shown: id });
    } else if (this.next) this.next = id;
    else if (id !== this.shown) {
      this.next = id;
      this.run(1, now, REFOLD_MS.unfold * (1 - this.u));
    }
  }
  cancel() {
    this.next = null;
  }
  /** Advances to `now`; true while moving. `swap` is called flat, with the figure to fold next. */
  step(now: number, swap: (id: ModelId) => void): boolean {
    if (!this.ms) return false;
    const k = Math.min(1, Math.max(0, (now - this.start) / this.ms));
    this.u = this.from + (this.to - this.from) * k;
    if (k < 1) return true;
    this.ms = 0;
    if (!this.next) return false;
    // Flat on the floor, every figure is the same kind of thing: a sheet. Swap, then fold.
    this.shown = this.next;
    this.next = null;
    swap(this.shown);
    this.run(0, now, REFOLD_MS.fold);
    return true;
  }
  private run(to: number, now: number, ms: number) {
    Object.assign(this, { from: this.u, to, start: now, ms });
  }
}
