import { describe, expect, test } from 'vitest';
import {
  RESULTS_2022,
  bestPoint,
  costCurve,
  cyclicColumns,
  essayProblem,
  median,
  speedup,
} from '../../src/lib/threads/essay';
import { rootTasks, search } from '../../src/lib/threads/search';

// The arithmetic behind the Threads essay's demos (Crease No. 002).
describe('essay helpers', () => {
  test('median of odd and even lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow();
  });

  test('speedup is baseline over time', () => {
    expect(speedup(20, 5)).toBe(4);
    expect(speedup(20, 40)).toBe(0.5);
  });

  test('the cost model peaks early and falls below 1 with little work and a real per-thread cost', () => {
    const points = costCurve(36, 4, 16);
    expect(points[0]).toEqual({ threads: 1, ms: 36, speedup: 1 });
    const best = bestPoint(points);
    expect(best.threads).toBe(3);
    expect(best.speedup).toBeGreaterThan(1);
    expect(points[15]!.speedup).toBeLessThan(1);
  });

  test('with no per-thread cost, more threads always help', () => {
    const points = costCurve(36, 0, 8);
    points.slice(1).forEach((p, i) => expect(p.speedup).toBeGreaterThan(points[i]!.speedup));
  });

  test("2022's round-robin by column leaves threads idle when there are more threads than columns", () => {
    const split = cyclicColumns(10, 16);
    expect(split.filter((cols) => cols.length === 0)).toHaveLength(6);
    expect(split.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(cyclicColumns(10, 4)).toEqual([
      [0, 4, 8],
      [1, 5, 9],
      [2, 6],
      [3, 7],
    ]);
  });

  test("the essay's board gives the 34 root tasks the text talks about", () => {
    const p = essayProblem(3);
    const board = { width: p.width, height: p.height, rows: Uint16Array.from(p.rows) };
    expect(rootTasks(board, p.pieces)).toHaveLength(34);
  });

  // Crease No. 002 cites these counts ("344,522 placements" four pieces ahead, and the depth
  // demo's labels). If the engine or the essay board changes, update the post with the new ones.
  test('the placement counts the essay cites: every placement tried, at every level', () => {
    const p = essayProblem(4);
    const board = { width: p.width, height: p.height, rows: Uint16Array.from(p.rows) };
    expect([1, 2, 3, 4].map((depth) => search(board, p.pieces, depth).nodes)).toEqual([
      34, 612, 10_438, 344_522,
    ]);
  });

  test('the 2022 table keeps the original measurements', () => {
    expect(RESULTS_2022.filter((r) => r.speedup > 1).map((r) => `${r.version} ${r.workers}`)).toEqual([
      'MPI 5 processes',
    ]);
    expect(new Set(RESULTS_2022.map((r) => r.version))).toEqual(
      new Set(['Serial', 'pthreads', 'OpenMP', 'MPI']),
    );
  });
});

describe('the 2022 replay (M7)', () => {
  test('the input file is the 2022 format: id, levels, size, rows top to bottom, then the pieces', async () => {
    const { input2022, PIECES_2022, MAX_THREADS_2022 } = await import('../../src/lib/threads/solver-2022');
    const text = input2022(['..#', '###'], ['T', 'I'], 4);
    expect(text).toBe('1\n1\n4\n3\n000\n000\n001\n111\n2\nT\nI\n');
    expect(PIECES_2022).toHaveLength(14);
    // The 2022 code exits when threads >= columns; the essay's board has ten.
    expect(MAX_THREADS_2022).toBeLessThan(10);
  });
});
