import { describe, expect, test } from 'vitest';
import { emptyBoard, type Board } from '../../src/lib/threads/board';
import { PIECE_NAMES, type PieceName } from '../../src/lib/threads/pieces';
import { ThreadPool, type WorkerFactory, type WorkerLike } from '../../src/lib/threads/pool';
import {
  MODELS,
  readProblem,
  readResults,
  shareProblem,
  staticBlocks,
  writeResult,
  type FromWorker,
  type Problem,
  type ToWorker,
} from '../../src/lib/threads/protocol';
import { search } from '../../src/lib/threads/search';
import { handle } from '../../src/lib/threads/worker-core';

// The four parallel models (M3.2), run with in-process workers that behave like Web Workers:
// messages are copied (structured clone), shared memory is a real SharedArrayBuffer used with
// Atomics, and replies arrive asynchronously. Real Workers in a browser are checked separately.

let clock = 0;
const now = () => ++clock;

const inProcess: WorkerFactory = () => {
  const listeners: ((event: MessageEvent<FromWorker>) => void)[] = [];
  const worker: WorkerLike = {
    postMessage(message: ToWorker) {
      // postMessage copies everything except shared memory.
      const delivered =
        message.type === 'serial' || message.type === 'messages' ? structuredClone(message) : message;
      setTimeout(() => {
        const reply = handle(delivered, now);
        for (const l of listeners) l({ data: reply } as MessageEvent<FromWorker>);
      }, 0);
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
    terminate() {},
  };
  return worker;
};

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
function randomProblem(seed: number, depth = 2): Problem {
  const rand = prng(seed);
  const board: Board = emptyBoard();
  for (let x = 0; x < board.width; x++) {
    const h = Math.floor(rand() * 7);
    for (let y = 0; y < h; y++) if (rand() > 0.2) board.rows[y]! |= 1 << x;
  }
  const full = (1 << board.width) - 1;
  for (let y = 0; y < board.height; y++) if (board.rows[y] === full) board.rows[y]! &= ~1;
  const pieces: PieceName[] = Array.from({ length: depth }, () => PIECE_NAMES[Math.floor(rand() * 7)]!);
  return { width: board.width, height: board.height, rows: [...board.rows], pieces, depth };
}

describe('protocol', () => {
  test('static blocks cover every task once, as evenly as possible', () => {
    expect(staticBlocks(10, 4)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7],
      [8, 9],
    ]);
    expect(staticBlocks(3, 5).map((b) => b.length)).toEqual([1, 1, 1, 0, 0]);
    expect(staticBlocks(34, 8).flat()).toEqual(Array.from({ length: 34 }, (_, i) => i));
  });

  test('a problem and its results survive the trip through shared memory', () => {
    const problem = randomProblem(3);
    const buffer = shareProblem(problem, 5);
    const view = new Int32Array(buffer);
    expect(readProblem(view)).toEqual({ problem, tasks: 5 });
    const result = {
      index: 2,
      score: -1234,
      nodes: 99,
      moves: [{ piece: 'T' as const, rotation: 3, x: 7, y: 2, lines: 1 }],
    };
    writeResult(view, problem, 5, result);
    expect(readResults(view, problem, 5)[2]).toEqual(result);
  });
});

describe('the four models', () => {
  test.each(MODELS.flatMap((model) => [1, 2, 3, 4].map((workers) => [model, workers] as const)))(
    '%s with %i workers gives exactly the serial answer on six random boards',
    async (model, workers) => {
      const pool = new ThreadPool(workers, inProcess, now);
      for (let seed = 1; seed <= 6; seed++) {
        const problem = randomProblem(seed);
        const board = { width: problem.width, height: problem.height, rows: Uint16Array.from(problem.rows) };
        const expected = search(board, problem.pieces, problem.depth);
        const report = await pool.run(model, problem);
        expect(report.result.score).toBe(expected.score);
        expect(report.result.moves).toEqual(expected.moves);
        expect(report.workers).toBe(model === 'serial' ? 1 : workers);

        // Every task was worked on exactly once, by some worker.
        const worked = report.spans
          .flat()
          .filter((s) => s.kind === 'work')
          .map((s) => s.task);
        expect([...worked].sort((a, b) => a! - b!)).toEqual(
          Array.from({ length: report.tasks }, (_, i) => i),
        );
        for (const s of report.spans.flat()) expect(s.to).toBeGreaterThanOrEqual(s.from);
      }
      pool.dispose();
    },
  );

  test('message passing copies the board; shared memory does not', async () => {
    const pool = new ThreadPool(2, inProcess, now);
    const problem = randomProblem(8);
    const kinds = async (model: (typeof MODELS)[number]) =>
      new Set((await pool.run(model, problem)).spans.flat().map((s) => s.kind));
    expect(await kinds('messages')).toContain('copy');
    expect(await kinds('shared')).not.toContain('copy');
    pool.dispose();
  });

  test('a pool runs one problem at a time', async () => {
    const pool = new ThreadPool(2, inProcess, now);
    const problem = randomProblem(9);
    const first = pool.run('messages', problem);
    await expect(pool.run('messages', problem)).rejects.toThrow(/already running/);
    await first;
    pool.dispose();
  });
});
