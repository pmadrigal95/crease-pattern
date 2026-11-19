/**
 * One origami figure in three.js (src/lib/origami): its paper, its crease lines, and how to draw it
 * at any fold and teardown. The 3D scene (scene3d.ts) decides which figure, when, and how far;
 * this file only draws what it's told.
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
  type Matrix4,
} from 'three';
import { stateToState } from '../../lib/fold3d';
import { creases, foldMatrices, posed, type Fold } from '../../lib/origami/hinge';
import { models, type ModelId } from '../../lib/origami/models';
import { EDGE_MIX, FROG_EYE, ROLE_MIX, facetRole, type Role } from '../../lib/origami/marks';

/** The figures' floor, in their own units (src/lib/origami/models.ts). */
export const FLOOR = -1.2;
/** How far each facet steps out when the figure is taken apart, in figure units. */
const TEARDOWN = 0.3;

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
function roleColours(id: ModelId, css: Css): Record<Role, Color> {
  const night = isDark();
  const surface = night ? css('--color-surface').lerp(css('--color-ink'), 0.9) : css('--color-surface');
  const dark = night ? css('--color-bg') : css('--color-ink');
  const accent = css('--color-accent');
  return {
    light: surface.clone().lerp(accent, ROLE_MIX.light),
    mid: surface.clone().lerp(accent, ROLE_MIX.mid),
    shade: surface.clone().lerp(accent, ROLE_MIX.shade),
    deep: surface.clone().lerp(accent, ROLE_MIX.deep),
    accent: id === 'frog' ? new Color(FROG_EYE) : accent,
    wing: css('--color-accent-ui'),
    edge: accent.clone().lerp(dark, EDGE_MIX),
  };
}

/** Paper for most facets; for the morpho's wings, an iridescent film: their blue is structural. */
function materials() {
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
  return { paper, wing };
}

/** The teardown: tips first, every facet steps straight out from the body, a short even step. */
function teardownStep(fold: Fold, i: number, apart: number): number {
  const k = Math.min(1, Math.max(0, (apart * (fold.maxDepth + 2) - (fold.maxDepth - fold.depth[i]!)) / 2));
  return TEARDOWN * stateToState(k);
}

/** The hinges at a pose, split into mountain and valley folds, a hair above the paper. */
function creaseLines(fold: Fold, M: readonly Matrix4[]) {
  const lines = { mountain: [] as number[], valley: [] as number[] };
  for (const { kind, a, b } of creases(fold, M))
    lines[kind].push(a.x, a.y + 0.003, a.z, b.x, b.y + 0.003, b.z);
  return lines;
}

export function makeFigure(id: ModelId) {
  const { fold, tags } = models[id];
  const n = fold.faces.length;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(n * 9), 3));
  geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 9), 3));
  tags.forEach((tag, i) => geometry.addGroup(i * 3, 3, tag === 'wing' ? 1 : 0));
  const { paper, wing } = materials();
  const mountain = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ transparent: true }));
  const valley = new LineSegments(
    new BufferGeometry(),
    new LineDashedMaterial({ transparent: true, dashSize: 0.07, gapSize: 0.05 }),
  );
  const group = new Group();
  group.add(new Mesh(geometry, [paper, wing]), mountain, valley);
  const centre = fold.points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(fold.points.length);
  const out = new Vector3();
  const position = geometry.getAttribute('position');
  const colour = geometry.getAttribute('color');
  return {
    group,
    paint(css: Css) {
      const colours = roleColours(id, css);
      for (let i = 0; i < n; i++) {
        const c = colours[facetRole(id, i)];
        for (let k = 0; k < 3; k++) colour.setXYZ(i * 3 + k, c.r, c.g, c.b);
      }
      colour.needsUpdate = true;
      mountain.material.color.copy(css('--color-accent-ui'));
      valley.material.color.copy(css('--color-accent-ui'));
    },
    /** u: 0 folded … 1 its crease pattern; apart: 0 whole … 1 taken apart. */
    pose(u: number, apart: number) {
      const M = foldMatrices(fold, u, FLOOR);
      for (let i = 0; i < n; i++) {
        const corners = posed(fold, M, i);
        const mid = corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3);
        out
          .copy(mid)
          .sub(centre)
          .normalize()
          .multiplyScalar(teardownStep(fold, i, apart));
        corners.forEach((p, c) => position.setXYZ(i * 3 + c, p.x + out.x, p.y + out.y, p.z + out.z));
      }
      position.needsUpdate = true;
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
    dispose() {
      geometry.dispose();
      paper.dispose();
      wing.dispose();
      mountain.geometry.dispose();
      valley.geometry.dispose();
    },
  };
}
export type Figure = ReturnType<typeof makeFigure>;
