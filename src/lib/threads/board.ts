/**
 * The board of the falling-blocks puzzle as a bitboard (Threads essay, M3): one number per row,
 * one bit per column, row 0 at the bottom. Checking a collision is an AND, placing a piece is
 * an OR, a full row is `row === full`, and copying the board is copying `height` numbers. In
 * 2022 the board was a `char**` and every attempt allocated a new one; this is the main reason
 * the new engine is fast.
 */
import { ROTATIONS, type PieceName, type Rotation } from './pieces';

export interface Board {
  width: number;
  height: number;
  /** Bit masks, bottom row first; bit c is column c. */
  rows: Uint16Array;
}

/** One way to place a piece: which rotation, how far right, where it lands, what it leaves. */
export interface Placement {
  piece: PieceName;
  rotation: number;
  x: number;
  y: number;
  lines: number;
  board: Board;
}

export const MAX_WIDTH = 16;

export function emptyBoard(width = 10, height = 20): Board {
  if (width < 4 || width > MAX_WIDTH) throw new Error(`Board width must be 4–${MAX_WIDTH}, got ${width}`);
  if (height < 4) throw new Error(`Board height must be at least 4, got ${height}`);
  return { width, height, rows: new Uint16Array(height) };
}

/**
 * A board from text, top row first: `#` is a filled cell, anything else is empty. Handy for
 * tests and for the essay's examples.
 */
export function boardFromText(lines: readonly string[], height = lines.length): Board {
  const width = lines[0]?.length ?? 0;
  const board = emptyBoard(width, height);
  lines.forEach((line, i) => {
    const y = lines.length - 1 - i;
    for (let x = 0; x < width; x++) if (line[x] === '#') board.rows[y]! |= 1 << x;
  });
  return board;
}

export function boardToText(board: Board): string[] {
  const out: string[] = [];
  for (let y = board.height - 1; y >= 0; y--) {
    let line = '';
    for (let x = 0; x < board.width; x++) line += board.rows[y]! & (1 << x) ? '#' : '.';
    out.push(line);
  }
  return out;
}

export const fullRow = (board: Board): number => (1 << board.width) - 1;

/** How tall each column is: the index of its highest filled cell, plus one (0 when empty). */
export function columnHeights(board: Board): number[] {
  const heights = new Array<number>(board.width).fill(0);
  for (let y = board.height - 1; y >= 0; y--) {
    const row = board.rows[y]!;
    if (!row) continue;
    for (let x = 0; x < board.width; x++) if (heights[x] === 0 && row & (1 << x)) heights[x] = y + 1;
  }
  return heights;
}

/**
 * The row where a rotation lands when dropped straight down at column x, or -1 if it doesn't
 * fit under the top. Uses the column heights, so it costs one step per piece column.
 */
export function landingRow(board: Board, heights: readonly number[], rotation: Rotation, x: number): number {
  let y = 0;
  for (let c = 0; c < rotation.width; c++) y = Math.max(y, heights[x + c]! - rotation.bottom[c]!);
  return y + rotation.height <= board.height ? y : -1;
}

/** The board after placing a rotation at (x, y), with full rows cleared and the rest dropped. */
export function place(
  board: Board,
  rotation: Rotation,
  x: number,
  y: number,
): { board: Board; lines: number } {
  const rows = board.rows.slice();
  rotation.rows.forEach((mask, i) => {
    rows[y + i]! |= mask << x;
  });
  const full = fullRow(board);
  let write = 0;
  let lines = 0;
  for (let read = 0; read < rows.length; read++) {
    if (rows[read] === full) lines++;
    else rows[write++] = rows[read]!;
  }
  rows.fill(0, write);
  return { board: { width: board.width, height: board.height, rows }, lines };
}

/** Every legal placement of a piece, rotation by rotation and left to right. */
export function placements(board: Board, piece: PieceName): Placement[] {
  const heights = columnHeights(board);
  const out: Placement[] = [];
  ROTATIONS[piece].forEach((rotation, r) => {
    for (let x = 0; x + rotation.width <= board.width; x++) {
      const y = landingRow(board, heights, rotation, x);
      if (y < 0) continue;
      const after = place(board, rotation, x, y);
      out.push({ piece, rotation: r, x, y, lines: after.lines, board: after.board });
    }
  });
  return out;
}
