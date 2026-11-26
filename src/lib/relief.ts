/**
 * The career as four paper models of real terrain, at the top of /changelog on a device that can
 * draw them (src/components/site/changelog3d.ts). Pure geometry, no three.js, so it can be tested.
 *
 * The data: Copernicus GLO-30 elevation (30 m), cropped to ±0.06° (about 13 km a side) around each
 * place of the career and averaged into grids of whole metres, uint16 little-endian, rows north to
 * south, columns west to east. Cartago, Poás and Turrialba are 97 × 97
 * (src/assets/scenes/{cartago,poas,turrialba}-dem.bin, each sample the mean of 3 × 3 points about
 * 30 m apart); the Irazú reuses the hero's 161 × 161 grid (irazu-dem.bin, IRAZU_DEM in
 * ./identity-scenes), sampled down to 97 here so every model has the same facets.
 *
 * Laid out in a row in the order of the career, each model is a square tile on a thin slab under
 * its own lowest point. The route crosses each tile along its summit's row and ends on the Irazú's
 * summit, now.
 */
export const RELIEF = {
  /** Vertices per side of every model. */
  size: 97,
  /** A tile's side, in scene units: 13 km. */
  tile: 26,
  /** Space between two tiles. */
  gap: 5,
  /** Width of the crop, in km. */
  km: 13,
  /** Heights are drawn this much taller than true scale, a little more than the hero's Irazú (×2). */
  exaggeration: 2.2,
  /** The height drawn at y = 0, below every place. */
  floorM: 700,
  /** How far the slab reaches under a model's lowest point. */
  slab: 0.9,
  /** The route rides this far above the ground, so it never sinks into a facet. */
  lift: 0.25,
  /** A volcano's summit is the highest point in the middle of its grid, this fraction from each edge. */
  inset: 0.29,
} as const;

/** Scene units per metre of height. */
const UNIT = (RELIEF.tile / RELIEF.km / 1000) * RELIEF.exaggeration;

/** A height in metres, in scene units. */
export const heightOf = (metres: number): number => (metres - RELIEF.floorM) * UNIT;

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

/** Row and column of a place's summit: the centre for base camp (a town), else the highest point near it. */
export const summitOf = (grid: ArrayLike<number>, n: number, town: boolean): [number, number] => {
  const mid = Math.floor((n - 1) / 2);
  let best: [number, number] = [mid, mid];
  if (town) return best;
  const lo = Math.round((n - 1) * RELIEF.inset);
  const hi = n - 1 - lo;
  for (let r = lo; r <= hi; r++)
    for (let c = lo; c <= hi; c++)
      if ((grid[r * n + c] ?? 0) > (grid[best[0] * n + best[1]] ?? 0)) best = [r, c];
  return best;
};

export interface ReliefTile {
  major: number;
  /** Metres, `size` × `size`, rows north to south. */
  grid: Float32Array;
  /** x of the tile's west edge. */
  left: number;
  summit: [number, number];
  /** y of the slab under the tile. */
  base: number;
}

export interface Relief {
  tiles: ReliefTile[];
  /** From the west edge of the first tile to the east edge of the last. */
  width: number;
  /** y of the highest summit. */
  top: number;
  /** The route, x y z per point, west to east. */
  route: Float32Array;
  /** Per tile, the index of its first point on the route. */
  starts: number[];
  /** Per tile, the index of its summit on the route. */
  summits: number[];
}

/** x of a column of a tile. */
export const columnX = (tile: ReliefTile, c: number): number =>
  tile.left + (c / (RELIEF.size - 1)) * RELIEF.tile;
/** z of a row: north is away from the camera. */
export const rowZ = (r: number): number => (r / (RELIEF.size - 1)) * RELIEF.tile - RELIEF.tile / 2;
/** Metres at a row and column of a tile, clamped to its edges. */
export const metresAt = (tile: ReliefTile, r: number, c: number): number => {
  const n = RELIEF.size;
  const clamp = (v: number) => Math.max(0, Math.min(n - 1, v));
  return tile.grid[clamp(r) * n + clamp(c)] ?? 0;
};

/**
 * The four models in a row from the grids in the order of the career (`size` × `size` each, or any
 * square grid, resampled), and the route across them. The first place is base camp, a town.
 */
export const relief = (places: { major: number; grid: ArrayLike<number> }[]): Relief => {
  const n = RELIEF.size;
  const tiles = places.map(({ major, grid }, i): ReliefTile => {
    const side = Math.round(Math.sqrt(grid.length));
    const g = resample(grid, side, n);
    let low = Infinity;
    for (const m of g) low = Math.min(low, m);
    return {
      major,
      grid: g,
      left: i * (RELIEF.tile + RELIEF.gap),
      summit: summitOf(g, n, i === 0),
      base: heightOf(low) - RELIEF.slab,
    };
  });
  const points: number[] = [];
  const starts: number[] = [];
  const summits: number[] = [];
  let top = -Infinity;
  tiles.forEach((tile, i) => {
    const [sr, sc] = tile.summit;
    const last = i === tiles.length - 1;
    starts.push(points.length / 3);
    top = Math.max(top, heightOf(metresAt(tile, sr, sc)));
    for (let c = 0; c <= (last ? sc : n - 1); c++) {
      if (c === sc) summits.push(points.length / 3);
      points.push(columnX(tile, c), heightOf(metresAt(tile, sr, c)) + RELIEF.lift, rowZ(sr));
    }
  });
  const width = tiles.length * RELIEF.tile + (tiles.length - 1) * RELIEF.gap;
  return { tiles, width, top, route: Float32Array.from(points), starts, summits };
};

/** How many points the route has. */
export const routeLength = (r: Relief): number => r.route.length / 3;

/** The route's point at `progress` (0 at the start, 1 on the Irazú's summit). */
export const pointAt = (r: Relief, progress: number): [number, number, number] => {
  const i = indexAt(r, progress) * 3;
  return [r.route[i] ?? 0, r.route[i + 1] ?? 0, r.route[i + 2] ?? 0];
};

/** The route's point index at `progress`. */
export const indexAt = (r: Relief, progress: number): number =>
  Math.round(Math.max(0, Math.min(1, progress)) * (routeLength(r) - 1));

/** Which tile the route is on at `progress`. */
export const tileAt = (r: Relief, progress: number): number => {
  const i = indexAt(r, progress);
  return Math.max(
    0,
    r.starts.findLastIndex((s) => i >= s),
  );
};

/** The progress at tile `i`'s summit. */
export const progressAt = (r: Relief, i: number): number => {
  const k = Math.max(0, Math.min(r.summits.length - 1, i));
  return (r.summits[k] ?? 0) / (routeLength(r) - 1);
};
