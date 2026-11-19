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

export interface FigureScene {
  /** Runs Inspect's progress toward 1 (on) or back to 0 (off). */
  setInspecting(on: boolean): void;
  /** Brings everything back together, then hands the square back to the SVG and frees the GPU. */
  dispose(): void;
}

/** The camera looks slightly down on the figure, with the scene behind and below it. */
const CAMERA = { fov: 32, y: 0.25, z: 5.2, lookY: -0.25 };
/** A 3/4 view: a V fold seen face-on flattens out (teardown rule 6). */
const FIGURE = { scale: 0.55, y: 0.2, z: 0.6, yaw: -0.55, pitch: 0.12 };
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
  // CSSOM, which the Content Security Policy allows; no inline style attribute. The mask lets the
  // scene fade into the page at the square's edges instead of stopping at a hard line.
  const edge = 'radial-gradient(closest-side, #000 70%, transparent 100%)';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    opacity: '0',
    transition: `opacity ${FADE_MS}ms ease-out`,
    maskImage: edge,
    webkitMaskImage: edge,
  });
  stage.append(canvas);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 60);
  camera.position.set(0, CAMERA.y, CAMERA.z);
  camera.lookAt(0, CAMERA.lookY, 0);
  scene.add(new HemisphereLight(0xffffff, 0x777777, 1.5));
  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(-3, 4, 3);
  scene.add(sun);
  return { canvas, renderer, scene, camera };
}

/** Where the figure stands: a 3/4 view, in front of the identity scene. */
function figureHolder(scene: Scene) {
  const holder = new Group();
  holder.scale.setScalar(FIGURE.scale);
  holder.position.set(0, FIGURE.y, FIGURE.z);
  holder.rotation.set(FIGURE.pitch, FIGURE.yaw, 0);
  scene.add(holder);
  return holder;
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

export function mountFigureScene(stage: HTMLElement): FigureScene {
  const hero = stage.closest<HTMLElement>('[data-hero-fold]');
  const { canvas, renderer, scene, camera } = createStage(stage);
  const holder = figureHolder(scene);
  const refold = new Refold(modelFor(currentDirection(), isDark()));
  let shape: Figure = makeFigure(refold.shown);
  holder.add(shape.group);
  const swap = (id: ModelId) => {
    holder.remove(shape.group);
    shape.dispose();
    shape = makeFigure(id);
    shape.paint(css);
    holder.add(shape.group);
  };
  const world = new Group();
  scene.add(world);
  // Scenes ask for frames while their details draw in; the loop is set up below.
  const { actors, actor } = identityActors(world, () => requestFrame());
  let direction = currentDirection();
  const figureQ = new Progress();
  const paint = () => {
    shape.paint(css);
    for (const a of actors.values()) a.scene.paint(css);
  };

  // ---------- Loop: only while something moves ----------
  let shown = false;
  const requestFrame = frameLoop((now) => {
    let moving = figureQ.step(now);
    moving = refold.step(now, swap) || moving;
    for (const a of actors.values()) moving = a.q.step(now) || moving;
    shape.pose(refold.u, inspectPhases(figureQ.value).eased.layers);
    for (const a of actors.values()) {
      a.scene.group.visible = a.q.value > 0.001;
      if (a.scene.group.visible) a.scene.update(inspectPhases(a.q.value), 1);
    }
    renderer.render(scene, camera);
    if (!shown) {
      // First frame drawn: take over the square from the SVG.
      shown = true;
      canvas.style.opacity = '1';
      hero?.classList.add('scene-3d');
    }
    return moving;
  });
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    requestFrame();
  }

  let inspecting = false;
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
    dispose() {
      setInspecting(false);
      refold.cancel();
      const now = performance.now();
      const settle = Math.max(figureQ.remaining(now), ...[...actors.values()].map((a) => a.q.remaining(now)));
      // Once everything is back together, the SVG takes the square again and the GPU is freed.
      setTimeout(() => {
        hero?.classList.remove('scene-3d');
        canvas.style.opacity = '0';
        unwatch();
        sizeWatch.disconnect();
        setTimeout(() => {
          shape.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        }, FADE_MS);
      }, settle);
    },
  };
}
