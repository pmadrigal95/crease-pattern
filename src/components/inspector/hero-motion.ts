/**
 * How a visitor moves the hero's 3D figure (scene3d.ts), each part a value the scene reads every
 * frame and a `step` that says whether it's still moving, so the scene draws only while something
 * does:
 *
 * - Orbit: drag to turn the figure, with a little inertia. Horizontal on touch screens, so a
 *   vertical swipe still scrolls the page.
 * - FoldControl: the fold the hero's slider asks for (0 the figure, 1 its crease pattern), eased so
 *   the hinges turn instead of jumping; and, once, a short demonstration that it unfolds.
 * - FrameProbe: watches the first moving frames; on a device that can't keep a smooth rate, the
 *   scene hands the square back to the SVG.
 */

/** Drag sensitivity, in radians per pixel, and how fast a released spin slows down (per second). */
const DRAG = 0.008;
const FRICTION = 4;
/** How far the figure tips up or down, in radians: enough to see under a wing, never upside down. */
const PITCH_LIMIT = 0.5;

export class Orbit {
  yaw = 0;
  pitch = 0;
  private spin = 0;
  private dragging: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private last = { x: 0, t: 0 };

  constructor(target: HTMLElement, onMove: () => void) {
    target.style.touchAction = 'pan-y';
    target.style.cursor = 'grab';
    target.addEventListener('pointerdown', (e) => {
      this.dragging = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch };
      this.last = { x: e.clientX, t: e.timeStamp };
      this.spin = 0;
      target.setPointerCapture(e.pointerId);
      target.style.cursor = 'grabbing';
    });
    target.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.yaw = this.dragging.yaw + (e.clientX - this.dragging.x) * DRAG;
      if (e.pointerType === 'mouse')
        this.pitch = clamp(
          this.dragging.pitch + (e.clientY - this.dragging.y) * DRAG,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        );
      const dt = Math.max(1, e.timeStamp - this.last.t) / 1000;
      this.spin = ((e.clientX - this.last.x) * DRAG) / dt;
      this.last = { x: e.clientX, t: e.timeStamp };
      onMove();
    });
    const release = () => {
      this.dragging = null;
      target.style.cursor = 'grab';
      onMove();
    };
    target.addEventListener('pointerup', release);
    target.addEventListener('pointercancel', release);
  }

  /** Lets a released spin coast to a stop; true while it's still turning. */
  step(dt: number): boolean {
    if (this.dragging) return true;
    if (Math.abs(this.spin) < 0.01) return false;
    this.yaw += this.spin * dt;
    this.spin *= Math.exp(-FRICTION * dt);
    return true;
  }
}

/** The one-time demonstration: unfold partway, hold, fold back. Seconds and fold amounts. */
const DEMO = { delay: 0.6, open: 1.1, hold: 0.5, close: 1.3, depth: 0.6 } as const;

export class FoldControl {
  value: number;
  private target: number;
  private demoStart: number | null = null;

  constructor(initial: number) {
    this.value = this.target = initial;
  }

  /** The slider moved: follow it, and never play the demonstration after that. */
  set(t: number) {
    this.target = clamp(t, 0, 1);
    this.demoStart = null;
  }

  /** Plays the demonstration once, from `now` (ms), if the visitor hasn't touched the slider. */
  demo(now: number) {
    if (this.target === 0) this.demoStart = now;
  }

  /** Advances to `now` (ms) by `dt` (s); true while the fold still moves. */
  step(now: number, dt: number): boolean {
    let goal = this.target;
    if (this.demoStart !== null) {
      const t = (now - this.demoStart) / 1000 - DEMO.delay;
      const { open, hold, close, depth } = DEMO;
      if (t >= open + hold + close) this.demoStart = null;
      else if (t > 0)
        goal =
          depth * (t < open ? ease(t / open) : t < open + hold ? 1 : 1 - ease((t - open - hold) / close));
    }
    this.value += (goal - this.value) * Math.min(1, dt * 7);
    if (Math.abs(goal - this.value) < 0.0005) this.value = goal;
    return this.demoStart !== null || this.value !== goal;
  }
}

/**
 * Watches frame times while the scene moves. After `SAMPLES` frames, if the median frame takes
 * longer than `SLOW_MS` (under about 30 frames a second), it calls `onSlow` once.
 */
const SAMPLES = 45;
const SLOW_MS = 34;

export class FrameProbe {
  private times: number[] = [];
  private last = 0;
  private done = false;

  constructor(private onSlow: () => void) {}

  frame(now: number) {
    if (this.done) return;
    if (this.last) this.times.push(now - this.last);
    this.last = now;
    if (this.times.length < SAMPLES) return;
    this.done = true;
    const sorted = [...this.times].sort((a, b) => a - b);
    if (sorted[Math.floor(sorted.length / 2)]! > SLOW_MS) this.onSlow();
  }

  /** The scene stopped moving: the next frame starts a new interval, not a long gap. */
  pause() {
    this.last = 0;
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const ease = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
