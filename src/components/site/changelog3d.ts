/**
 * The career's places as topographic models of cut paper, over the map at the top of /changelog
 * (ExpeditionMap.astro, ExpeditionRelief.astro), on a wide screen whose device can run it
 * (src/lib/scene3d-support.ts). Geometry and data in src/lib/relief.ts; this file draws them with
 * three.js, shared with the home page's scenes and counted with them in the scene3d budget.
 *
 * Each place is a round model, one sheet of paper per 100 m contour stacked at its height, each
 * casting its shadow on the next, on a base disc (doc 37). While inspecting, the sheets stand
 * apart, an exploded view: the page comes apart into its layers, and so does each model. The models stand in a row in the order of
 * the career; the camera centres one at a time, the others fading into the paper. A place is
 * chosen with its name, or the previous and next buttons; on arrival the camera glides from base
 * camp to now. It draws only while the camera moves; the colours follow the identity and the theme.
 */
import {
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RELIEF, heightOf, model, sampled, sheetMask, type Model } from '../../lib/relief';
import cartagoUrl from '../../assets/scenes/cartago-dem.bin?url';
import poasUrl from '../../assets/scenes/poas-dem.bin?url';
import turrialbaUrl from '../../assets/scenes/turrialba-dem.bin?url';
import irazuUrl from '../../assets/scenes/irazu-dem.bin?url';

/** The grids, in the order of the career: base camp, Poás, Turrialba, Irazú. */
const GRIDS = [cartagoUrl, poasUrl, turrialbaUrl, irazuUrl];
const CAMERA = { fov: 30, height: 30, distance: 46, side: -10, ease: 0.08 };
const FADE_MS = 400;
/** How far apart the sheets stand while inspecting, in scene units per sheet: an exploded view. */
const SPREAD = 0.6;
/** How long the first model holds before the camera glides to now. */
const INTRO_MS = 700;

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
});
type Palette = ReturnType<typeof palette>;

/** The canvas in the stage, its renderer with soft shadows, the camera, the lights and the table. */
const createStage = (stage: HTMLElement) => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  // Sharp on a laptop, but never the full cost of a 4K monitor.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
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
  scene.fog = new Fog(0xffffff, 70, 120);
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 400);
  const sky = new HemisphereLight(0xffffff, 0x808080, 1.5);
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(-30, 60, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 40, bottom: -40, near: 1, far: 200 });
  sun.target.position.set(50, 0, 0);
  const table = new Mesh(new PlaneGeometry(400, 200), new ShadowMaterial({ opacity: 0.16 }));
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.01;
  table.receiveShadow = true;
  scene.add(sky, sun, sun.target, table);
  return { renderer, canvas, scene, camera, sky };
};

/** One place as a model: a sheet per contour, cut from its mask, on a base disc. */
const buildModel = (m: Model) => {
  const heights = sampled(m);
  const group = new Group();
  const placed: { sheet: Mesh; y: number }[] = [];
  const sheets = m.levels.map((level) => {
    const mask = new DataTexture(sheetMask(heights, level), RELIEF.res, RELIEF.res, RGBAFormat);
    mask.magFilter = LinearFilter;
    mask.minFilter = LinearFilter;
    mask.flipY = false;
    mask.needsUpdate = true;
    const material = new MeshStandardMaterial({
      alphaMap: mask,
      alphaTest: 0.5,
      roughness: 0.96,
      side: DoubleSide,
    });
    const sheet = new Mesh(new PlaneGeometry(RELIEF.tile, RELIEF.tile), material);
    // Rows run north to south in the grid: the plane is laid flat with north away from the camera.
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set(RELIEF.tile / 2, heightOf(level, m.low), 0);
    placed.push({ sheet, y: heightOf(level, m.low) });
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    group.add(sheet);
    return material;
  });
  const baseMaterial = new MeshStandardMaterial({ roughness: 0.96 });
  const base = new Mesh(
    new CylinderGeometry(RELIEF.tile * RELIEF.cut, RELIEF.tile * RELIEF.cut, 0.3, 96),
    baseMaterial,
  );
  base.position.set(RELIEF.tile / 2, 0.15, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  /** Paper rising toward the accent with height; every other sheet a shade apart, as cut card. */
  const paint = (c: Palette) => {
    baseMaterial.color.copy(c.paper);
    sheets.forEach((material, k) => {
      material.color.copy(c.paper);
      if (k % 2) material.color.lerp(c.ink, 0.04);
      material.color.lerp(c.accent, Math.min(0.55, (k / sheets.length) * 0.55));
    });
  };
  /** Stands the sheets apart, `k` from 0 (stacked) to 1 (exploded). */
  const explode = (k: number) =>
    placed.forEach(({ sheet, y }, i) => (sheet.position.y = y + k * (i + 1) * SPREAD));
  return { group, top: heightOf(m.top, m.low), paint, explode };
};
type Built = ReturnType<typeof buildModel>;

/** The readout, the names, the steps and the live region, from ExpeditionRelief.astro. */
const parts = (figure: HTMLElement) => ({
  box: figure.querySelector<HTMLElement>('[data-relief]'),
  stage: figure.querySelector<HTMLElement>('[data-relief-stage]'),
  live: figure.querySelector<HTMLElement>('[data-relief-live]'),
  prev: figure.querySelector<HTMLButtonElement>('[data-relief-step="-1"]'),
  next: figure.querySelector<HTMLButtonElement>('[data-relief-step="1"]'),
  heads: [...figure.querySelectorAll<HTMLElement>('[data-era]')],
  names: [...figure.querySelectorAll<HTMLButtonElement>('[data-place]')],
});

/** The camera centres one model at a time, easing, from high and a little west. */
const follower = (camera: PerspectiveCamera) => {
  const eye = new Vector3();
  const look = new Vector3();
  const wantEye = new Vector3();
  const wantLook = new Vector3();
  return {
    aim(x: number, top: number) {
      wantLook.set(x, top * 0.35, 0);
      wantEye.set(x + CAMERA.side, CAMERA.height + top * 0.6, CAMERA.distance);
    },
    jump() {
      eye.copy(wantEye);
      look.copy(wantLook);
    },
    /** One step toward the model; whether there is still a way to go. */
    step() {
      eye.lerp(wantEye, CAMERA.ease);
      look.lerp(wantLook, CAMERA.ease);
      camera.position.copy(eye);
      camera.lookAt(look);
      return eye.distanceTo(wantEye) > 0.01;
    },
  };
};

/** Calls `onChange` when the identity, the theme or the system's colour scheme changes. */
const watchIdentity = (onChange: () => void) => {
  new MutationObserver(onChange).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme', 'class'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onChange);
};

/** Places the models in a row and paints them. */
const lay = (scene: Scene, models: Model[]) =>
  models.map((m, i) => {
    const built = buildModel(m);
    built.group.position.x = i * (RELIEF.tile + RELIEF.gap);
    scene.add(built.group);
    return { ...built, x: i * (RELIEF.tile + RELIEF.gap) + RELIEF.tile / 2 };
  });

/** Builds the scene in `figure` (ExpeditionMap.astro) and hands it the map's place. */
export const mountRelief = async (figure: HTMLElement): Promise<void> => {
  const el = parts(figure);
  if (!el.box || !el.stage || !el.live || !el.prev || !el.next) return;
  const { box, stage, live, prev, next, heads, names } = el;
  const models = (await Promise.all(GRIDS.map(load))).map(model);

  // Everything that can fail comes first, while the drawing is still the map.
  const { renderer, canvas, scene, camera, sky } = createStage(stage);
  const built: (Built & { x: number })[] = lay(scene, models);
  const eye = follower(camera);
  box.hidden = false;
  figure.classList.add('relief-on');

  let active = 0;
  let frame = 0;
  let touched = false;
  // The exploded view: where it is, and where it is going.
  let spread = 0;
  const inspecting = () => document.documentElement.classList.contains('inspecting');
  let wantSpread = inspecting() ? 1 : 0;
  const paint = () => {
    const c = palette();
    (scene.fog as Fog).color.copy(c.paper);
    sky.groundColor.copy(c.ink).lerp(c.paper, 0.6);
    for (const b of built) b.paint(c);
  };
  const draw = () => {
    frame = 0;
    let moving = eye.step();
    if (Math.abs(wantSpread - spread) > 0.002) {
      spread += (wantSpread - spread) * 0.12;
      for (const b of built) b.explode(spread);
      moving = true;
    }
    renderer.render(scene, camera);
    canvas.style.opacity = '1';
    if (moving) frame = requestAnimationFrame(draw);
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  /** Centres place `i`; `say` announces it (not during the arrival's glide). */
  const show = (i: number, say = true) => {
    active = (i + built.length) % built.length;
    const b = built[active]!;
    eye.aim(b.x, b.top);
    heads.forEach((h, k) => h.classList.toggle('away', k !== active));
    names.forEach((n, k) => n.setAttribute('aria-pressed', String(k === active)));
    if (say) live.textContent = heads[active]?.dataset.said ?? '';
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
    wantSpread = inspecting() ? 1 : 0;
    wake();
  });
  const choose = (i: number) => {
    touched = true;
    show(i);
  };
  names.forEach((n, k) => n.addEventListener('click', () => choose(k)));
  prev.addEventListener('click', () => choose(active - 1));
  next.addEventListener('click', () => choose(active + 1));

  paint();
  show(0, false);
  eye.jump();
  resize();
  // The arrival: from base camp, the camera glides to now.
  setTimeout(() => {
    if (!touched) show(built.length - 1, false);
  }, INTRO_MS);
};
