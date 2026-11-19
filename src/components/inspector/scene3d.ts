/**
 * The hero's origami figure in 3D, and the identity scene behind it. Loaded with a dynamic import
 * only when the Inspector opens on a page with the hero, on a device that can run it
 * (src/lib/scene3d-support.ts); its weight has its own budget (scene3d, src/config/quality.ts).
 *
 * The SVG figure is the first frame (decision 25): the canvas takes over the same square once its
 * first frame is drawn, and hands it back when the Inspector closes. The figure is the one of the
 * visitor's identity and theme (src/lib/origami/marks.ts), folded for real: every facet turns on
 * its hinge (src/lib/origami/hinge.ts), so changing identity or theme unfolds it to its crease
 * pattern and folds the next figure from the sheet. Inspecting takes it apart, tips first (the
 * teardown), while the identity's scene rises behind it (inspectPhases, motion B).
 *
 * It renders only while something moves, then stops: a still scene costs nothing.
 */
import {
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { INSPECT_MS, inspectPhases } from '../../lib/fold3d';
import { EXCHANGE_DELAY_MS } from '../../lib/identity-scenes';
import type { ModelId } from '../../lib/origami/models';
import { modelFor } from '../../lib/origami/marks';
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';
import { makeIdentityScene, type IdentityScene } from './identity-scenes3d';
import { isDark, makeFigure, type Css, type Figure } from './origami-figure3d';
import { FoldControl, FrameProbe, Orbit } from './hero-motion';

export interface FigureScene {
  /** Runs Inspect's progress toward 1 (on) or back to 0 (off). */
  setInspecting(on: boolean): void;
  /** The hero slider's fold: 0 the figure, 1 its crease pattern. */
  setFold(t: number): void;
  /** Brings everything back together, then hands the square back to the SVG and frees the GPU. */
  dispose(): void;
}

/** The camera looks slightly down on the figure, with the scene behind and below it. */
const CAMERA = { fov: 32, y: 0.25, z: 5.2, lookY: -0.25 };
/** A 3/4 view: a V fold seen face-on flattens out (teardown rule 6). */
const FIGURE = { scale: 0.55, y: 0.2, z: 0.6, yaw: -0.55, pitch: 0.12 };
/** In the hero, alone, the figure fills the square where the SVG drew it, so the hand-over doesn't jump. */
const HERO = { scale: 0.8, x: -0.18, y: -0.62 };
/** Unfolding to the sheet, and folding the next figure from it. */
const REFOLD_MS = { unfold: 1500, fold: 1800 };
const FADE_MS = 300;

/** One input in [0, 1] moving toward a target: entering takes INSPECT_MS.enter, leaving .exit. */
class Progress {
  value = 0;
  private from = 0;
  private target = 0;
  private start = 0;
  private ms = 0;
  to(target: number, now: number, delay = 0) {
    this.from = this.value;
    this.target = target;
    this.start = now + delay;
    this.ms = (target > this.value ? INSPECT_MS.enter : INSPECT_MS.exit) * Math.abs(target - this.value);
  }
  /** Advances to `now`; true while still moving. */
  step(now: number) {
    const k = this.ms ? Math.min(1, Math.max(0, (now - this.start) / this.ms)) : 1;
    this.value = this.from + (this.target - this.from) * k;
    return k < 1;
  }
  /** How long until it settles, from `now`. */
  remaining(now: number) {
    return Math.max(0, this.start + this.ms - now);
  }
}

/**
 * Changing figure: the shown one unfolds to the sheet, then the next folds from it. One value u
 * (0 folded … 1 flat) and the figure waiting for the sheet; a new request while it runs only
 * changes which figure that is.
 */
class Refold {
  u = 0;
  private from = 0;
  private to = 0;
  private start = 0;
  private ms = 0;
  private next: ModelId | null = null;
  constructor(public shown: ModelId) {}
  request(id: ModelId, now: number) {
    if (this.next) this.next = id;
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

const currentDirection = (): VisualDirection => {
  const id = document.documentElement.getAttribute('data-direction');
  return (allVisualDirections as string[]).includes(id ?? '') ? (id as VisualDirection) : 'contour-lines';
};

/** The page's colour tokens, as three.js colours. */
const css: Css = (name) =>
  new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888');

/** The canvas over the hero's square, its renderer, the camera and the lights. */
function createStage(stage: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // CSSOM, which the Content Security Policy allows; no inline style attribute.
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    opacity: '0',
    transition: `opacity ${FADE_MS}ms ease-out`,
  });
  stage.append(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  // Sharp on a laptop, but never the full cost of a 3× phone or a 4K monitor.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 60);
  camera.position.set(0, CAMERA.y, CAMERA.z);
  camera.lookAt(0, CAMERA.lookY, 0);
  // Soft light: the facets already carry their own shades (marks.ts ROLE_MIX), as in the SVG; a hard
  // light on top would darken them twice, to grey.
  scene.add(new HemisphereLight(0xffffff, 0xb4b4b4, 1.9));
  const sun = new DirectionalLight(0xffffff, 0.9);
  sun.position.set(-3, 4, 3);
  scene.add(sun);
  return { canvas, renderer, scene, camera };
}

/** The figure on stage, and the swap that replaces it with another, flat on the floor. */
function figureSlot(holder: Group, first: ModelId) {
  let shape: Figure = makeFigure(first);
  holder.add(shape.group);
  return {
    figure: () => shape,
    swap(id: ModelId) {
      holder.remove(shape.group);
      shape.dispose();
      shape = makeFigure(id);
      shape.paint(css);
      holder.add(shape.group);
    },
  };
}

/** Where the figure stands: a 3/4 view, in front of the identity scene. */
function figureHolder(scene: Scene) {
  const holder = new Group();
  holder.position.z = FIGURE.z;
  scene.add(holder);
  return holder;
}

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Frames the figure for Inspect's progress q: alone in the hero at 0, smaller in front of its
 * identity scene at 1. The scene fades into the page at the square's edges (a mask) only while it's
 * there; the figure alone needs no edge.
 */
function frame(holder: Group, canvas: HTMLCanvasElement, q: number, turn: { yaw: number; pitch: number }) {
  const k = q * q * (3 - 2 * q);
  holder.scale.setScalar(mix(HERO.scale, FIGURE.scale, k));
  holder.position.x = mix(HERO.x, 0, k);
  holder.position.y = mix(HERO.y, FIGURE.y, k);
  holder.rotation.set(FIGURE.pitch + turn.pitch, FIGURE.yaw + turn.yaw, 0);
  // The opaque core grows past the corners (141% of closest-side) as q goes to 0, so the mask
  // comes and goes without a visible step.
  const edge =
    q < 0.001
      ? 'none'
      : `radial-gradient(closest-side, #000 ${mix(150, 70, k)}%, transparent ${mix(180, 100, k)}%)`;
  if (canvas.style.maskImage !== edge) {
    canvas.style.maskImage = edge;
    canvas.style.webkitMaskImage = edge;
  }
}

/** The identity scenes behind the figure, each built the first time it's shown. */
function identityActors(world: Group, requestFrame: () => void) {
  const actors = new Map<VisualDirection, { scene: IdentityScene; q: Progress }>();
  const actor = (id: VisualDirection) => {
    let a = actors.get(id);
    if (!a) {
      a = { scene: makeIdentityScene(id, requestFrame), q: new Progress() };
      a.scene.group.visible = false;
      a.scene.paint(css);
      world.add(a.scene.group);
      actors.set(id, a);
    }
    return a;
  };
  return { actors, actor };
}

/**
 * Draws only while something moves, then stops: a still scene costs nothing. `step(now)` advances
 * everything and draws one frame; it returns true while anything is still moving.
 */
function frameLoop(step: (now: number) => boolean) {
  let running = false;
  const tick = () => {
    // The same clock the tweens started on (a frame's own timestamp can run on another time base).
    if (step(performance.now())) requestAnimationFrame(tick);
    else running = false;
  };
  return () => {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };
}

/** Calls `onChange` when the identity, the theme or the system's colour scheme changes. */
function watchIdentity(onChange: () => void) {
  const attributes = new MutationObserver(onChange);
  attributes.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme', 'class'],
  });
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  scheme.addEventListener('change', onChange);
  return () => {
    attributes.disconnect();
    scheme.removeEventListener('change', onChange);
  };
}

/**
 * Once everything is back together (after `settle` ms), the SVG takes the square again; after its
 * fade, the GPU is freed. `stops` end the scene's watchers.
 */
function handBack(
  settle: number,
  parts: {
    hero: HTMLElement | null;
    canvas: HTMLCanvasElement;
    renderer: WebGLRenderer;
    figure: () => Figure;
  },
  stops: (() => void)[],
) {
  setTimeout(() => {
    parts.hero?.classList.remove('scene-3d');
    parts.canvas.style.opacity = '0';
    for (const stop of stops) stop();
    setTimeout(() => {
      parts.figure().dispose();
      parts.renderer.dispose();
      parts.renderer.forceContextLoss();
      parts.canvas.remove();
    }, FADE_MS);
  }, settle);
}

/**
 * The visitor's hands on the figure: dragging turns it, the slider folds it, and frames are timed
 * while it moves. Only while the hero is on screen does any of it ask for frames.
 */
function handsOn(
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  requestFrame: () => void,
  onSlow: () => void,
) {
  const hero = stage.closest<HTMLElement>('[data-hero-fold]');
  const orbit = new Orbit(canvas, requestFrame);
  // Pick up wherever the slider already is (the SVG followed it until now).
  const fold = new FoldControl(Number(hero?.style.getPropertyValue('--fold')) || 0);
  hero?.addEventListener('hero-fold', (e) => {
    fold.set((e as CustomEvent<number>).detail);
    requestFrame();
  });
  const probe = new FrameProbe(onSlow);
  let onScreen = true;
  const sight = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
    if (onScreen) requestFrame();
  });
  sight.observe(stage);
  /**
   * Whether to draw another frame. Only the hero's own frames are timed: the scene never disappears
   * from under an open Inspector.
   */
  const next = (now: number, moving: boolean, heroOnly: boolean) => {
    const goOn = moving && onScreen;
    if (goOn && heroOnly) probe.frame(now);
    else probe.pause();
    return goOn;
  };
  return { orbit, fold, next, stop: () => sight.disconnect() };
}

export function mountFigureScene(stage: HTMLElement, onSlow: () => void = () => {}): FigureScene {
  const hero = stage.closest<HTMLElement>('[data-hero-fold]');
  const { canvas, renderer, scene, camera } = createStage(stage);
  const holder = figureHolder(scene);
  const refold = new Refold(modelFor(currentDirection(), isDark()));
  const slot = figureSlot(holder, refold.shown);
  const world = new Group();
  scene.add(world);
  // Scenes ask for frames while their details draw in; the loop is set up below.
  const { actors, actor } = identityActors(world, () => requestFrame());
  let direction = currentDirection();
  const figureQ = new Progress();
  const paint = () => {
    slot.figure().paint(css);
    for (const a of actors.values()) a.scene.paint(css);
  };

  // ---------- Loop: only while something moves, and the hero is on screen ----------
  let shown = false;
  let inspecting = false;
  let last = performance.now();
  const hands = handsOn(stage, canvas, () => requestFrame(), onSlow);
  const requestFrame = frameLoop((now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    let moving = figureQ.step(now);
    moving = refold.step(now, slot.swap) || moving;
    moving = hands.fold.step(now, dt) || moving;
    moving = hands.orbit.step(dt) || moving;
    for (const a of actors.values()) moving = a.q.step(now) || moving;
    frame(holder, canvas, figureQ.value, hands.orbit);
    slot.figure().pose(Math.max(refold.u, hands.fold.value), inspectPhases(figureQ.value).eased.layers);
    for (const a of actors.values()) {
      a.scene.group.visible = a.q.value > 0.001;
      if (a.scene.group.visible) a.scene.update(inspectPhases(a.q.value), 1);
    }
    renderer.render(scene, camera);
    if (!shown) {
      // First frame drawn: take over the square from the SVG, and show once that it unfolds.
      shown = true;
      canvas.style.opacity = '1';
      hero?.classList.add('scene-3d');
      hands.fold.demo(now);
      moving = true;
    }
    return hands.next(now, moving, figureQ.value === 0 && !inspecting);
  });
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestFrame();
  }

  function setInspecting(on: boolean) {
    inspecting = on;
    const now = performance.now();
    figureQ.to(on ? 1 : 0, now);
    if (on) actor(direction).q.to(1, now);
    else for (const a of actors.values()) a.q.to(0, now);
    requestFrame();
  }

  // An identity or theme change repaints everything and, when the figure changes, refolds it from
  // the sheet; while inspecting, the identity scenes exchange.
  function onIdentity() {
    const now = performance.now();
    refold.request(modelFor(currentDirection(), isDark()), now);
    const next = currentDirection();
    if (next !== direction) {
      actors.get(direction)?.q.to(0, now); // the old scene sinks (exit)
      direction = next;
      if (inspecting) actor(next).q.to(1, now, EXCHANGE_DELAY_MS); // the new one rises just behind
    }
    paint();
    requestFrame();
  }
  const unwatch = watchIdentity(onIdentity);
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(stage);
  paint();
  resize();

  return {
    setInspecting,
    setFold(t: number) {
      hands.fold.set(t);
      requestFrame();
    },
    dispose() {
      setInspecting(false);
      refold.cancel();
      const now = performance.now();
      const settle = Math.max(figureQ.remaining(now), ...[...actors.values()].map((a) => a.q.remaining(now)));
      handBack(settle, { hero, canvas, renderer, figure: slot.figure }, [
        unwatch,
        hands.stop,
        () => sizeWatch.disconnect(),
      ]);
    },
  };
}
