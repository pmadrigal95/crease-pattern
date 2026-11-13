import { describe, expect, test } from 'vitest';
import {
  boardFromText,
  boardToText,
  columnHeights,
  emptyBoard,
  placements,
  type Board,
} from '../../src/lib/threads/board';
import { PIECE_NAMES, ROTATIONS, type PieceName } from '../../src/lib/threads/pieces';
import { features, pickBest, play, rootTasks, search, solveTask } from '../../src/lib/threads/search';

// The Threads engine (M3.1). Golden cases written for this site, plus properties checked on
// seeded random boards: the parallel split and the memo must never change the answer.

/** Small seeded PRNG (mulberry32), so random cases are the same on every run. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A messy but legal board: random stacks up to `maxHeight`, with holes, and no full rows. */
function randomBoard(seed: number, maxHeight = 8): Board {
  const rand = prng(seed);
  const board = emptyBoard();
  for (let x = 0; x < board.width; x++) {
    const h = Math.floor(rand() * maxHeight);
    for (let y = 0; y < h; y++) if (rand() > 0.2) board.rows[y]! |= 1 << x;
  }
  const full = (1 << board.width) - 1;
  for (let y = 0; y < board.height; y++)
    if (board.rows[y] === full) board.rows[y]! &= ~(1 << (y % board.width));
  return board;
}
const randomPieces = (seed: number, n: number): PieceName[] => {
  const rand = prng(seed * 31 + 7);
  return Array.from({ length: n }, () => PIECE_NAMES[Math.floor(rand() * PIECE_NAMES.length)]!);
};

describe('pieces', () => {
  test('each piece has its distinct rotations and four cells', () => {
    const counts = Object.fromEntries(PIECE_NAMES.map((p) => [p, ROTATIONS[p].length]));
    expect(counts).toEqual({ I: 2, O: 1, T: 4, S: 2, Z: 2, J: 4, L: 4 });
    for (const p of PIECE_NAMES)
      for (const r of ROTATIONS[p]) {
        const cells = r.rows.reduce((n, row) => n + row.toString(2).replaceAll('0', '').length, 0);
        expect(cells).toBe(4);
      }
  });
});

describe('board', () => {
  test('text round trip and column heights', () => {
    const text = ['..........', '#.........', '##...#....', '###.##...#'];
    const board = boardFromText(text, 4);
    expect(boardToText(board)).toEqual(text);
    expect(columnHeights(board)).toEqual([3, 2, 1, 0, 1, 2, 0, 0, 0, 1]);
  });

  test('a vertical I in the only gap clears four lines and empties the board', () => {
    const board = boardFromText(['#########.', '#########.', '#########.', '#########.'], 20);
    const vertical = placements(board, 'I').find((p) => p.x === 9 && p.lines > 0)!;
    expect(vertical.lines).toBe(4);
    expect(vertical.board.rows.every((row) => row === 0)).toBe(true);
  });

  test('a piece that would stick out of the top is not a legal placement', () => {
    const tall = boardFromText(
      Array.from({ length: 6 }, () => '#########.'),
      6,
    );
    expect(placements(tall, 'O')).toEqual([]);
  });
});

describe('evaluation', () => {
  test('counts holes, bumpiness and aggregate height', () => {
    const board = boardFromText(['..........', '#.........', '..........', '#.#.......']);
    expect(features(board)).toEqual({ aggregateHeight: 3 + 1, holes: 1, bumpiness: 3 + 1 + 1 });
  });
});

describe('search', () => {
  test('finds the line clear one piece ahead', () => {
    const board = boardFromText(['#########.', '#########.', '#########.', '#########.'], 20);
    const found = search(board, ['I'], 1);
    expect(found.moves[0]).toMatchObject({ piece: 'I', x: 9, lines: 4 });
  });

  test('looking two pieces ahead can choose a different first move than looking one ahead', () => {
    const differs = Array.from({ length: 40 }, (_, seed) => {
      const board = randomBoard(seed);
      const pieces = randomPieces(seed, 2);
      const one = search(board, pieces, 1).moves[0];
      const two = search(board, pieces, 2).moves[0];
      return one?.x !== two?.x || one?.rotation !== two?.rotation;
    });
    expect(differs.some(Boolean)).toBe(true);
  });

  test.each(Array.from({ length: 12 }, (_, i) => i + 1))(
    'random board %i: the memo and the parallel split never change the answer',
    (seed) => {
      const board = randomBoard(seed);
      const pieces = randomPieces(seed, 3);
      const serial = search(board, pieces, 3);
      const memo = search(board, pieces, 3, { memo: true });
      expect(memo.score).toBe(serial.score);
      expect(memo.moves).toEqual(serial.moves);
      expect(memo.nodes).toBeLessThanOrEqual(serial.nodes);

      const split = pickBest(rootTasks(board, pieces).map((t) => solveTask(t, pieces, 3)));
      expect(split.score).toBe(serial.score);
      expect(split.moves).toEqual(serial.moves);
    },
  );

  test('the same input always gives the same game', () => {
    const board = randomBoard(99, 4);
    const pieces = randomPieces(99, 14);
    expect(play(board, pieces, 2)).toEqual(play(board, pieces, 2));
  });

  test('a whole game keeps the board legal and counts its lines', () => {
    const pieces = randomPieces(5, 30);
    const game = play(emptyBoard(), pieces, 2);
    expect(game.toppedOut).toBe(false);
    expect(game.moves).toHaveLength(30);
    expect(game.lines).toBe(game.moves.reduce((n, m) => n + m.lines, 0));
    expect(game.lines).toBeGreaterThan(0);
  });
});
