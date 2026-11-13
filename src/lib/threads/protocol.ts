/**
 * What the Threads pool and its workers say to each other (M3.2), and how shared memory is laid
 * out. Kept apart from the transport so tests can run the same protocol in-process.
 *
 * The four models, each true to the API it stands for:
 *
 * - `serial`: one worker searches everything. The baseline.
 * - `messages` (like MPI): each worker gets its own copy of the board and its block of tasks
 *   through postMessage, and sends its results back the same way. Nothing is shared.
 * - `fork-join` (like OpenMP's parallel for, static schedule): the board and the results live in
 *   shared memory; each worker takes a fixed slice of the tasks, and the run ends when every
 *   worker has joined.
 * - `shared` (like pthreads with a work queue): same shared memory, but workers take the next
 *   task from a shared counter with `Atomics.add`, so a fast worker simply takes more. No locks
 *   on the hot path; each task writes only its own result slot.
 *
 * The two shared-memory models need `SharedArrayBuffer`, which browsers only give to
 * cross-origin isolated pages (M3.3). Without it, only `serial` and `messages` run.
 */
import type { Move, TaskResult } from './search';
import { PIECE_NAMES, type PieceName } from './pieces';

export const MODELS = ['serial', 'messages', 'fork-join', 'shared'] as const;
export type Model = (typeof MODELS)[number];

export const needsSharedMemory = (model: Model): boolean => model === 'fork-join' || model === 'shared';

/** Whether this page can run the shared-memory models. */
export const sharedMemoryAvailable = (): boolean =>
  typeof SharedArrayBuffer !== 'undefined' &&
  (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated === true);

/** The problem every model solves: the same input as `search`. */
export interface Problem {
  width: number;
  height: number;
  rows: number[];
  pieces: PieceName[];
  depth: number;
}

/** One span on a worker's timeline, in milliseconds on the shared clock (performance.timeOrigin). */
export interface Span {
  kind: 'start' | 'work' | 'wait' | 'copy';
  from: number;
  to: number;
  /** The task worked on, for `work` spans. */
  task?: number;
}

export type ToWorker =
  | { type: 'messages'; run: number; worker: number; problem: Problem; tasks: number[]; sentAt: number }
  | { type: 'serial'; run: number; worker: number; problem: Problem; sentAt: number }
  | {
      type: 'fork-join' | 'shared';
      run: number;
      worker: number;
      workers: number;
      buffer: SharedArrayBuffer;
      sentAt: number;
    };

export type FromWorker = {
  type: 'done';
  run: number;
  worker: number;
  /** Results sent back as messages (`serial`, `messages`); empty when they're in shared memory. */
  results: TaskResult[];
  spans: Span[];
};

// Shared memory layout, all Int32 (one view, so offsets are simple):
//   [0] task counter for `shared`   [1] task count   [2] width   [3] height   [4] depth
//   [5] piece count                 [6..6+P) pieces (index in PIECE_NAMES)
//   [then height cells] board rows
//   [then per task: score, nodes, then depth × 5 move fields (piece, rotation, x, y, lines)]
const HEADER = 6;
const MOVE_FIELDS = 5;

export function sharedLayout(problem: Problem, tasks: number) {
  const pieces = HEADER;
  const rows = pieces + problem.pieces.length;
  const results = rows + problem.height;
  const slot = 2 + problem.depth * MOVE_FIELDS;
  return { pieces, rows, results, slot, length: results + tasks * slot };
}

/** Writes the problem into a new shared buffer, with room for every task's result. */
export function shareProblem(problem: Problem, tasks: number): SharedArrayBuffer {
  const layout = sharedLayout(problem, tasks);
  const buffer = new SharedArrayBuffer(layout.length * Int32Array.BYTES_PER_ELEMENT);
  const view = new Int32Array(buffer);
  view.set([0, tasks, problem.width, problem.height, problem.depth, problem.pieces.length]);
  problem.pieces.forEach((p, i) => (view[layout.pieces + i] = PIECE_NAMES.indexOf(p)));
  view.set(problem.rows, layout.rows);
  return buffer;
}

/** Reads the problem back from shared memory, without copying the board into a message. */
export function readProblem(view: Int32Array): { problem: Problem; tasks: number } {
  const [, tasks = 0, width = 0, height = 0, depth = 0, pieceCount = 0] = view;
  const pieces = Array.from(view.subarray(HEADER, HEADER + pieceCount), (i) => PIECE_NAMES[i]!);
  const problem: Problem = { width, height, depth, pieces, rows: [] };
  const layout = sharedLayout(problem, tasks);
  problem.rows = Array.from(view.subarray(layout.rows, layout.rows + height));
  return { problem, tasks };
}

export function writeResult(view: Int32Array, problem: Problem, tasks: number, result: TaskResult): void {
  const layout = sharedLayout(problem, tasks);
  const at = layout.results + result.index * layout.slot;
  view[at] = result.score;
  view[at + 1] = result.nodes;
  result.moves.forEach((m, i) => {
    const o = at + 2 + i * MOVE_FIELDS;
    view.set([PIECE_NAMES.indexOf(m.piece) + 1, m.rotation, m.x, m.y, m.lines], o);
  });
}

export function readResults(view: Int32Array, problem: Problem, tasks: number): TaskResult[] {
  const layout = sharedLayout(problem, tasks);
  return Array.from({ length: tasks }, (_, index) => {
    const at = layout.results + index * layout.slot;
    const moves: Move[] = [];
    for (let i = 0; i < problem.depth; i++) {
      const o = at + 2 + i * MOVE_FIELDS;
      const piece = view[o]!;
      if (piece === 0) break;
      moves.push({
        piece: PIECE_NAMES[piece - 1]!,
        rotation: view[o + 1]!,
        x: view[o + 2]!,
        y: view[o + 3]!,
        lines: view[o + 4]!,
      });
    }
    return { index, score: view[at]!, nodes: view[at + 1]!, moves };
  });
}

/** Contiguous blocks, as evenly sized as possible: worker w gets block w. */
export function staticBlocks(tasks: number, workers: number): number[][] {
  const size = Math.floor(tasks / workers);
  const extra = tasks % workers;
  const out: number[][] = [];
  let next = 0;
  for (let w = 0; w < workers; w++) {
    const n = size + (w < extra ? 1 : 0);
    out.push(Array.from({ length: n }, (_, i) => next + i));
    next += n;
  }
  return out;
}
