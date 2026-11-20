/**
 * The three identity scenes behind the 3D fox (src/components/inspector/scene3d.ts), built with
 * three.js from the numbers in src/lib/identity-scenes.ts. Part of the scene3d chunk, with its
 * budget. Each scene is built only when its identity is first shown.
 *
 * `update(state, alpha)` poses a scene from Inspect's phases; `paint(css)` recolours it from the
 * active identity's tokens. Near-white paper on a pale ground keeps an ink outline, and the only
 * accent is the part working right now (teardown rules 4 and 5).
 */
import {
  BufferAttribute,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { stateToState, type InspectState } from '../../lib/fold3d';
import {
  BASALT,
  IRAZU,
  TERRAIN,
  irazuModel,
  WASHI,
  basaltColumns,
  contourFront,
  ringProgress,
  seeded,
  sheetProgress,
} from '../../lib/identity-scenes';
import type { VisualDirection } from '../../config/visual-direction';
// The Irazú's real heights (src/lib/identity-scenes.ts, IRAZU_DEM): a file of its own, fetched
// with this module and counted in the sceneData budget.
import irazuDemUrl from '../../assets/scenes/irazu-dem.bin?url';

let irazuDem: Promise<Uint16Array> | null = null;
/** Starts (or reuses) the height grid's download; a failed one is forgotten, so a later try retries. */
const loadIrazuDem = () => {
  irazuDem ??= fetch(irazuDemUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`irazu-dem: ${r.status}`))))
    // uint16 little-endian, which every browser's typed arrays read natively.
    .then((buffer) => new Uint16Array(buffer))
    .catch((error: unknown) => {
      irazuDem = null;
      throw error;
    });
  return irazuDem;
};
// Contour lines is the default identity, so the grid starts downloading with the scene's code.
void loadIrazuDem().catch(() => undefined);

/** Reads a colour token of the active identity. */
export type Tokens = (name: string) => Color;

export interface IdentityScene {
  group: Group;
  paint(css: Tokens): void;
  /** Poses the scene from Inspect's phases; alpha fades the whole scene. */
  update(state: InspectState, alpha: number): void;
}

/** Fades in over the first third of the rise, so nothing pops in at full strength. */
const presence = (rise: number, alpha: number, speed = 3) => Math.min(1, rise * speed) * alpha;

// ---------- Contour lines: the Irazú ----------

/** How far the terrain tips toward the camera, in radians. */
const TERRAIN_TILT = 0.42;

const contourLines = (redraw: () => void): IdentityScene => {
  const geometry = new PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.segments, TERRAIN.segments);
  geometry.rotateX(-Math.PI / 2);
  // Flat until the grid arrives (a few dozen KB, usually before the scene starts to rise). The
  // plane's vertices run row by row from the back (north) and west to east, like the grid.
  const heights = new BufferAttribute(new Float32Array(geometry.attributes.position!.count), 1);
  geometry.setAttribute('h', heights);
  let hmax = 0;
  const material = new ShaderMaterial({
    transparent: true,
    uniforms: {
      rise: { value: 0 },
      front: { value: 1 },
      interval: { value: 1 },
      // The grid's lowest point, in model units above sea level: lines fall on real altitudes.
      offset: { value: 0 },
      every: { value: IRAZU.major / IRAZU.interval },
      ground: { value: new Color() },
      line: { value: new Color() },
      accent: { value: new Color() },
      mist: { value: new Color() },
      fade: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float h; uniform float rise; varying float vH; varying vec3 vPos; varying vec2 vXZ;
      void main() {
        vec3 p = position; p.y = h * rise; vH = h; vXZ = position.xz;
        vPos = (modelMatrix * vec4(p, 1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 ground, line, accent, mist; uniform float rise, front, interval, offset, every, fade;
      varying float vH; varying vec3 vPos; varying vec2 vXZ;
      void main() {
        vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
        vec3 c = ground * (clamp(dot(n, normalize(vec3(-0.6, 0.9, 0.4))), 0., 1.) * 0.35 + 0.65);
        float f = (vH + offset) / interval, w = max(fwidth(f), 1e-4);
        float on = 1. - clamp(abs(fract(f - 0.5) - 0.5) / w - 0.5, 0., 1.);
        float major = mod(floor(f + 0.5), every) < 0.5 ? 1. : 0.;
        // No line on the flat ground before the grid arrives.
        on *= step(1e-3, vH);
        // Lines exist above the front; the line at the front is the accent, the one being traced.
        float traced = smoothstep(front - interval * 0.5, front, vH);
        float atFront = 1. - smoothstep(0., interval * 0.9, abs(vH - front));
        c = mix(c, mix(line, accent, atFront), on * max(traced * (major > 0.5 ? 0.85 : 0.45), atFront));
        c = mix(c, mist, (1. - smoothstep(0., 0.35, vH * rise)) * 0.3);
        float edge = 1. - smoothstep(2.6, 4.2, length(vXZ));
        gl_FragColor = vec4(c, fade * edge);
      }`,
  });
  const mesh = new Mesh(geometry, material);
  // Behind and to the right of the fox, the summit clear of it, and tilted toward the camera so
  // the contours read as rings around the craters rather than stripes (teardown rule 6).
  const group = new Group();
  group.position.set(1.9, -1.3, -3.8);
  group.rotation.x = TERRAIN_TILT;
  group.scale.setScalar(0.8);
  group.add(mesh);
  const u = material.uniforms;
  loadIrazuDem()
    .then((metres) => {
      const model = irazuModel(metres);
      (heights.array as Float32Array).set(model.heights);
      heights.needsUpdate = true;
      hmax = model.hmax;
      u.interval!.value = model.unitsPer(IRAZU.interval);
      u.offset!.value = model.unitsPer(model.base);
      redraw();
    })
    // Without the grid the ground stays flat and unlined: the fox and the panel still work.
    .catch((error: unknown) => console.warn('Irazú heights unavailable', error));
  return {
    group,
    paint(css) {
      const surface = css('--color-surface');
      u.ground!.value = css('--color-bg').lerp(surface, 0.4);
      u.line!.value = css('--color-mute');
      u.accent!.value = css('--color-accent-ui');
      u.mist!.value = surface;
    },
    update({ eased, linear }, alpha) {
      u.rise!.value = eased.rise;
      u.front!.value = contourFront(linear.detail, hmax);
      u.fade!.value = presence(eased.rise, alpha);
    },
  };
};

// ---------- Basalt & glacier: columns ----------

const basaltGlacier = (): IdentityScene => {
  const R = BASALT.radius * 0.97;
  const wallGeometry = new CylinderGeometry(R, R, 1, 6, 1, true);
  wallGeometry.translate(0, 0.5, 0);
  const capGeometry = new CircleGeometry(R, 6);
  capGeometry.rotateX(-Math.PI / 2);
  capGeometry.rotateY(Math.PI / 6); // the cap's corners line up with the wall's
  const columns = basaltColumns();
  const rings = Math.max(...columns.map((c) => c.ring)) + 1;
  // Walls and caps are two instanced meshes (two draw calls), so a rising column's cap can light
  // up in the accent on its own.
  const wallMaterial = new MeshStandardMaterial({
    flatShading: true,
    roughness: 0.85,
    transparent: true,
    side: DoubleSide,
  });
  const capMaterial = new MeshStandardMaterial({ flatShading: true, roughness: 0.6, transparent: true });
  const walls = new InstancedMesh(wallGeometry, wallMaterial, columns.length);
  const caps = new InstancedMesh(capGeometry, capMaterial, columns.length);
  const group = new Group();
  group.position.set(0, -1.55, -3.1);
  group.scale.setScalar(0.85);
  group.rotation.x = 0.18;
  group.add(walls, caps);
  const matrix = new Matrix4();
  const turn = new Quaternion();
  const size = new Vector3();
  const at = new Vector3();
  const palette = {
    basalt: new Color(),
    moss: new Color(),
    ice: new Color(),
    accent: new Color(),
    cap: new Color(),
  };
  return {
    group,
    paint(css) {
      // Basalt is dark stone in both themes: start from whichever of ink and background is darker.
      const ink = css('--color-ink');
      const bg = css('--color-bg');
      const darker = ink.getHSL({ h: 0, s: 0, l: 0 }).l < bg.getHSL({ h: 0, s: 0, l: 0 }).l ? ink : bg;
      palette.basalt.copy(darker.lerp(css('--color-earth'), 0.35));
      palette.ice.copy(css('--color-accent-ui').lerp(css('--color-surface'), 0.72));
      // Moss leans toward the stone so it never competes with the accent.
      palette.moss.copy(css('--color-second')).lerp(palette.basalt, 0.4);
      palette.accent.copy(css('--color-accent-ui'));
    },
    update({ eased, linear }, alpha) {
      columns.forEach((c, i) => {
        const k = ringProgress(linear.rise, c.ring, rings);
        const height = Math.max(0.001, c.h * stateToState(k));
        walls.setMatrixAt(i, matrix.compose(at.set(c.x, 0, c.z), turn, size.set(1, height, 1)));
        caps.setMatrixAt(i, matrix.compose(at.set(c.x, height + 0.001, c.z), turn, size.set(1, 1, 1)));
        walls.setColorAt(i, c.moss ? palette.moss : palette.basalt);
        // The rising ring's caps carry the accent; the rest frost from stone to ice with the detail.
        const rising = k > 0 && k < 1;
        caps.setColorAt(
          i,
          rising ? palette.accent : palette.cap.copy(palette.basalt).lerp(palette.ice, eased.detail),
        );
      });
      for (const m of [walls, caps]) {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
      wallMaterial.opacity = capMaterial.opacity = presence(eased.rise, alpha);
    },
  };
};

// ---------- Washi & asagi: sheets ----------

/** A small canvas texture drawn once from a seed, so the paper looks the same on every visit. */
const seededTexture = (draw: (g: CanvasRenderingContext2D, random: () => number) => void, seed: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  draw(canvas.getContext('2d')!, seeded(seed));
  return new CanvasTexture(canvas);
};

const washiAsagi = (): IdentityScene => {
  const fibre = seededTexture((g, random) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(120,110,95,${0.03 + random() * 0.06})`;
      g.lineWidth = 0.5 + random() * 0.6;
      const x = random() * 256;
      const y = random() * 256;
      const a = random() * Math.PI;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(
        x + Math.cos(a) * 20,
        y + Math.sin(a) * 20 + 6,
        x + Math.cos(a) * 40,
        y + Math.sin(a) * 40,
      );
      g.stroke();
    }
  }, 7);
  fibre.colorSpace = SRGBColorSpace;
  const stain = seededTexture((g, random) => {
    for (let i = 0; i < 9; i++) {
      const gradient = g.createRadialGradient(
        128 + (random() - 0.5) * 60,
        128 + (random() - 0.5) * 40,
        4,
        128,
        128,
        70 + random() * 40,
      );
      gradient.addColorStop(0, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gradient;
      g.fillRect(0, 0, 256, 256);
    }
  }, 3);

  const group = new Group();
  group.position.set(0.35, -0.25, -2.4);
  const outlineGeometry = new EdgesGeometry(new PlaneGeometry(WASHI.width, WASHI.height));
  const sheets = Array.from({ length: WASHI.sheets }, (_, i) => {
    const geometry = new PlaneGeometry(WASHI.width, WASHI.height, 24, 16);
    const p = geometry.attributes.position!;
    for (let v = 0; v < p.count; v++)
      p.setZ(v, Math.sin(p.getX(v) * 1.3 + i) * 0.04 + Math.sin(p.getY(v) * 2 + i * 2) * 0.03);
    geometry.computeVertexNormals();
    const material = new MeshStandardMaterial({
      map: fibre,
      transparent: true,
      side: DoubleSide,
      roughness: 1,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    const outline = new LineSegments(outlineGeometry, new LineBasicMaterial({ transparent: true }));
    mesh.add(outline);
    mesh.rotation.set(-0.12 - i * 0.02, (i - 2) * 0.05, (i - 2) * 0.03);
    group.add(mesh);
    return { mesh, material, outline: outline.material };
  });
  const ink = new Mesh(
    new PlaneGeometry(0.75, 0.6),
    new MeshBasicMaterial({ alphaMap: stain, transparent: true, depthWrite: false }),
  );
  ink.position.set(0.75, -0.4, 0.02);
  sheets[WASHI.sheets - 1]!.mesh.add(ink);
  const palette = { ink: new Color(), accent: new Color() };
  return {
    group,
    paint(css) {
      const surface = css('--color-surface');
      palette.accent.copy(css('--color-accent-ui'));
      palette.ink.copy(css('--color-ink'));
      sheets.forEach((s, i) =>
        s.material.color.copy(
          i % 2
            ? palette.accent.clone().lerp(surface, 0.78)
            : surface.clone().lerp(css('--color-earth'), 0.12),
        ),
      );
      ink.material.color.copy(palette.ink);
    },
    update({ eased, linear }, alpha) {
      const shown = presence(eased.rise, alpha, 2.5);
      sheets.forEach((s, i) => {
        const k = sheetProgress(linear.rise, i);
        const e = stateToState(k);
        const lifting = k > 0 && k < 1;
        s.mesh.position.z = -0.9 + i * 0.32 * e;
        s.mesh.position.y = -0.4 * (1 - e) + i * 0.04;
        s.material.opacity = (0.45 + 0.1 * i) * shown;
        // The lifting sheet's edge is the accent; the rest keep a faint ink outline.
        s.outline.color.copy(lifting ? palette.accent : palette.ink);
        s.outline.opacity = (lifting ? 0.9 : 0.18) * shown;
      });
      ink.material.opacity = 0.32 * eased.detail * alpha;
      ink.scale.setScalar(0.55 + 0.45 * eased.detail);
    },
  };
};

const builders: Record<VisualDirection, (redraw: () => void) => IdentityScene> = {
  'contour-lines': contourLines,
  'basalt-glacier': basaltGlacier,
  'washi-asagi': washiAsagi,
};

/** Builds one identity's scene; `redraw` asks for a frame when data arrives after it's shown. */
export const makeIdentityScene = (direction: VisualDirection, redraw: () => void): IdentityScene =>
  builders[direction](redraw);
