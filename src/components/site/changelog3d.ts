/**
 * The career's places as paper models of their real terrain, over the map at the top of
 * /changelog (ExpeditionMap.astro), on a wide screen whose device can run it
 * (src/lib/scene3d-support.ts). Geometry and data in src/lib/relief.ts; this file draws them with
 * three.js, shared with the home page's scenes and counted with them in the scene3d budget.
 *
 * Flat facets, as folded paper, with the sharper folds drawn faintly; the cut edges a shade darker. A
 * flag walks the route; dragging, the slider or its keys (arrows, Page Up and Page Down) move it,
 * the camera follows, and the readout above names the place it's on. On arrival it climbs from
 * base camp to the Irazú, now. It draws only while something moves; the colours follow the
 * identity and the theme.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Fog,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  RELIEF,
  columnX,
  heightOf,
  metresAt,
  pointAt,
  progressAt,
  relief,
  rowZ,
  tileAt,
  type Relief,
  type ReliefTile,
} from '../../lib/relief';
import cartagoUrl from '../../assets/scenes/cartago-dem.bin?url';
import poasUrl from '../../assets/scenes/poas-dem.bin?url';
import turrialbaUrl from '../../assets/scenes/turrialba-dem.bin?url';
import irazuUrl from '../../assets/scenes/irazu-dem.bin?url';

/** The grids, in the order of the career: base camp, Poás, Turrialba, Irazú. */
const GRIDS = [cartagoUrl, poasUrl, turrialbaUrl, irazuUrl];
const CAMERA = { fov: 34, height: 42, distance: 62, side: -8, follow: 0.4, ease: 0.08 };
const CLIMB_MS = 5200;
const CREASE = 14;
const FADE_MS = 400;

const load = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`relief: ${r.status}`))))
    .then((b) => new Uint16Array(b));

/** The page's colour tokens, as three.js colours. */
const token = (name: string) =>
  new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888');
const palette = () => ({
  paper: token('--color-surface'),
  accent: token('--color-accent-ui'),
  ink: token('--color-ink'),
  bg: token('--color-bg'),
});
type Palette = ReturnType<typeof palette>;

/** The canvas in the stage, its renderer, the camera and the lights. */
const createStage = (stage: HTMLElement) => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  // Sharp on a laptop, but never the full cost of a 4K monitor.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  // CSSOM, which the Content Security Policy allows; no inline style attribute.
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    opacity: '0',
    transition: `opacity ${FADE_MS}ms ease-out`,
  });
  stage.prepend(canvas);
  const scene = new Scene();
  scene.fog = new Fog(0xffffff, 110, 240);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 400);
  const sky = new HemisphereLight(0xffffff, 0x808080, 1.25);
  const sun = new DirectionalLight(0xffffff, 2.1);
  sun.position.set(-40, 50, 30);
  scene.add(sky, sun);
  return { renderer, canvas, scene, camera, sky };
};

/** One place as a paper model: its terrain in flat facets, its outer ring cut down to the slab. */
const buildTile = (tile: ReliefTile) => {
  const n = RELIEF.size;
  const plane = new PlaneGeometry(RELIEF.tile, RELIEF.tile, n + 1, n + 1);
  const p = plane.getAttribute('position');
  for (let k = 0; k < p.count; k++) {
    const r = Math.floor(k / (n + 2));
    const c = k % (n + 2);
    const edge = r === 0 || c === 0 || r === n + 1 || c === n + 1;
    const rr = Math.min(n - 1, Math.max(0, r - 1));
    const cc = Math.min(n - 1, Math.max(0, c - 1));
    p.setXYZ(k, columnX(tile, cc), edge ? tile.base : heightOf(metresAt(tile, rr, cc)), rowZ(rr));
  }
  const flat = plane.toNonIndexed();
  plane.dispose();
  flat.computeVertexNormals();
  flat.setAttribute(
    'color',
    new BufferAttribute(new Float32Array(flat.getAttribute('position').count * 3), 3),
  );
  const mesh = new Mesh(
    flat,
    new MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: DoubleSide }),
  );
  // Only the real folds: facets that meet at more than CREASE degrees, as a paper model's creases.
  const creases = new LineSegments(
    new EdgesGeometry(flat, CREASE),
    new LineBasicMaterial({ transparent: true, opacity: 0.12 }),
  );
  return { flat, mesh, creases };
};
type Tile = ReturnType<typeof buildTile>;

/**
 * Paints every facet: paper rising toward the accent with height, the model the flag is on a
 * little warmer; the cut walls a shade of the table.
 */
const paintTiles = (tiles: Tile[], active: number, top: number, c: Palette) => {
  const shade = new Color();
  tiles.forEach(({ flat, creases }, i) => {
    const on = i === active;
    const p = flat.getAttribute('position');
    const n = flat.getAttribute('normal');
    const colors = flat.getAttribute('color') as BufferAttribute;
    for (let k = 0; k < p.count; k += 3) {
      const y = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3;
      if (Math.abs(n.getY(k)) < 0.15)
        shade
          .copy(c.paper)
          .lerp(c.bg, 0.5)
          .lerp(c.ink, 0.12)
          .lerp(c.accent, on ? 0.18 : 0.04);
      else shade.copy(c.paper).lerp(c.accent, Math.min(0.65, (y / top) * 0.45 + (on ? 0.2 : 0)));
      for (let j = 0; j < 3; j++) colors.setXYZ(k + j, shade.r, shade.g, shade.b);
    }
    colors.needsUpdate = true;
    (creases.material as LineBasicMaterial).color.copy(c.ink);
  });
};

/** The route, dashed, with the part walked so far drawn over it; and the flag. */
const buildRoute = (r: Relief) => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(r.route, 3));
  const dashed = new Line(geometry, new LineDashedMaterial({ dashSize: 0.5, gapSize: 0.7 }));
  dashed.computeLineDistances();
  const walked = new Line(geometry.clone(), new LineBasicMaterial());
  const flag = new Group();
  const pole = new Mesh(new CylinderGeometry(0.05, 0.05, 2.2, 6), new MeshStandardMaterial());
  pole.position.y = 1.1;
  // A folded paper pennant: a three-sided cone on its side.
  const pennant = new Mesh(new ConeGeometry(0.55, 1.4, 3), new MeshStandardMaterial({ flatShading: true }));
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.set(0.7, 1.75, 0);
  flag.add(pole, pennant);
  const paint = (c: Palette) => {
    (dashed.material as LineDashedMaterial).color.copy(c.ink);
    (walked.material as LineBasicMaterial).color.copy(c.accent);
    (pole.material as MeshStandardMaterial).color.copy(c.ink);
    (pennant.material as MeshStandardMaterial).color.copy(c.accent);
  };
  return { dashed, walked, flag, paint };
};

/** The readout, the names, the slider and the live region, from ExpeditionMap.astro. */
const parts = (figure: HTMLElement) => ({
  box: figure.querySelector<HTMLElement>('[data-relief]'),
  stage: figure.querySelector<HTMLElement>('[data-relief-stage]'),
  range: figure.querySelector<HTMLInputElement>('[data-relief-range]'),
  live: figure.querySelector<HTMLElement>('[data-relief-live]'),
  heads: [...figure.querySelectorAll<HTMLElement>('[data-era]')],
  names: [...figure.querySelectorAll<HTMLElement>('[data-name]')],
});

/** The camera follows the flag, easing, but keeps the whole range in view: high, wide, a little west. */
const follower = (r: Relief, camera: PerspectiveCamera) => {
  const look = new Vector3();
  const eye = new Vector3();
  const wantLook = new Vector3();
  const wantEye = new Vector3();
  const aim = ([x, y]: [number, number, number]) => {
    const fx = r.width / 2 + (x - r.width / 2) * CAMERA.follow;
    wantLook.set(fx, y * 0.3 - 2, 0);
    wantEye.set(fx + CAMERA.side, CAMERA.height + y * 0.4, CAMERA.distance);
  };
  return {
    jump(at: [number, number, number]) {
      aim(at);
      look.copy(wantLook);
      eye.copy(wantEye);
    },
    /** One step toward the flag; whether there is still a way to go. */
    step(at: [number, number, number]) {
      aim(at);
      look.lerp(wantLook, CAMERA.ease);
      eye.lerp(wantEye, CAMERA.ease);
      camera.position.copy(eye);
      camera.lookAt(look);
      return eye.distanceTo(wantEye) > 0.02 || look.distanceTo(wantLook) > 0.02;
    },
  };
};

/** Drag on the stage, the slider, and Page Up / Page Down from one place to the next. */
const controls = (
  el: { stage: HTMLElement; range: HTMLInputElement },
  r: Relief,
  move: (progress: number) => void,
  now: () => number,
) => {
  let from: { x: number; p: number } | undefined;
  el.stage.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('a')) return; // a name: a link, not a drag
    from = { x: e.clientX, p: now() };
    el.stage.setPointerCapture(e.pointerId);
  });
  el.stage.addEventListener('pointermove', (e) => {
    if (from) move(from.p + (e.clientX - from.x) / el.stage.clientWidth);
  });
  const release = () => (from = undefined);
  el.stage.addEventListener('pointerup', release);
  el.stage.addEventListener('pointercancel', release);
  el.range.addEventListener('input', () => move(Number(el.range.value) / 1000));
  el.range.addEventListener('keydown', (e) => {
    const by = ({ PageUp: 1, PageDown: -1 } as Record<string, number>)[e.key];
    if (by === undefined) return;
    e.preventDefault();
    move(progressAt(r, tileAt(r, now()) + by));
  });
  return { dragging: () => from !== undefined };
};

/** Climbs from base camp to now, easing in and out, until the visitor takes over. */
const climb = (move: (progress: number) => void, busy: () => boolean) => {
  const began = performance.now();
  let stopped = false;
  const tick = (t: number) => {
    if (stopped || busy()) return;
    const k = Math.min(1, (t - began) / CLIMB_MS);
    move(k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => (stopped = true);
};

/** Calls `onChange` when the identity, the theme or the system's colour scheme changes. */
const watchIdentity = (onChange: () => void) => {
  new MutationObserver(onChange).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme', 'class'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
};

/** Builds the scene in `figure` (ExpeditionMap.astro) and hands it the map's place. */
export const mountRelief = async (figure: HTMLElement): Promise<void> => {
  const el = parts(figure);
  if (!el.box || !el.stage || !el.range || !el.live) return;
  const { box, stage, range, live, heads, names } = el;
  const r = relief((await Promise.all(GRIDS.map(load))).map((grid, i) => ({ major: i, grid })));

  // Everything that can fail comes first, while the drawing is still the map.
  const { renderer, canvas, scene, camera, sky } = createStage(stage);
  const tiles = r.tiles.map(buildTile);
  for (const t of tiles) scene.add(t.mesh, t.creases);
  const route = buildRoute(r);
  scene.add(route.dashed, route.walked, route.flag);
  const camera3 = follower(r, camera);
  box.hidden = false;
  figure.classList.add('relief-on');

  let progress = 1;
  let shown = -1;
  let frame = 0;
  const paint = () => {
    const c = palette();
    (scene.fog as Fog).color.copy(c.bg);
    sky.groundColor.copy(c.ink).lerp(c.bg, 0.5);
    paintTiles(tiles, shown, r.top, c);
    route.paint(c);
  };
  const draw = () => {
    frame = 0;
    const at = pointAt(r, progress);
    route.flag.position.set(...at);
    const moving = camera3.step(at);
    renderer.render(scene, camera);
    canvas.style.opacity = '1';
    if (moving) frame = requestAnimationFrame(draw);
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  const move = (p: number) => {
    progress = Math.max(0, Math.min(1, p));
    range.value = String(Math.round(progress * 1000));
    route.walked.geometry.setDrawRange(0, Math.round(progress * (r.route.length / 3 - 1)) + 1);
    const i = tileAt(r, progress);
    if (i !== shown) {
      shown = i;
      paint();
      heads.forEach((h, k) => h.classList.toggle('away', k !== i));
      names.forEach((n, k) => n.classList.toggle('on', k === i));
      live.textContent = heads[i]?.dataset.said ?? '';
    }
    wake();
  };
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    wake();
  };
  new ResizeObserver(resize).observe(stage);
  watchIdentity(() => {
    paint();
    wake();
  });

  const input = controls({ stage, range }, r, move, () => progress);
  camera3.jump(pointAt(r, 0));
  move(0);
  // The announcement waits for the visitor: the climb itself says nothing.
  live.textContent = '';
  resize();
  const stop = climb((p) => {
    move(p);
    live.textContent = '';
  }, input.dragging);
  range.addEventListener('pointerdown', stop, { once: true });
  range.addEventListener('keydown', stop, { once: true });
};
