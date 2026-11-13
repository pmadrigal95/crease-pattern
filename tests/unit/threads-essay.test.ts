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
import { rootTasks } from '../../src/lib/threads/search';

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

  test('the 2022 table keeps the original measurements', () => {
    expect(RESULTS_2022.filter((r) => r.speedup > 1).map((r) => `${r.version} ${r.workers}`)).toEqual([
      'MPI 5 processes',
    ]);
    expect(new Set(RESULTS_2022.map((r) => r.version))).toEqual(
      new Set(['Serial', 'pthreads', 'OpenMP', 'MPI']),
    );
  });
});
