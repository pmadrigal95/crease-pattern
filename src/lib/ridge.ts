/**
 * Geometry for the career as a paper ridge (portfolio-discovery/31-changelog-plan.md): the home
 * page's changelog. Each release is its volcano (base camp, a low hill), placed along time and as
 * high as its real summit; each one is a folded sheet, two faces with a mountain fold down the
 * ridge and a crater at the top. The route walks the skyline the volcanoes make, crest to saddle,
 * and ends on the last summit: now. Pure functions, no DOM: the same SVG data on every build.
 *
 * Adding a release is adding one entry to career.json: it gets its own volcano, and a summit
 * higher than the frame's ceiling raises the ceiling (tests/unit/ridge.test.ts).
 */
import type { Climb } from './altitude';

export interface RidgeFrame {
  width: number;
  height: number;
  /** Where the ground is, and the highest a summit is drawn, in px. */
  baseline: number;
  top: number;
  /** The heights the frame spans, in metres; the ceiling rises for a higher summit. */
  floorM: number;
  ceilingM: number;
}

type Point = readonly [number, number];

export interface Peak {
  major: number;
  /** The release's stretch of time, in px, and its summit. */
  x0: number;
  x1: number;
  summit: Point;
  /** The two faces (lit and shaded), the outline, and the fold down the ridge (none on a hill). */
  lit: string;
  shaded: string;
  outline: string;
  fold: string | null;
  /** The outline as a closed shape, to clip the contour lines to. */
  shape: string;
  /** A contour line every 250 m below the summit, as y positions. */
  contours: number[];
  /** Where the name sits, under the summit. */
  labelX: number;
  /** Where a snow or ice cap ends, down from the summit; none on a hill. */
  capY: number | null;
  /** Above 3,000 m: high enough for a glacier, in the identity that draws one. */
  high: boolean;
}

export interface Ridge {
  peaks: Peak[];
  /** A faint far range behind, for depth. */
  far: string;
  /** The route along the skyline, from the left edge to the last summit. */
  route: string;
  /** Where the route ends: the last summit's x, now. */
  routeEnd: number;
  /** A height guide every 1,000 m inside the frame, for the annotated view the Inspector shows. */
  guides: { m: number; y: number }[];
}

const CONTOUR_M = 250;
const fmt = (p: Point) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const path = (points: readonly Point[], close = false) =>
  `M${points.map(fmt).join(' L')}${close ? ' Z' : ''}`;

/** The skyline's height at x: the highest of the outlines there, or the ground. */
const skylineAt = (outlines: readonly (readonly Point[])[], x: number, ground: number) => {
  let y = ground;
  for (const line of outlines)
    for (let k = 1; k < line.length; k++) {
      const [ax, ay] = line[k - 1]!;
      const [bx, by] = line[k]!;
      if (x >= ax && x <= bx) y = Math.min(y, ay + ((x - ax) / (bx - ax || 1)) * (by - ay));
    }
  return y;
};

/**
 * One volcano as folded paper: its outline, the face lit from the left and the shaded one, split
 * at the crater by the fold down the ridge. A hill (base camp) has a flat top and no fold.
 */
const shapeOf = ({
  hill,
  cx,
  width: w,
  top,
  ground,
}: {
  hill: boolean;
  cx: number;
  width: number;
  top: number;
  ground: number;
}) => {
  const lip = w * (hill ? 0.05 : 0.06);
  const shoulder = hill ? 0.62 : 0.72;
  const L: Point = [cx - w / 2, ground];
  const SL: Point = [cx - w * (hill ? 0.3 : 0.2), ground - (ground - top) * shoulder];
  const TL: Point = [cx - lip, top];
  const TR: Point = [cx + lip, top];
  const SR: Point = [cx + w * 0.22, ground - (ground - top) * (shoulder - 0.05)];
  const R: Point = [cx + w / 2, ground];
  const foot: Point = [cx, ground];
  if (hill)
    return {
      line: [L, SL, TL, TR, SR, R],
      lit: [L, SL, TL, foot],
      shaded: [foot, TL, TR, SR, R],
      fold: null,
    };
  const crater: Point = [cx, top + 7];
  const rim: Point = [cx + lip, top + 2];
  return {
    line: [L, SL, TL, crater, rim, SR, R],
    lit: [L, SL, TL, crater, foot],
    shaded: [foot, crater, rim, SR, R],
    fold: [crater, foot],
  };
};

export const ridge = (climbs: readonly Climb[], frame: RidgeFrame): Ridge => {
  const first = climbs[0]!;
  const last = climbs[climbs.length - 1]!;
  const ceilingM = Math.max(frame.ceilingM, Math.max(...climbs.map((c) => c.elevationM)) * 1.05);
  const x = (t: number) => ((t - first.start) / (last.end - first.start)) * frame.width;
  const y = (m: number) =>
    frame.baseline - ((m - frame.floorM) / (ceilingM - frame.floorM)) * (frame.baseline - frame.top);
  const ground = frame.baseline;

  const outlines: Point[][] = [];
  const peaks = climbs.map((c, i): Peak => {
    const x0 = x(c.start);
    const x1 = x(c.end);
    const hill = i === 0;
    // Volcanoes spread past their stretch and overlap, as a range does; base camp is a low hill.
    const cx = hill ? x0 + (x1 - x0) * 0.55 : (x0 + x1) / 2;
    const top = y(c.elevationM);
    // Base camp's hill reaches into the first volcano's foot, so the range has no gap to ground.
    const s = shapeOf({ hill, cx, width: (x1 - x0) * 1.45, top, ground });
    outlines.push(s.line);
    const contours: number[] = [];
    for (let m = Math.ceil(frame.floorM / CONTOUR_M) * CONTOUR_M; m < c.elevationM; m += CONTOUR_M)
      if (y(m) < ground) contours.push(Number(y(m).toFixed(1)));
    return {
      major: c.major,
      x0,
      x1,
      summit: [cx, top],
      lit: path(s.lit, true),
      shaded: path(s.shaded, true),
      outline: path(s.line),
      fold: s.fold ? path(s.fold) : null,
      shape: path(s.line, true),
      contours,
      labelX: cx,
      capY: hill ? null : Number((top + (ground - top) * 0.2).toFixed(1)),
      high: c.elevationM >= 3000,
    };
  });

  // The route: the skyline, lifted a few px so it reads as walking on it, up to the last summit.
  const end = peaks[peaks.length - 1]!.summit[0];
  // Rounded where the range dips (a saddle is walked as a gentle curve, not a notch), never lower
  // than the skyline itself, so it doesn't sink into a crest.
  const xs: number[] = [];
  for (let px = 0; px < end; px += 4) xs.push(px);
  xs.push(end);
  const raw = xs.map((px) => skylineAt(outlines, px, ground) - 5);
  const route: Point[] = xs.map((px, k) => {
    const near = raw.slice(Math.max(0, k - 12), k + 13);
    const eased = near.reduce((sum, y) => sum + y, 0) / near.length;
    return [px, Math.min(raw[k]!, eased)];
  });

  // A far range: a gentle, fixed wave behind everything.
  const far: Point[] = [[0, ground]];
  for (let px = 0; px <= frame.width; px += 25)
    far.push([
      px,
      ground - (ground - frame.top) * 0.28 - 38 * Math.sin(px / 61) - 22 * Math.sin(px / 23 + 1),
    ]);
  far.push([frame.width, ground]);

  return {
    peaks,
    far: path(far, true),
    route: path(route),
    routeEnd: end,
    guides: [1000, 2000, 3000, 4000, 5000]
      .filter((m) => m > frame.floorM && m < ceilingM)
      .map((m) => ({ m, y: Number(y(m).toFixed(1)) })),
  };
};
