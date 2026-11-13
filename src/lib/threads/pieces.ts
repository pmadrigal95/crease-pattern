/**
 * The seven pieces of the falling-blocks puzzle in the Threads essay (M3). Each shape is written
 * once as its cells; rotations come from turning it 90° and dropping the duplicates, and
 * everything the solver needs at a placement is computed here, once, at import.
 *
 * Coordinates: x grows to the right, y grows upward, and row 0 is a piece's bottom row.
 */

export const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceName = (typeof PIECE_NAMES)[number];

/** One rotation of a piece, ready to drop. */
export interface Rotation {
  /** Bit masks of the piece's rows, bottom first, with the leftmost cell at bit 0. */
  rows: readonly number[];
  width: number;
  height: number;
  /** For each column of the piece, the lowest row it fills (where it touches the stack first). */
  bottom: readonly number[];
}

type Cells = readonly (readonly [number, number])[];

const SHAPES: Record<PieceName, Cells> = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 0],
  ],
  S: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  Z: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
};

/** Moves the cells so the smallest x and y are 0, and sorts them, so equal shapes compare equal. */
function normalize(cells: Cells): Cells {
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  return cells
    .map(([x, y]) => [x - minX, y - minY] as const)
    .sort(([ax, ay], [bx, by]) => ay - by || ax - bx);
}

const turn = (cells: Cells): Cells => cells.map(([x, y]) => [y, -x] as const);

function toRotation(cells: Cells): Rotation {
  const width = Math.max(...cells.map(([x]) => x)) + 1;
  const height = Math.max(...cells.map(([, y]) => y)) + 1;
  const rows = Array.from({ length: height }, (_, y) =>
    cells.filter(([, cy]) => cy === y).reduce((mask, [x]) => mask | (1 << x), 0),
  );
  const bottom = Array.from({ length: width }, (_, x) =>
    Math.min(...cells.filter(([cx]) => cx === x).map(([, y]) => y)),
  );
  return { rows, width, height, bottom };
}

function rotationsOf(shape: Cells): Rotation[] {
  const seen = new Set<string>();
  const out: Rotation[] = [];
  let cells = normalize(shape);
  for (let i = 0; i < 4; i++) {
    const key = JSON.stringify(cells);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(toRotation(cells));
    }
    cells = normalize(turn(cells));
  }
  return out;
}

/** Every distinct rotation of every piece, computed once. */
export const ROTATIONS: Readonly<Record<PieceName, readonly Rotation[]>> = {
  I: rotationsOf(SHAPES.I),
  O: rotationsOf(SHAPES.O),
  T: rotationsOf(SHAPES.T),
  S: rotationsOf(SHAPES.S),
  Z: rotationsOf(SHAPES.Z),
  J: rotationsOf(SHAPES.J),
  L: rotationsOf(SHAPES.L),
};

export const isPieceName = (value: string): value is PieceName =>
  (PIECE_NAMES as readonly string[]).includes(value);
