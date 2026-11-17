/**
 * M4's 3D fox and the identity scene behind it (21-m4-plan.md, decided in the demo derby). Loaded
 * with a dynamic import only when the Inspector opens on a page with the hero fox, on a device
 * that can run it (src/lib/scene3d-support.ts); its weight has its own budget (scene3d,
 * src/config/quality.ts).
 *
 * The SVG fox is the first frame (decision 25): the canvas takes over the same square once its
 * first frame is drawn, and hands it back when the Inspector closes. Inspecting runs one input q
 * per actor through Inspect's phases (inspectPhases, motion B): the fox's layers part, then the
 * active identity's scene rises behind it, then its details trace in. Changing identity while
 * inspecting exchanges the scenes: the old one sinks, the new one rises just behind it, and the
 * fox stays apart. Every pose comes from src/lib/fold3d.ts and src/lib/identity-scenes.ts.
 *
 * It renders only while something moves, then stops: a still scene costs nothing.
 */
import {
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { foxBrowY, foxCentreX, foxFacets, type Facet } from '../../lib/fox';
import { FOLD_ORDER, INSPECT_MS, LAYER_DEPTH, inspectPhases, pose, type Fold } from '../../lib/fold3d';
import { EXCHANGE_DELAY_MS } from '../../lib/identity-scenes';
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';
import { makeIdentityScene, type IdentityScene } from './identity-scenes3d';

export interface FoxScene {
  /** Runs Inspect's progress toward 1 (on) or back to 0 (off). */
  setInspecting(on: boolean): void;
  /** Brings everything back together, then hands the square back to the SVG and frees the GPU. */
  dispose(): void;
}

/** The camera looks slightly down on the fox, with the scene behind and below it. */
const CAMERA = { fov: 32, y: 0.25, z: 5.2, lookY: -0.25 };
/** A 3/4 view: a V fold seen face-on flattens out (teardown rule 6). */
const FOX = { scale: 0.62, y: 0.15, z: 0.6, yaw: -0.42, pitch: -0.1 };
/** The inner ear sits this far in front of its ear: the paper's thickness, so the two never fight. */
const INNER_LIFT = 0.004;
const UNIT = 1 / 24; // sheet units (48 wide) → scene units (2 wide)
const FADE_MS = 300;

const toScene = ([x, y]: readonly [number, number]) =>
  new Vector2((x - foxCentreX) * UNIT, (foxCentreX - y) * UNIT);

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

export function mountFoxScene(stage: HTMLElement): FoxScene {
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

  // ---------- The fox, from src/lib/fox.ts: the same facets as the SVG ----------
  const browY = (foxCentreX - foxBrowY) * UNIT;
  const fox = new Group();
  fox.scale.setScalar(FOX.scale);
  fox.position.set(0, FOX.y, FOX.z);
  fox.rotation.set(FOX.pitch, FOX.yaw, 0);
  scene.add(fox);
  const facetMesh = (f: Facet) => {
    const mesh = new Mesh(
      new ShapeGeometry(new Shape(f.points.map(toScene))),
      new MeshStandardMaterial({ side: DoubleSide, roughness: 0.92, metalness: 0, flatShading: true }),
    );
    mesh.add(
      new LineSegments(
        new EdgesGeometry(mesh.geometry),
        new LineBasicMaterial({ transparent: true, opacity: 0.25 }),
      ),
    );
    return mesh;
  };
  type Side = Facet['side'];
  const meshes = {} as Record<`${Fold}-${Side}`, Mesh>;
  const hinges: { side: Side }[] = [];
  const folded = pose(1);
  for (const side of ['left', 'right'] as const) {
    const head = new Group();
    const ear = new Group();
    const inner = new Group();
    ear.position.y = browY;
    for (const f of foxFacets.filter((x) => x.side === side)) {
      const mesh = (meshes[`${f.part}-${side}`] = facetMesh(f));
      if (f.part !== 'head') mesh.position.y = -browY;
      ({ head, ear, inner })[f.part].add(mesh);
    }
    ear.add(inner);
    head.add(ear);
    fox.add(head);
    // The fox stays folded; only its layers move.
    const sign = side === 'left' ? 1 : -1;
    head.rotation.y = (sign * folded.folds.head.degrees * Math.PI) / 180;
    ear.rotation.x = (-folded.folds.ear.degrees * Math.PI) / 180;
    inner.rotation.x = (folded.folds.inner.degrees * Math.PI) / 180;
    hinges.push({ side });
  }

  // ---------- The identity scenes: built when first shown ----------
  const world = new Group();
  scene.add(world);
  type Actor = { scene: IdentityScene; q: Progress };
  const actors = new Map<VisualDirection, Actor>();
  const actor = (id: VisualDirection) => {
    let a = actors.get(id);
    if (!a) {
      a = { scene: makeIdentityScene(id), q: new Progress() };
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
    const surface = css('--color-surface');
    const ink = css('--color-ink');
    const set = (key: `${Fold}-${Side}`, c: Color) =>
      (meshes[key].material as MeshStandardMaterial).color.copy(c);
    set('head-left', css('--color-accent'));
    set('head-right', ink);
    const ear = css('--color-accent-ui').lerp(surface, 0.25);
    set('ear-left', ear);
    set('ear-right', ear);
    set('inner-left', ink);
    set('inner-right', ink);
    for (const mesh of Object.values(meshes))
      ((mesh.children[0] as LineSegments).material as LineBasicMaterial).color.copy(ink);
    for (const a of actors.values()) a.scene.paint(css);
  }

  // ---------- Pose ----------
  const foxQ = new Progress();
  const base = new Vector3();
  const BASE_Y: Record<Fold, number> = { head: 0, ear: -browY, inner: -browY };
  function frame() {
    const layers = inspectPhases(foxQ.value).eased.layers;
    fox.updateMatrixWorld(true);
    for (const h of hinges)
      for (const part of FOLD_ORDER) {
        const mesh = meshes[`${part}-${h.side}`];
        base.set(0, BASE_Y[part], part === 'inner' ? INNER_LIFT : 0);
        mesh.parent!.localToWorld(base);
        fox.worldToLocal(base);
        base.z += LAYER_DEPTH[part] * layers;
        fox.localToWorld(base);
        mesh.parent!.worldToLocal(base);
        mesh.position.copy(base);
      }
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
    let moving = foxQ.step(now);
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
    foxQ.to(on ? 1 : 0, now);
    if (on) actor(direction).q.to(1, now);
    else for (const a of actors.values()) a.q.to(0, now);
    requestFrame();
  }

  // An identity change repaints everything; while inspecting, the scenes exchange.
  function onIdentity() {
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
      const settle = Math.max(foxQ.remaining(now), ...[...actors.values()].map((a) => a.q.remaining(now)));
      // Once everything is back together, the SVG takes the square again and the GPU is freed.
      setTimeout(() => {
        figure?.classList.remove('scene-3d');
        canvas.style.opacity = '0';
        themeWatch.disconnect();
        sizeWatch.disconnect();
        schemeQuery.removeEventListener('change', onIdentity);
        setTimeout(() => {
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        }, FADE_MS);
      }, settle);
    },
  };
}
