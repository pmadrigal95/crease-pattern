/**
 * The hero's origami figure in 3D, and the identity scene behind it. Loaded with a dynamic import
 * only when the Inspector opens on a page with the hero, on a device that can run it
 * (src/lib/scene3d-support.ts); its weight has its own budget (scene3d, src/config/quality.ts).
 *
 * The SVG figure is the first frame (decision 25): the canvas takes over the same square once its
 * first frame is drawn, and hands it back when the Inspector closes. The figure is the one of the
 * visitor's identity and theme (src/lib/origami/marks.ts), folded for real: every facet turns on
 * its hinge (src/lib/origami/hinge.ts), so changing identity or theme unfolds it to its crease
 * pattern and folds the next figure from the sheet. In the hero it is drawn as the SVG draws it
 * and rests at the SVG's view; inspecting, it turns to lit paper and comes apart, tips first (the
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
import { CAMERA, drawFigure, mask, type Framed } from './figure-framing';
import { FoldControl, FrameProbe, Orbit } from './hero-motion';

export interface FigureScene {
  /** Runs Inspect's progress toward 1 (on) or back to 0 (off). */
  setInspecting(on: boolean): void;
  /** The hero slider's fold: 0 the figure, 1 its crease pattern. */
  setFold(t: number): void;
  /** Brings everything back together, then hands the square back to the SVG and frees the GPU. */
  dispose(): void;
}

/** A 3/4 view: a V fold seen face-on flattens out (teardown rule 6). */
const FIGURE_Z = 0.6;
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
const createStage = (stage: HTMLElement) => {
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
};

/** The figure on stage, and the swap that replaces it with another, flat on the floor. */
const figureSlot = (holder: Group, first: ModelId) => {
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
};

/** Where the figure stands: a 3/4 view, in front of the identity scene. */
const figureHolder = (scene: Scene) => {
  const holder = new Group();
  holder.position.z = FIGURE_Z;
  scene.add(holder);
  return holder;
};

/** The identity scenes behind the figure, each built the first time it's shown. */
const identityActors = (world: Group, requestFrame: () => void) => {
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
};

/** The identity scenes at their progress: hidden at rest, rising and tracing in as they enter. */
const drawActors = (actors: ReturnType<typeof identityActors>['actors']) => {
  for (const a of actors.values()) {
    a.scene.group.visible = a.q.value > 0.001;
    if (a.scene.group.visible) a.scene.update(inspectPhases(a.q.value), 1);
  }
};

/**
 * Draws only while something moves, then stops: a still scene costs nothing. `step(now)` advances
 * everything and draws one frame; it returns true while anything is still moving.
 */
const frameLoop = (step: (now: number) => boolean) => {
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
};

/** Calls `onChange` when the identity, the theme or the system's colour scheme changes. */
const watchIdentity = (onChange: () => void) => {
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
};

/**
 * Once everything is back together (after `settle` ms), the SVG takes the square again; after its
 * fade, the GPU is freed. `stops` end the scene's watchers.
 */
const handBack = (
  settle: number,
  parts: {
    hero: HTMLElement | null;
    canvas: HTMLCanvasElement;
    renderer: WebGLRenderer;
    figure: () => Figure;
  },
  stops: (() => void)[],
) => {
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
};

/**
 * The visitor's hands on the figure: dragging turns it, the slider folds it, and frames are timed
 * while it moves. Only while the hero is on screen does any of it ask for frames.
 */
const handsOn = (
  stage: HTMLElement,
  canvas: HTMLCanvasElement,
  requestFrame: () => void,
  onSlow: () => void,
) => {
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
};

export const mountFigureScene = (stage: HTMLElement, onSlow: () => void = () => {}): FigureScene => {
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
  /** The hero framing, eased toward each frame's target. */
  const framed: Framed = { scale: 1, x: 0, y: 0 };
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
    const ease = shown ? Math.min(1, dt * 12) : 1;
    drawFigure(holder, slot.figure(), framed, {
      id: refold.shown,
      q: figureQ.value,
      refold: refold.u,
      hands,
      ease,
    });
    mask(canvas, figureQ.value);
    drawActors(actors);
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
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestFrame();
  };

  const setInspecting = (on: boolean) => {
    inspecting = on;
    const now = performance.now();
    figureQ.to(on ? 1 : 0, now);
    if (on) actor(direction).q.to(1, now);
    else for (const a of actors.values()) a.q.to(0, now);
    requestFrame();
  };

  // An identity or theme change repaints everything and, when the figure changes, refolds it from
  // the sheet; while inspecting, the identity scenes exchange.
  const onIdentity = () => {
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
  };
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
};
