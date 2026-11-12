// Shared by the surface-texture generators (scripts/build-textures.mjs): a seeded random source, the
// compact path encoding and the SVG wrapper, so every tile is built and sized the same way.

/** Small deterministic PRNG (mulberry32): same seed, same tile, so the files can be committed. */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Coordinates are written on a 2x grid: whole numbers keep files small and still place points to half a CSS pixel. */
export const SCALE = 2;

/** Polylines (arrays of [x, y] in tile units) as one path in relative moves. */
export function pathFrom(polylines, { closed = false } = {}) {
  return polylines
    .map((line) => {
      const pts = line.map(([x, y]) => [Math.round(x * SCALE), Math.round(y * SCALE)]);
      const [first, ...rest] = pts;
      let [px, py] = first;
      const moves = rest.map(([x, y]) => {
        const move = `${x - px} ${y - py}`;
        [px, py] = [x, y];
        return move;
      });
      return `M${first[0]} ${first[1]}l${moves.join(' ').replace(/ -/g, '-')}${closed ? 'z' : ''}`;
    })
    .join('');
}

/** A square tile: one stroked path per layer, black on transparent (the CSS uses it as a mask). */
export function tileSvg(tile, layers) {
  const size = tile * SCALE;
  const paths = layers
    .map(({ d, width }) => `<path d="${d}" fill="none" stroke="#000" stroke-width="${width * SCALE}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${paths}</svg>\n`;
}
