/**
 * The career's places as topographic models of cut paper, at the top of /changelog on a device that
 * can draw them (src/components/site/changelog3d.ts, doc 37). Pure, no three.js, so it can be
 * tested: the sheets' heights and the masks they are cut from.
 *
 * The data: Copernicus GLO-30 elevation (30 m), cropped to ±0.06° (about 13 km a side) around each
 * place of the career and averaged into grids of whole metres, uint16 little-endian, rows north to
 * south, columns west to east. Cartago, Poás and Turrialba are 97 × 97
 * (src/assets/scenes/{cartago,poas,turrialba}-dem.bin); the Irazú reuses the hero's 161 × 161 grid
 * (irazu-dem.bin, IRAZU_DEM in ./identity-scenes), sampled down to 97 so every model matches.
 *
 * Each place is a round model: one sheet of paper per 100 m contour, cut to where the ground is at
 * least that high and stacked at its height, on a base disc.
 */
export const RELIEF = {
  /** Samples per side of every grid. */
  size: 97,
  /** A model's diameter in scene units: 13 km. */
  tile: 26,
  /** Space between two models. */
  gap: 10,
  /** Width of the crop, in km. */
  km: 13,
  /** Heights are drawn this much taller than true scale, as the hero's Irazú (×2) and a little more. */
  exaggeration: 2.2,
  /** Metres between two sheets: one per contour line. */
  step: 100,
  /** Texels per side of a sheet's mask. */
  res: 256,
  /** The model's radius, as a fraction of the crop's side. */
  cut: 0.47,
  /** Metres over which a sheet's edge softens, so its cut reads smooth once filtered. */
  soft: 4,
} as const;

/** Scene units per metre of height. */
const UNIT = (RELIEF.tile / RELIEF.km / 1000) * RELIEF.exaggeration;

/** A square grid of `from` × `from` samples, bilinearly resampled to `to` × `to` over the same area. */
export const resample = (grid: ArrayLike<number>, from: number, to: number): Float32Array => {
  if (grid.length !== from * from)
    throw new Error(`relief: expected ${from * from} samples, got ${grid.length}`);
  const out = new Float32Array(to * to);
  const at = (r: number, c: number) => grid[r * from + c] ?? 0;
  for (let r = 0; r < to; r++) {
    const y = (r / (to - 1)) * (from - 1);
    const r0 = Math.min(from - 2, Math.floor(y));
    const fy = y - r0;
    for (let c = 0; c < to; c++) {
      const x = (c / (to - 1)) * (from - 1);
      const c0 = Math.min(from - 2, Math.floor(x));
      const fx = x - c0;
      const top = at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx;
      const bottom = at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx;
      out[r * to + c] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
};

/** The mean of a sample and its neighbours inside the grid. */
const around = (a: Float32Array, n: number, r: number, c: number): number => {
  let sum = 0;
  let k = 0;
  for (let rr = Math.max(0, r - 1); rr <= Math.min(n - 1, r + 1); rr++)
    for (let cc = Math.max(0, c - 1); cc <= Math.min(n - 1, c + 1); cc++) {
      sum += a[rr * n + cc] ?? 0;
      k++;
    }
  return sum / k;
};

/** The grid averaged over each sample's 3 × 3 neighbours, `passes` times: softer cuts. */
export const smooth = (grid: ArrayLike<number>, n: number, passes: number): Float32Array => {
  let a = Float32Array.from(grid);
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(n * n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) b[r * n + c] = around(a, n, r, c);
    a = b;
  }
  return a;
};

export interface Model {
  /** Metres, `size` × `size`, smoothed. */
  grid: Float32Array;
  /** Lowest and highest metres inside the model's disc. */
  low: number;
  top: number;
  /** The contours it is cut at, in metres, lowest first: every `step` above `low`. */
  levels: number[];
}

/** Whether a grid sample at row `r`, column `c` of an `n`-sided grid lies on the model's disc. */
const onDisc = (r: number, c: number, n: number) =>
  Math.hypot(c / (n - 1) - 0.5, r / (n - 1) - 0.5) <= RELIEF.cut;

/** A place as a model: its smoothed grid (any square size, resampled), its range and its sheets. */
export const model = (grid: ArrayLike<number>): Model => {
  const n = RELIEF.size;
  const side = Math.round(Math.sqrt(grid.length));
  const g = smooth(resample(grid, side, n), n, 2);
  let low = Infinity;
  let top = -Infinity;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!onDisc(r, c, n)) continue;
      const m = g[r * n + c] ?? 0;
      low = Math.min(low, m);
      top = Math.max(top, m);
    }
  const levels: number[] = [];
  for (let m = Math.ceil(low / RELIEF.step) * RELIEF.step; m < top; m += RELIEF.step) levels.push(m);
  return { grid: g, low, top, levels };
};

/** A height in metres, in scene units above the model's base, for a model whose lowest point is `low`. */
export const heightOf = (metres: number, low: number): number => (metres - low) * UNIT * 0.9 + 0.3;

/** The model's grid sampled at `res` × `res`, for the masks. */
export const sampled = (m: Model, res: number = RELIEF.res): Float32Array =>
  resample(m.grid, RELIEF.size, res);

/**
 * The mask a sheet is cut from: RGBA, opaque where the ground is at least `level` metres high and
 * inside the disc, with a soft edge `RELIEF.soft` metres (and a texel or two of the disc) wide.
 */
export const sheetMask = (heights: Float32Array, level: number, res: number = RELIEF.res): Uint8Array => {
  const out = new Uint8Array(res * res * 4);
  for (let q = 0; q < res * res; q++) {
    const dx = (q % res) / (res - 1) - 0.5;
    const dy = Math.floor(q / res) / (res - 1) - 0.5;
    const inside = Math.max(0, Math.min(1, (RELIEF.cut - Math.hypot(dx, dy)) * res * 0.5 + 0.5));
    const above = Math.max(0, Math.min(1, ((heights[q] ?? 0) - level) / RELIEF.soft + 0.5));
    const a = Math.round(255 * above * inside);
    out[q * 4] = a;
    out[q * 4 + 1] = a;
    out[q * 4 + 2] = a;
    out[q * 4 + 3] = 255;
  }
  return out;
};
