import { expect, test } from 'vitest';
import { boardFromText } from '../../src/lib/threads/board';
import type { PieceName } from '../../src/lib/threads/pieces';
import { play, search } from '../../src/lib/threads/search';

// Benchmarks for the Threads engine (M3.1): how the work grows with the lookahead, and what the
// memo saves. Run with `pnpm bench:threads`; it prints a table (median of several runs) and is
// not part of `pnpm test`. The board and pieces are our own, not the 2022 course's. Numbers
// depend on the machine, so the essay states the one it used.
const board = boardFromText(
  [
    '..........',
    '..........',
    '....#.....',
    '...###....',
    '....#.....',
    '#..###...#',
    '##.####.##',
    '###.######',
  ],
  20,
);
const pieces: PieceName[] = ['T', 'I', 'S', 'L', 'O', 'Z', 'J', 'I', 'T', 'L', 'S', 'O', 'J', 'Z'];

function measure(name: string, runs: number, fn: () => { nodes: number }) {
  fn(); // warm up the JIT
  const times: number[] = [];
  let nodes = 0;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    nodes = fn().nodes;
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { case: name, 'median ms': Number(times[Math.floor(runs / 2)]!.toFixed(2)), nodes };
}

test('engine benchmark', () => {
  const rows = [
    measure('search, depth 1', 50, () => search(board, pieces, 1)),
    measure('search, depth 2', 20, () => search(board, pieces, 2)),
    measure('search, depth 3', 5, () => search(board, pieces, 3)),
    measure('search, depth 3, with memo', 5, () => search(board, pieces, 3, { memo: true })),
    measure('play 14 pieces, lookahead 1 (like 2022)', 20, () => play(board, pieces, 1)),
    measure('play 14 pieces, lookahead 2', 5, () => play(board, pieces, 2)),
  ];
  console.table(rows);
  expect(rows.every((r) => r.nodes > 0)).toBe(true);
}, 600_000);
