/**
 * The Threads essay's browser side (Crease No. 002): one worker pool for the whole page, created
 * the first time a demo runs, and a fair way to time a model (one warm-up run, then the median of
 * several). Demos share the pool, so a page never starts more workers than this.
 */
import { median } from './essay';
import { ThreadPool, type RunReport } from './pool';
import { needsSharedMemory, sharedMemoryAvailable, type Model, type Problem } from './protocol';

/** Workers for this device: its logical cores, at least 2 and at most 16. */
export const poolSize = (): number => Math.min(16, Math.max(2, navigator.hardwareConcurrency || 2));

/**
 * How far ahead the essay's main demos search. Four pieces (344,522 placements on the essay board) gives runs long
 * enough for stable medians on a desktop; devices with few cores (most phones) search three, so
 * the demo stays quick there. Measured on an i7-12700K, depth 3 ran in about a millisecond in
 * parallel, which is mostly noise.
 */
export const essayDepth = (): number => ((navigator.hardwareConcurrency || 2) >= 6 ? 4 : 3);

let pool: ThreadPool | null = null;
export const getPool = (): ThreadPool => (pool ??= new ThreadPool(poolSize()));

export const canRun = (model: Model): boolean => !needsSharedMemory(model) || sharedMemoryAvailable();

export interface Timed {
  model: Model;
  /** Median wall time, in milliseconds. */
  ms: number;
  /** The run closest to the median, for drawing its timeline. */
  report: RunReport;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs `job` after every job queued before it. The demos share one pool, and a pool runs one
 * problem at a time, so two demos started together take turns instead of failing.
 */
export function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const result = queue.then(job, job);
  queue = result.catch(() => undefined);
  return result;
}

/** Times one model: a warm-up run, then the median of `runs`, queued behind other demos. */
export function time(model: Model, problem: Problem, runs = 5): Promise<Timed> {
  return exclusive(() => timeNow(model, problem, runs));
}

async function timeNow(model: Model, problem: Problem, runs: number): Promise<Timed> {
  const p = getPool();
  await p.run(model, problem);
  const reports: RunReport[] = [];
  for (let i = 0; i < runs; i++) reports.push(await p.run(model, problem));
  const wall = (r: RunReport) => r.endedAt - r.startedAt;
  const ms = median(reports.map(wall));
  const report = reports.reduce((a, b) => (Math.abs(wall(b) - ms) < Math.abs(wall(a) - ms) ? b : a));
  return { model, ms, report };
}

/** Lets the browser paint between runs, so a long run of demos never freezes the page. */
export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
