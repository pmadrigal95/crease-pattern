/**
 * The career as a map (design debt phase 2): the volcanoes where each release is named, at their
 * real coordinates, with contour lines and the route in the order they were climbed. Pure
 * functions, no DOM, the same output on every build; ExpeditionMap.astro only draws it.
 *
 * The terrain is a height field: one smooth bump per place, as tall as its altitude above the
 * Central Valley, blended with a soft maximum so neighbouring volcanoes (Irazú and Turrialba)
 * share one massif instead of stacking rings. Contours are traced with marching squares and
 * joined into polylines, so the SVG stays small.
 */
import { textWidth } from './altitude';
import { formatNumber } from './format';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Place {
  major: number;
  codename: string;
  elevationM: number;
  lat: number;
  lon: number;
}

export interface MapFrame {
  width: number;
  height: number;
  /** Margin around the places, so their slopes and labels fit; per side, since labels lean right. */
  pad: { top: number; right: number; bottom: number; left: number };
  /** Size of a marching-squares cell, in SVG units: smaller is smoother and heavier. */
  cell: number;
  /** Altitude of the valley floor the volcanoes rise from. */
  floorM: number;
  /** Contour interval; every fourth line is an index contour, drawn heavier. */
  intervalM: number;
  /** Phones: labels show the name only, in a smaller size. */
  compact?: boolean;
}

export interface Pin {
  major: number;
  x: number;
  y: number;
  /** `short`: the label shows only the version ("v4"), when the name fits nowhere. */
  label: { x: number; y: number; anchor: 'start' | 'end' | 'middle'; box: Box; short: boolean };
}

export interface ExpeditionMapGeometry {
  contours: { m: number; index: boolean; d: string }[];
  route: string;
  pins: Pin[];
}

const LABEL = { name: 15, detail: 12, compact: 13, gap: 14, lineGap: 16 } as const;
const PIN_RADIUS = 8;

export function expeditionMap(places: readonly Place[], frame: MapFrame): ExpeditionMapGeometry {
  if (places.length === 0) throw new Error('expeditionMap() needs at least one place');
  const project = projection(places, frame);
  const points = places.map((p) => ({ place: p, ...project(p.lat, p.lon) }));

  // One bump per place. Its width grows with its height, like a real cone.
  const span = Math.min(frame.width, frame.height);
  const bumps = points.map(({ place, x, y }) => {
    const h = Math.max(place.elevationM - frame.floorM, 0);
    return { x, y, h, sigma: span * (0.07 + 0.09 * Math.sqrt(h / 2500)) };
  });
  const P = 4;
  const height = (x: number, y: number) => {
    let sum = 0;
    for (const b of bumps) {
      const e = b.h * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.sigma ** 2));
      sum += e ** P;
    }
    return frame.floorM + sum ** (1 / P);
  };

  const cols = Math.ceil(frame.width / frame.cell);
  const rows = Math.ceil(frame.height / frame.cell);
  const field: number[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: number[] = [];
    for (let c = 0; c <= cols; c++) row.push(height(c * frame.cell, r * frame.cell));
    field.push(row);
  }
  const top = Math.max(...points.map((p) => p.place.elevationM));
  const contours: ExpeditionMapGeometry['contours'] = [];
  for (let m = frame.floorM + frame.intervalM; m < top; m += frame.intervalM) {
    const d = polylines(march(field, m, frame.cell));
    if (d) contours.push({ m, index: (m / frame.intervalM) % 4 === 0, d });
  }

  // The route runs straight from summit to summit, like a trail on a map, with round joins.
  const ordered = [...points].sort((a, b) => a.place.major - b.place.major);
  const route = 'M' + ordered.map((p) => `${p.x},${p.y}`).join('L');
  const legs = ordered.slice(1).map((p, i) => [ordered[i]!, p] as const);
  const pins = placeLabels(ordered, frame, legs);
  return { contours, route, pins };
}

/** Equirectangular projection fitted to the frame, with longitude scaled by latitude. */
function projection(places: readonly Place[], frame: MapFrame) {
  const lats = places.map((p) => p.lat);
  const lons = places.map((p) => p.lon);
  const [latMin, latMax] = [Math.min(...lats), Math.max(...lats)];
  const [lonMin, lonMax] = [Math.min(...lons), Math.max(...lons)];
  const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180);
  const spanX = Math.max((lonMax - lonMin) * k, 1e-6);
  const spanY = Math.max(latMax - latMin, 1e-6);
  const { top, right, bottom, left } = frame.pad;
  const innerW = frame.width - left - right;
  const innerH = frame.height - top - bottom;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = left + (innerW - spanX * scale) / 2;
  const offY = top + (innerH - spanY * scale) / 2;
  return (lat: number, lon: number) => ({
    x: round(offX + (lon - lonMin) * k * scale),
    y: round(offY + (latMax - lat) * scale),
  });
}

/** Marching squares: the segments where the field crosses `level`. */
function march(field: number[][], level: number, cell: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let r = 0; r < field.length - 1; r++) {
    for (let c = 0; c < field[0]!.length - 1; c++) {
      const a = field[r]![c]!;
      const b = field[r]![c + 1]!;
      const d = field[r + 1]![c]!;
      const e = field[r + 1]![c + 1]!;
      const x0 = c * cell;
      const y0 = r * cell;
      // Edge crossings: top, right, bottom, left.
      const cross: [number, number][] = [];
      const lerp = (v1: number, v2: number) => (level - v1) / (v2 - v1);
      if (a < level !== b < level) cross.push([x0 + lerp(a, b) * cell, y0]);
      if (b < level !== e < level) cross.push([x0 + cell, y0 + lerp(b, e) * cell]);
      if (d < level !== e < level) cross.push([x0 + lerp(d, e) * cell, y0 + cell]);
      if (a < level !== d < level) cross.push([x0, y0 + lerp(a, d) * cell]);
      if (cross.length === 2) out.push([...cross[0]!, ...cross[1]!]);
      else if (cross.length === 4) out.push([...cross[0]!, ...cross[1]!], [...cross[2]!, ...cross[3]!]);
    }
  }
  return out;
}

/** Joins segments that share an end into polylines and writes them as one path. */
function polylines(segments: [number, number, number, number][]): string {
  const key = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
  const ends = new Map<string, number[]>();
  segments.forEach(([x1, y1, x2, y2], i) => {
    for (const k of [key(x1, y1), key(x2, y2)]) ends.set(k, [...(ends.get(k) ?? []), i]);
  });
  const used = new Set<number>();
  const lines: [number, number][][] = [];
  segments.forEach((seg, start) => {
    if (used.has(start)) return;
    used.add(start);
    const line: [number, number][] = [
      [seg[0], seg[1]],
      [seg[2], seg[3]],
    ];
    // Grow from the tail, then from the head.
    for (const grow of ['tail', 'head'] as const) {
      for (;;) {
        const [x, y] = grow === 'tail' ? line[line.length - 1]! : line[0]!;
        const next = (ends.get(key(x, y)) ?? []).find((i) => !used.has(i));
        if (next === undefined) break;
        used.add(next);
        const [a1, b1, a2, b2] = segments[next]!;
        const far: [number, number] = key(a1, b1) === key(x, y) ? [a2, b2] : [a1, b1];
        if (grow === 'tail') line.push(far);
        else line.unshift(far);
      }
    }
    lines.push(line);
  });
  return lines
    .filter((l) => l.length > 2)
    .map((l) => 'M' + l.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join('L'))
    .join('');
}

/**
 * Each pin's label (name, then altitude and version) goes on the first side that stays inside the
 * frame and clear of the other labels, the pins and the route: right, left, above, below, then
 * the four corners, as map labels are placed.
 */
function placeLabels(
  points: { place: Place; x: number; y: number }[],
  frame: MapFrame,
  legs: readonly (readonly [{ x: number; y: number }, { x: number; y: number }])[],
): Pin[] {
  const pinBoxes: Box[] = points.map((p) => ({
    x: p.x - PIN_RADIUS,
    y: p.y - PIN_RADIUS,
    width: 2 * PIN_RADIUS,
    height: 2 * PIN_RADIUS,
  }));
  const taken: Box[] = [];
  return points.map((p, i) => {
    const others = [...taken, ...pinBoxes.filter((_, j) => j !== i)];
    const inside = (b: Box) =>
      b.x >= 0 && b.y >= 0 && b.x + b.width <= frame.width && b.y + b.height <= frame.height;
    const clear = (b: Box) => !others.some((o) => overlaps(b, o)) && !legs.some(([a, z]) => crosses(b, a, z));
    // Full label first; on a phone, the name alone; if even that fits nowhere, the version ("v4").
    const sizes = frame.compact
      ? [
          { short: false, width: textWidth(p.place.codename, LABEL.compact), height: LABEL.compact + 2 },
          { short: true, width: textWidth(`v${p.place.major}`, LABEL.compact), height: LABEL.compact + 2 },
        ]
      : [
          {
            short: false,
            width: Math.max(
              textWidth(p.place.codename, LABEL.name),
              textWidth(`${formatNumber(p.place.elevationM)} m · v${p.place.major}`, LABEL.detail),
            ),
            height: LABEL.name + LABEL.lineGap,
          },
        ];
    let choice: { short: boolean; anchor: Pin['label']['anchor']; box: Box } | undefined;
    for (const { short, width, height } of sizes) {
      const found = candidatesAround(p, width, height).find((c) => inside(c.box) && clear(c.box));
      if (found) {
        choice = { short, ...found };
        break;
      }
    }
    if (!choice) {
      const { short, width, height } = sizes[sizes.length - 1]!;
      const fallback = candidatesAround(p, width, height);
      choice = { short, ...(fallback.find((c) => inside(c.box)) ?? fallback[0]!) };
    }
    const box = {
      x: round(choice.box.x),
      y: round(choice.box.y),
      width: round(choice.box.width),
      height: choice.box.height,
    };
    taken.push(box);
    const x =
      choice.anchor === 'start' ? box.x : choice.anchor === 'end' ? box.x + box.width : box.x + box.width / 2;
    const size = frame.compact ? LABEL.compact : LABEL.name;
    return {
      major: p.place.major,
      x: p.x,
      y: p.y,
      label: { x: round(x), y: round(box.y + size - 2), anchor: choice.anchor, box, short: choice.short },
    };
  });
}

/** The eight places a label can go around its pin, in order of preference. */
function candidatesAround(p: { x: number; y: number }, width: number, height: number) {
  const g = LABEL.gap;
  const d = g * 0.7;
  return [
    { anchor: 'start', box: { x: p.x + g, y: p.y - height / 2, width, height } },
    { anchor: 'end', box: { x: p.x - g - width, y: p.y - height / 2, width, height } },
    { anchor: 'middle', box: { x: p.x - width / 2, y: p.y - g - height, width, height } },
    { anchor: 'middle', box: { x: p.x - width / 2, y: p.y + g, width, height } },
    { anchor: 'start', box: { x: p.x + d, y: p.y - d - height, width, height } },
    { anchor: 'end', box: { x: p.x - d - width, y: p.y - d - height, width, height } },
    { anchor: 'start', box: { x: p.x + d, y: p.y + d, width, height } },
    { anchor: 'end', box: { x: p.x - d - width, y: p.y + d, width, height } },
  ] as const;
}

/** Whether the segment a→z passes through the box, padded a little for the line's width. */
export function crosses(box: Box, a: { x: number; y: number }, z: { x: number; y: number }): boolean {
  const pad = 3;
  const steps = Math.ceil(Math.hypot(z.x - a.x, z.y - a.y) / 3);
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((z.x - a.x) * i) / steps;
    const y = a.y + ((z.y - a.y) * i) / steps;
    if (x > box.x - pad && x < box.x + box.width + pad && y > box.y - pad && y < box.y + box.height + pad)
      return true;
  }
  return false;
}

/** Whether two boxes overlap (touching edges don't count). */
export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const round = (n: number) => Math.round(n * 10) / 10;
