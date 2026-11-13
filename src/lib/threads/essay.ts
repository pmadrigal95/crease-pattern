/**
 * The arithmetic behind the Threads essay's demos (Crease No. 002): the board the essay runs on,
 * medians and speedups, a simple cost model for Amdahl's demo, and how 2022's solver split the
 * work. Pure functions, unit-tested; the components only draw what these return.
 */
import { boardFromText } from './board';
import type { PieceName } from './pieces';
import type { Problem } from './protocol';

/** The essay's board and pieces: written for this site, not taken from the 2022 course. */
export const ESSAY_BOARD = [
  '..........',
  '..........',
  '....#.....',
  '...###....',
  '....#.....',
  '#..###...#',
  '##.####.##',
  '###.######',
] as const;
export const ESSAY_PIECES: readonly PieceName[] = ['T', 'I', 'S', 'L', 'O', 'Z', 'J'];

export function essayProblem(depth: number): Problem {
  const board = boardFromText(ESSAY_BOARD, 20);
  return {
    width: board.width,
    height: board.height,
    rows: [...board.rows],
    pieces: [...ESSAY_PIECES],
    depth,
  };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median() needs at least one value');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** How many times faster than the baseline; 1 means the same. */
export const speedup = (baselineMs: number, ms: number): number => (ms > 0 ? baselineMs / ms : 0);

export interface CostPoint {
  threads: number;
  ms: number;
  speedup: number;
}

/**
 * A deliberately simple model for the Amdahl demo: the work splits evenly across n threads, and
 * each thread adds a fixed cost (starting it, joining it, contending for a lock). One thread runs
 * the plain serial code, with no such cost.
 *
 *   T(1) = work        T(n) = work / n + perThread × n
 *
 * With little work and a real per-thread cost, the curve peaks early and then falls below 1:
 * exactly what happened in 2022.
 */
export function costCurve(workMs: number, perThreadMs: number, maxThreads: number): CostPoint[] {
  return Array.from({ length: maxThreads }, (_, i) => {
    const threads = i + 1;
    const ms = threads === 1 ? workMs : workMs / threads + perThreadMs * threads;
    return { threads, ms, speedup: speedup(workMs, ms) };
  });
}

export const bestPoint = (points: readonly CostPoint[]): CostPoint =>
  points.reduce((best, p) => (p.speedup > best.speedup ? p : best));

/**
 * How 2022's solver split its work: one unit per board column, dealt round-robin
 * (`for col = thread; col < columns; col += threads`). Returns each thread's columns.
 */
export function cyclicColumns(columns: number, threads: number): number[][] {
  return Array.from({ length: threads }, (_, t) => {
    const mine: number[] = [];
    for (let c = t; c < columns; c += threads) mine.push(c);
    return mine;
  });
}

/** The measured 2022 results (Tarea03 and Tarea04 reports): one run per case, the original numbers. */
export const RESULTS_2022 = [
  { version: 'Serial', workers: '1', seconds: 0.036038181, speedup: 1 },
  { version: 'pthreads', workers: '8 threads', seconds: 0.058487965, speedup: 0.6161 },
  { version: 'pthreads', workers: '16 threads', seconds: 0.046441231, speedup: 0.775 },
  { version: 'OpenMP', workers: '8 threads', seconds: 0.064563813, speedup: 0.55817 },
  { version: 'OpenMP', workers: '16 threads', seconds: 0.449816702, speedup: 0.08 },
  { version: 'MPI', workers: '3 processes', seconds: 0.933319749, speedup: 0.0386 },
  { version: 'MPI', workers: '5 processes', seconds: 0.02768386, speedup: 1.3017 },
  { version: 'MPI', workers: '10 processes', seconds: 0.373766286, speedup: 0.0964 },
] as const;

export interface ChartFrame {
  width: number;
  height: number;
  pad: number;
  maxX: number;
  maxY: number;
}

/** The speedup curve as SVG path data, threads on x (from 1) and speedup on y (from 0). */
export function speedupPath(
  points: readonly CostPoint[],
  f: ChartFrame,
): { d: string; x: (n: number) => number; y: (s: number) => number } {
  const x = (n: number) => f.pad + ((n - 1) / (f.maxX - 1)) * (f.width - 2 * f.pad);
  const y = (s: number) => f.height - f.pad - (Math.min(s, f.maxY) / f.maxY) * (f.height - 2 * f.pad);
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.threads).toFixed(1)},${y(p.speedup).toFixed(1)}`)
    .join('');
  return { d, x, y };
}
