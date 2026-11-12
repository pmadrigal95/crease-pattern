/**
 * Geometry for the career drawn as a climb (design debt phase 2): the elevation chart on the
 * home page. Pure functions, no DOM: given the releases and a frame, they return SVG path data
 * and positions, the same on every build. Components only draw what comes back.
 *
 * The chart reads like an elevation chart in a fitness app: one smooth line, a fill that fades
 * toward the baseline, a few altitude guides, and the release names along the axis, one stretch
 * each. Adding a release is adding one entry to career.json; the layout makes room for it, and
 * tests/unit/altitude.test.ts checks the names still fit, with a made-up v4 included.
 */

/** One release as the drawing needs it: when it ran (decimal years) and how high it is. */
export interface Climb {
  major: number;
  codename: string;
  elevationM: number;
  theme: string;
  start: number;
  end: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Space above the line, for the readout. */
  top: number;
  /** Space under the baseline, for the release names. */
  bottom: number;
  /** Space at the right, for the altitude guides' labels. */
  right: number;
  /** Altitudes mapped to the bottom and top of the plot. */
  floorM: number;
  ceilingM: number;
  /** Font size of the axis names, to check they fit their stretch. */
  axisFont: number;
}

/** One release along the axis: its stretch, its peak and how its name is shown. */
export interface Stretch {
  major: number;
  x0: number;
  x1: number;
  /** Where the name sits (centre of the stretch). */
  labelX: number;
  /** False when the name is wider than the stretch: then the axis shows "v2" instead. */
  fullName: boolean;
  peak: { x: number; y: number };
}

export interface Profile {
  line: string;
  /** The line closed down to the baseline: the gradient fill. */
  area: string;
  baseline: number;
  plotRight: number;
  /** Altitude guides, every GUIDE_M. */
  guides: { y: number; m: number }[];
  stretches: Stretch[];
  here: { x: number; y: number };
}

/** "2019-09" → 2019.67; "2015" → 2015. */
export const decimalYear = (yearMonth: string): number => {
  const [y = 0, m = 1] = yearMonth.split('-').map(Number);
  return y + (m - 1) / 12;
};

/** Decimal year of a date, for "today" at the end of the chart. */
export const yearOf = (date: Date): number =>
  date.getUTCFullYear() + date.getUTCMonth() / 12 + (date.getUTCDate() - 1) / 365;

/** Altitude guides: few and quiet, like the grid of a health or weather chart. */
export const GUIDE_M = 1000;

/** Text width estimate (average glyph width × length), generous so a fit is never a surprise. */
export const textWidth = (text: string, size: number): number => text.length * size * 0.58;

/**
 * The elevation chart: time left to right, altitude up. Each release rises to its peak and
 * eases to a saddle before the next; the last ends on its summit, where "you are here" goes.
 */
export function profile(climbs: readonly Climb[], frame: Frame): Profile {
  if (climbs.length === 0) throw new Error('profile() needs at least one release');
  const sorted = [...climbs].sort((a, b) => a.start - b.start);
  const from = sorted[0]!.start;
  const to = sorted[sorted.length - 1]!.end;
  const baseline = frame.height - frame.bottom;
  const plotRight = frame.width - frame.right;
  const x = (t: number) => ((t - from) / (to - from)) * plotRight;
  const y = (m: number) =>
    baseline - ((m - frame.floorM) / (frame.ceilingM - frame.floorM)) * (baseline - frame.top);

  const points: [number, number][] = [];
  const stretches: Stretch[] = [];
  sorted.forEach((c, i) => {
    const next = sorted[i + 1];
    const peakAt = c.start + (c.end - c.start) * (next ? 0.55 : 0.5);
    const low = c.elevationM - (c.elevationM - frame.floorM) * 0.3;
    if (i === 0) points.push([c.start, low]);
    points.push([c.start + (peakAt - c.start) * 0.45, c.elevationM - (c.elevationM - low) * 0.6]);
    points.push([peakAt, c.elevationM]);
    if (next) {
      const saddle = Math.min(c.elevationM, next.elevationM);
      points.push([c.end, saddle - (saddle - frame.floorM) * 0.2]);
    } else points.push([c.end, c.elevationM - (c.elevationM - frame.floorM) * 0.02]);

    const x0 = x(c.start);
    const x1 = x(c.end);
    stretches.push({
      major: c.major,
      x0: round(x0),
      x1: round(x1),
      labelX: round((x0 + x1) / 2),
      fullName: textWidth(c.codename, frame.axisFont) <= x1 - x0 - 8,
      peak: { x: round(x(peakAt)), y: round(y(c.elevationM)) },
    });
  });

  const xy = points.map(([t, m]) => [x(t), y(m)] as [number, number]);
  const line = smooth(xy);
  const first = xy[0]!;
  const end = xy[xy.length - 1]!;
  const area = `${line} L${round(end[0])},${baseline} L${round(first[0])},${baseline} Z`;

  const guides: Profile['guides'] = [];
  for (let m = Math.ceil(frame.floorM / GUIDE_M) * GUIDE_M; m < frame.ceilingM; m += GUIDE_M)
    if (m > frame.floorM) guides.push({ y: round(y(m)), m });

  return { line, area, baseline, plotRight, guides, stretches, here: { x: round(end[0]), y: round(end[1]) } };
}

/** A smooth path through the points (Catmull-Rom as cubic Béziers). */
function smooth(points: [number, number][]): string {
  const [first] = points;
  if (!first) return '';
  let d = `M${round(first[0])},${round(first[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${round(c1[0]!)},${round(c1[1]!)} ${round(c2[0]!)},${round(c2[1]!)} ${round(p2[0])},${round(p2[1])}`;
  }
  return d;
}

const round = (n: number) => Math.round(n * 10) / 10;
