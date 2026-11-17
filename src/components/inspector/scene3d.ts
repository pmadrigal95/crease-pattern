/**
 * M4's 3D fox (21-m4-plan.md, decided in the demo derby). Loaded with a dynamic import only when
 * the Inspector opens on a page with the hero fox, on a device that can run it
 * (src/lib/scene3d-support.ts); its weight has its own budget (scene3d, src/config/quality.ts).
 *
 * The SVG fox is the first frame (decision 25): the canvas takes over the same square once its
 * first frame is drawn, and hands it back when the Inspector closes. Inspecting parts the fox into
 * its layers along its own depth (inspectPhases, motion B). Every pose comes from src/lib/fold3d.ts.
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

export interface FoxScene {
  /** Runs Inspect's progress q toward 1 (on) or back to 0 (off). */
  setInspecting(on: boolean): void;
  /** Brings the layers back together, then hands the square back to the SVG and frees the GPU. */
  dispose(): void;
}

/** A 3/4 view: a V fold seen face-on flattens out (teardown rule 6). */
const VIEW = { fov: 30, distance: 4.6, yaw: -0.42, pitch: -0.1 };
/** The inner ear sits this far in front of its ear: the paper's thickness, so the two never fight. */
const INNER_LIFT = 0.004;
const UNIT = 1 / 24; // sheet units (48 wide) → scene units (2 wide)
const FADE_MS = 300;

const toScene = ([x, y]: readonly [number, number]) =>
  new Vector2((x - foxCentreX) * UNIT, (foxCentreX - y) * UNIT);

export function mountFoxScene(stage: HTMLElement): FoxScene {
  const figure = stage.closest<HTMLElement>('[data-hero-fold]');
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(VIEW.fov, 1, 0.1, 50);
  camera.position.set(0, 0, VIEW.distance);
  scene.add(new HemisphereLight(0xffffff, 0x888888, 1.6));
  const sun = new DirectionalLight(0xffffff, 1.4);
  sun.position.set(-2, 3, 4);
  scene.add(sun);

  // ---------- The fox, from src/lib/fox.ts: the same facets as the SVG ----------
  const browY = (foxCentreX - foxBrowY) * UNIT;
  const fox = new Group();
  fox.rotation.set(VIEW.pitch, VIEW.yaw, 0);
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
  const hinges: { side: Side; head: Group; ear: Group; inner: Group }[] = [];
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
    hinges.push({ side, head, ear, inner });
  }

  // ---------- Colours: the active identity's tokens, repainted when they change ----------
  const css = (name: string) =>
    new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888');
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
    requestFrame();
  }
  const themeWatch = new MutationObserver(paint);
  themeWatch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme', 'class'],
  });
  const schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  schemeQuery.addEventListener('change', paint);

  // ---------- Pose: the fox stays folded; Inspect parts its layers ----------
  const base = new Vector3();
  const BASE_Y: Record<Fold, number> = { head: 0, ear: -browY, inner: -browY };
  function frame(q: number) {
    const folded = pose(1);
    for (const h of hinges) {
      const sign = h.side === 'left' ? 1 : -1;
      h.head.rotation.y = (sign * folded.folds.head.degrees * Math.PI) / 180;
      h.ear.rotation.x = (-folded.folds.ear.degrees * Math.PI) / 180;
      h.inner.rotation.x = (folded.folds.inner.degrees * Math.PI) / 180;
    }
    const layers = inspectPhases(q).eased.layers;
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
    renderer.render(scene, camera);
  }

  // ---------- Loop: only while q is moving ----------
  let q = 0;
  let target = 0;
  let from = 0;
  let start = 0;
  let duration = 0;
  let running = false;
  let shown = false;
  function tick(now: number) {
    const k = duration ? Math.min(1, (now - start) / duration) : 1;
    q = from + (target - from) * k;
    frame(q);
    if (!shown) {
      // First frame drawn: take over the square from the SVG.
      shown = true;
      canvas.style.opacity = '1';
      figure?.classList.add('scene-3d');
    }
    if (k < 1) requestAnimationFrame(tick);
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
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(stage);

  paint();
  resize();

  function setInspecting(on: boolean) {
    from = q;
    target = on ? 1 : 0;
    start = performance.now();
    duration = (on ? INSPECT_MS.enter : INSPECT_MS.exit) * Math.abs(target - from);
    requestFrame();
  }

  return {
    setInspecting,
    dispose() {
      setInspecting(false);
      // Once the layers are back together, the SVG takes the square again and the GPU is freed.
      setTimeout(() => {
        figure?.classList.remove('scene-3d');
        canvas.style.opacity = '0';
        themeWatch.disconnect();
        sizeWatch.disconnect();
        schemeQuery.removeEventListener('change', paint);
        setTimeout(() => {
          renderer.dispose();
          renderer.forceContextLoss();
          canvas.remove();
        }, FADE_MS);
      }, duration);
    },
  };
}
