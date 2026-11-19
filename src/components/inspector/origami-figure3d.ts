/**
 * One origami figure in three.js (src/lib/origami): its paper, its crease lines, and how to draw it
 * at any fold. The 3D scene (scene3d.ts) decides which figure, when, and how far;
 * this file only draws what it's told.
 */
import {
  BufferGeometry,
  Color,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Material,
  Vector3,
  type Matrix4,
} from 'three';
import { stateToState } from '../../lib/fold3d';
import { creases, faceNormal, foldMatrices, posed, type Fold } from '../../lib/origami/hinge';
import { models, type ModelId } from '../../lib/origami/models';
import { EDGE_MIX, FROG_EYE, LIGHT, ROLE_MIX, facetRole, litRole, type Role } from '../../lib/origami/marks';

/** The figures' floor, in their own units (src/lib/origami/models.ts). */
export const FLOOR = -1.2;
/** How far each facet steps out when the figure is taken apart, in figure units. */
const TEARDOWN = 0.3;
/**
 * The morpho's wing blues: up to `steps` lighter and deeper than the SVG's, one per `per` of light
 * gained or lost, each step mixing `lighter` toward the light paper or `deeper` toward the edge.
 */
const SHINE = { steps: 2, per: 0.14, lighter: 0.2, deeper: 0.22 };

export type Css = (name: string) => Color;

/** Dark: chosen, or the system's when the visitor hasn't chosen (the same rule as origami.css). */
export const isDark = () => {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

/**
 * Each role's colour from the page's tokens. Paper is light in every theme, and shades toward ink
 * by day, the background by night (--origami-paper and --origami-dark in src/styles/origami.css).
 */
const roleColours = (id: ModelId, css: Css): Record<Role, Color> => {
  const night = isDark();
  const surface = night ? mix(css('--color-surface'), css('--color-ink'), 0.9) : css('--color-surface');
  const dark = night ? css('--color-bg') : css('--color-ink');
  const accent = css('--color-accent');
  return {
    light: mix(surface, accent, ROLE_MIX.light),
    mid: mix(surface, accent, ROLE_MIX.mid),
    shade: mix(surface, accent, ROLE_MIX.shade),
    deep: mix(surface, accent, ROLE_MIX.deep),
    accent: id === 'frog' ? new Color(FROG_EYE) : accent,
    wing: css('--color-accent-ui'),
    edge: mix(accent, dark, EDGE_MIX),
  };
};

/**
 * a toward b by k, mixed in sRGB as the SVG's color-mix() does (near enough to its oklab). three.js
 * keeps colours linear, and a linear mix washes the accent out: the figure turned grey in 3D.
 */
const mix = (a: Color, b: Color, k: number): Color => {
  const [x, y] = [a, b].map((c) => c.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace));
  return new Color().setRGB(
    x!.r + (y!.r - x!.r) * k,
    x!.g + (y!.g - x!.g) * k,
    x!.b + (y!.b - x!.b) * k,
    SRGBColorSpace,
  );
};

/**
 * The figure's two looks share one material each, mixed by `flat` (a uniform): 1 draws the SVG's
 * flat tones exactly, unlit (the hero); 0 is lit paper with an iridescent film on the morpho's wings
 * (Inspect, unchanged). In between, the light comes in gradually: no swap, no pop.
 */
const materials = () => {
  const flat = { value: 1 };
  const flatten = <M extends Material>(m: M): M => {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFlat = flat;
      shader.fragmentShader = `uniform float uFlat;\n${shader.fragmentShader}`.replace(
        '#include <opaque_fragment>',
        'outgoingLight = mix(outgoingLight, diffuseColor.rgb, uFlat);\n#include <opaque_fragment>',
      );
    };
    return m;
  };
  const shared = {
    vertexColors: true,
    flatShading: true,
    side: DoubleSide,
    // The edges sit exactly on the facets: the paper steps back a hair so the lines always win.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  };
  const paper = flatten(new MeshStandardMaterial({ ...shared, roughness: 0.86 }));
  const wing = flatten(
    new MeshPhysicalMaterial({
      ...shared,
      roughness: 0.38,
      metalness: 0.15,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [250, 520],
      clearcoat: 0.3,
    }),
  );
  return { paper, wing, flat };
};

/** The teardown: tips first, every facet steps straight out from the body, a short even step. */
const teardownStep = (fold: Fold, i: number, apart: number): number => {
  const k = Math.min(1, Math.max(0, (apart * (fold.maxDepth + 2) - (fold.maxDepth - fold.depth[i]!)) / 2));
  return TEARDOWN * stateToState(k);
};

/** The hinges at a pose, split into mountain and valley folds, a hair above the paper. */
const creaseLines = (fold: Fold, M: readonly Matrix4[]) => {
  const lines = { mountain: [] as number[], valley: [] as number[] };
  for (const { kind, a, b } of creases(fold, M))
    lines[kind].push(a.x, a.y + 0.003, a.z, b.x, b.y + 0.003, b.z);
  return lines;
};

/**
 * Each facet's colour, repainted only when it changes. Paper takes the SVG's four tones from the
 * light it catches. The morpho's blue is structural, so it shifts with the angle it's seen at: each
 * wing facet keeps the SVG's blue at rest and steps lighter or deeper as it turns toward or away
 * from the light.
 */
const facetTones = (id: ModelId, colour: BufferAttribute | InterleavedBufferAttribute) => {
  const { fold, tags } = models[id];
  const n = fold.faces.length;
  const restLit = fold.faces.map((f) => Math.abs(faceNormal(fold.points, f).dot(LIGHT)));
  const shown: (Role | number | null)[] = new Array(n).fill(null);
  let colours: Record<Role, Color> | null = null;
  const shades = new Map<number, Color>();
  const set = (i: number, key: Role | number, c: Color | undefined) => {
    if (!c || shown[i] === key) return false;
    shown[i] = key;
    for (let k = 0; k < 3; k++) colour.setXYZ(i * 3 + k, c.r, c.g, c.b);
    return true;
  };
  return {
    paint(next: Record<Role, Color>) {
      colours = next;
      for (let s = -SHINE.steps; s <= SHINE.steps; s++)
        shades.set(
          s,
          s > 0
            ? mix(next.wing, next.light, s * SHINE.lighter)
            : mix(next.wing, next.edge, -s * SHINE.deeper),
        );
      shown.fill(null);
      for (let i = 0; i < n; i++) set(i, facetRole(id, i), next[facetRole(id, i)]);
    },
    /** Facet i catches `lit` of the light (0 edge-on … 1 straight at it); true if it was repainted. */
    light(i: number, lit: number) {
      if (tags[i] === 'paper') return set(i, litRole(lit), colours?.[litRole(lit)]);
      const step = Math.max(-SHINE.steps, Math.min(SHINE.steps, Math.round((lit - restLit[i]!) / SHINE.per)));
      return set(i, step, shades.get(step));
    },
  };
};

/**
 * One figure. In the hero it is drawn the way the SVG draws it (src/lib/origami/marks.ts): flat
 * paper in the identity's four tones and a thin line in the surface colour between facets, the
 * tones following the light as it turns, so it stays paper, never plastic. Inspecting, it is lit
 * paper and comes apart, tips first (the teardown).
 */
export const makeFigure = (id: ModelId) => {
  const { fold, tags } = models[id];
  const n = fold.faces.length;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 9), 3));
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 9), 3));
  tags.forEach((tag, i) => geometry.addGroup(i * 3, 3, tag === 'wing' ? 1 : 0));
  const { paper, wing, flat } = materials();
  const edges = new LineSegments(
    new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 18), 3)),
    new LineBasicMaterial({ transparent: true }),
  );
  const mountain = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ transparent: true }));
  const valley = new LineSegments(
    new BufferGeometry(),
    new LineDashedMaterial({ transparent: true, dashSize: 0.07, gapSize: 0.05 }),
  );
  const group = new Group();
  group.add(new Mesh(geometry, [paper, wing]), edges, mountain, valley);
  const centre = fold.points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(fold.points.length);
  const position = geometry.getAttribute('position');
  const colour = geometry.getAttribute('color');
  const edge = edges.geometry.getAttribute('position');
  const tones = facetTones(id, colour);
  const [normal, ab, ac, out] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];

  return {
    group,
    paint(css: Css) {
      tones.paint(roleColours(id, css));
      colour.needsUpdate = true;
      edges.material.color.copy(css('--color-surface'));
      mountain.material.color.copy(css('--color-accent-ui'));
      valley.material.color.copy(css('--color-accent-ui'));
    },
    /** 1: the SVG's flat look, with its edges (the hero); 0: lit paper (Inspect). */
    setFlat(f: number) {
      flat.value = f;
      edges.material.opacity = f;
      edges.visible = f > 0.01;
    },
    /**
     * u: 0 folded … 1 its crease pattern. `light`: the key light in the figure's own frame (it
     * moves as the figure turns); at the figure's resting view it is the SVG's light, so every
     * facet has the SVG's tone. apart: 0 whole … 1 taken apart.
     */
    pose(u: number, light: Vector3 = LIGHT, apart = 0) {
      const M = foldMatrices(fold, u, FLOOR);
      let repaint = false;
      for (let i = 0; i < n; i++) {
        const [a, b, c] = posed(fold, M, i);
        const step = teardownStep(fold, i, apart);
        if (step) out.copy(a).add(b).add(c).divideScalar(3).sub(centre).normalize().multiplyScalar(step);
        else out.set(0, 0, 0);
        [a, b, c].forEach((p, k) => position.setXYZ(i * 3 + k, p.x + out.x, p.y + out.y, p.z + out.z));
        [a, b, b, c, c, a].forEach((p, k) => edge.setXYZ(i * 6 + k, p.x + out.x, p.y + out.y, p.z + out.z));
        if (tags[i] === 'paper' || tags[i] === 'wing') {
          normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
          repaint = tones.light(i, Math.abs(normal.dot(light))) || repaint;
        }
      }
      position.needsUpdate = edge.needsUpdate = true;
      if (repaint) colour.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const lines = creaseLines(fold, M);
      mountain.geometry.setAttribute('position', new Float32BufferAttribute(lines.mountain, 3));
      valley.geometry.setAttribute('position', new Float32BufferAttribute(lines.valley, 3));
      valley.computeLineDistances();
      // The crease pattern shows as the sheet lies open.
      const shown = Math.max(0, (u - 0.55) / 0.45);
      mountain.visible = valley.visible = shown > 0.01;
      mountain.material.opacity = valley.material.opacity = shown;
    },
    /** The posed facets' corners, for framing. */
    positions: () => position,
    dispose() {
      geometry.dispose();
      paper.dispose();
      wing.dispose();
      edges.geometry.dispose();
      edges.material.dispose();
      mountain.geometry.dispose();
      valley.geometry.dispose();
    },
  };
};
export type Figure = ReturnType<typeof makeFigure>;
