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
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { INSPECT_MS, inspectPhases, stateToState } from '../../lib/fold3d';
import { creases, foldMatrices, posed } from '../../lib/origami/hinge';
import { models, type ModelId } from '../../lib/origami/models';
import { EDGE_MIX, FROG_EYE, ROLE_MIX, facetRole, modelFor } from '../../lib/origami/marks';
import { EXCHANGE_DELAY_MS } from '../../lib/identity-scenes';
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';
import { makeIdentityScene, type IdentityScene } from './identity-scenes3d';

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
/** The figures' floor, in their own units (src/lib/origami/models.ts). */
const FLOOR = -1.2;
/** Unfolding to the sheet, and folding the next figure from it. */
const REFOLD_MS = { unfold: 1500, fold: 1800 };
/** How far each facet steps out when the figure is taken apart, in figure units. */
const TEARDOWN = 0.3;
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

const currentDirection = (): VisualDirection => {
  const id = document.documentElement.getAttribute('data-direction');
  return (allVisualDirections as string[]).includes(id ?? '') ? (id as VisualDirection) : 'contour-lines';
};

/** Dark: chosen, or the system's when the visitor hasn't chosen (the same rule as origami.css). */
const isDark = () => {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

type Css = (name: string) => Color;

/** One figure on stage: its paper, its crease lines, and how to draw it at a fold and a teardown. */
function makeFigure(id: ModelId) {
  const { fold, tags } = models[id];
  const n = fold.faces.length;
  const position = new Float32Array(n * 9);
  const colour = new Float32Array(n * 9);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colour, 3));
  // The morpho's blue is structural: it shifts with the angle, like an iridescent film. The rest is paper.
  tags.forEach((tag, i) => geometry.addGroup(i * 3, 3, tag === 'wing' ? 1 : 0));
  const paper = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.86,
    side: DoubleSide,
  });
  const wing = new MeshPhysicalMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.15,
    iridescence: 1,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [250, 520],
    clearcoat: 0.3,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, [paper, wing]);
  const mountain = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ transparent: true }));
  const valley = new LineSegments(
    new BufferGeometry(),
    new LineDashedMaterial({ transparent: true, dashSize: 0.07, gapSize: 0.05 }),
  );
  const group = new Group();
  group.add(mesh, mountain, valley);
  const centre = fold.points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(fold.points.length);
  const out = new Vector3();
  const positionAttr = geometry.getAttribute('position');
  const colourAttr = geometry.getAttribute('color');
  return {
    group,
    paint(css: Css) {
      // Paper is light in every theme, and shades toward ink by day, the background by night
      // (the same rule as --origami-paper and --origami-dark in src/styles/origami.css).
      const night = isDark();
      const surface = night ? css('--color-surface').lerp(css('--color-ink'), 0.9) : css('--color-surface');
      const dark = night ? css('--color-bg') : css('--color-ink');
      const accent = css('--color-accent');
      const mixes: Record<string, Color> = {
        light: surface.clone().lerp(accent, ROLE_MIX.light),
        mid: surface.clone().lerp(accent, ROLE_MIX.mid),
        shade: surface.clone().lerp(accent, ROLE_MIX.shade),
        deep: surface.clone().lerp(accent, ROLE_MIX.deep),
        accent: id === 'frog' ? new Color(FROG_EYE) : accent,
        wing: css('--color-accent-ui'),
        edge: accent.clone().lerp(dark, EDGE_MIX),
      };
      for (let i = 0; i < n; i++) {
        const c = mixes[facetRole(id, i)]!;
        for (let k = 0; k < 3; k++) colourAttr.setXYZ(i * 3 + k, c.r, c.g, c.b);
      }
      colourAttr.needsUpdate = true;
      const line = css('--color-accent-ui');
      mountain.material.color.copy(line);
      valley.material.color.copy(line);
    },
    /** u: 0 folded … 1 its crease pattern; apart: 0 whole … 1 taken apart. */
    pose(u: number, apart: number) {
      const M = foldMatrices(fold, u, FLOOR);
      for (let i = 0; i < n; i++) {
        // The teardown: tips first, every facet steps straight out from the body, a short even step.
        const k = Math.min(
          1,
          Math.max(0, (apart * (fold.maxDepth + 2) - (fold.maxDepth - fold.depth[i]!)) / 2),
        );
        const corners = posed(fold, M, i);
        const mid = corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3);
        out
          .copy(mid)
          .sub(centre)
          .normalize()
          .multiplyScalar(TEARDOWN * stateToState(k));
        corners.forEach((p, c) => positionAttr.setXYZ(i * 3 + c, p.x + out.x, p.y + out.y, p.z + out.z));
      }
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const lines = { mountain: [] as number[], valley: [] as number[] };
      for (const { kind, a, b } of creases(fold, M))
        lines[kind].push(a.x, a.y + 0.003, a.z, b.x, b.y + 0.003, b.z);
      mountain.geometry.setAttribute('position', new Float32BufferAttribute(lines.mountain, 3));
      valley.geometry.setAttribute('position', new Float32BufferAttribute(lines.valley, 3));
      valley.computeLineDistances();
      // The crease pattern shows as the sheet lies open.
      const shown = Math.max(0, (u - 0.55) / 0.45);
      mountain.visible = valley.visible = shown > 0.01;
      mountain.material.opacity = valley.material.opacity = shown;
    },
    dispose() {
      geometry.dispose();
      paper.dispose();
      wing.dispose();
      mountain.geometry.dispose();
      valley.geometry.dispose();
    },
  };
}
type Figure = ReturnType<typeof makeFigure>;

export function mountFigureScene(stage: HTMLElement): FigureScene {
  const figure = stage.closest<HTMLElement>('[data-hero-fold]');
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

  // ---------- The figure: the identity's, folded for real ----------
  const holder = new Group();
  holder.scale.setScalar(FIGURE.scale);
  holder.position.set(0, FIGURE.y, FIGURE.z);
  holder.rotation.set(FIGURE.pitch, FIGURE.yaw, 0);
  scene.add(holder);
  let shownId = modelFor(currentDirection(), isDark());
  let shape: Figure = makeFigure(shownId);
  holder.add(shape.group);
  /** Unfolding to the sheet and folding the next figure: one value u, and where it's heading. */
  const refold = { u: 0, from: 0, to: 0, start: 0, ms: 0, next: null as ModelId | null };

  // ---------- The identity scenes: built when first shown ----------
  const world = new Group();
  scene.add(world);
  type Actor = { scene: IdentityScene; q: Progress };
  const actors = new Map<VisualDirection, Actor>();
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
  let direction = currentDirection();

  // ---------- Colours: the active identity's tokens, repainted when they change ----------
  function css(name: string) {
    return new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888');
  }
  function paint() {
    shape.paint(css);
    for (const a of actors.values()) a.scene.paint(css);
  }

  // ---------- Pose ----------
  const figureQ = new Progress();
  /** Steps the refold to `now`; true while it moves. At the sheet, the next figure takes over. */
  function stepRefold(now: number) {
    if (!refold.ms) return false;
    const k = Math.min(1, Math.max(0, (now - refold.start) / refold.ms));
    refold.u = refold.from + (refold.to - refold.from) * k;
    if (k < 1) return true;
    refold.ms = 0;
    if (refold.next) {
      // Flat on the floor, every figure is the same kind of thing: a sheet. Swap, then fold.
      holder.remove(shape.group);
      shape.dispose();
      shownId = refold.next;
      shape = makeFigure(shownId);
      shape.paint(css);
      holder.add(shape.group);
      refold.next = null;
      Object.assign(refold, { from: 1, to: 0, start: now, ms: REFOLD_MS.fold });
      return true;
    }
    return false;
  }
  function frame() {
    shape.pose(refold.u, inspectPhases(figureQ.value).eased.layers);
    for (const a of actors.values()) {
      a.scene.group.visible = a.q.value > 0.001;
      if (a.scene.group.visible) a.scene.update(inspectPhases(a.q.value), 1);
    }
    renderer.render(scene, camera);
  }

  // ---------- Loop: only while something moves ----------
  let running = false;
  let shown = false;
  function tick() {
    // The same clock the tweens started on (a frame's own timestamp can run on another time base).
    const now = performance.now();
    let moving = figureQ.step(now);
    moving = stepRefold(now) || moving;
    for (const a of actors.values()) moving = a.q.step(now) || moving;
    frame();
    if (!shown) {
      // First frame drawn: take over the square from the SVG.
      shown = true;
      canvas.style.opacity = '1';
      figure?.classList.add('scene-3d');
    }
    if (moving) requestAnimationFrame(tick);
    else running = false;
  }
  function requestFrame() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }
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
    const wanted = modelFor(currentDirection(), isDark());
    if (refold.next) refold.next = wanted;
    else if (wanted !== shownId) {
      refold.next = wanted;
      Object.assign(refold, {
        from: refold.u,
        to: 1,
        start: performance.now(),
        ms: REFOLD_MS.unfold * (1 - refold.u),
      });
    }
    const next = currentDirection();
    if (next !== direction) {
      const now = performance.now();
      actors.get(direction)?.q.to(0, now); // the old scene sinks (exit)
      direction = next;
      if (inspecting) actor(next).q.to(1, now, EXCHANGE_DELAY_MS); // the new one rises just behind
    }
    paint();
    requestFrame();
  }
  const themeWatch = new MutationObserver(onIdentity);
  themeWatch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme', 'class'],
  });
  const schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  schemeQuery.addEventListener('change', onIdentity);
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(stage);

  paint();
  resize();

  return {
    setInspecting,
    dispose() {
      setInspecting(false);
      const now = performance.now();
      refold.next = null;
      const settle = Math.max(figureQ.remaining(now), ...[...actors.values()].map((a) => a.q.remaining(now)));
      // Once everything is back together, the SVG takes the square again and the GPU is freed.
      setTimeout(() => {
        figure?.classList.remove('scene-3d');
        canvas.style.opacity = '0';
        themeWatch.disconnect();
        sizeWatch.disconnect();
        schemeQuery.removeEventListener('change', onIdentity);
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
