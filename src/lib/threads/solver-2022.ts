/**
 * Pablo's 2022 solver on the reader's device (M7). The C code from the concurrency course, serial
 * and pthreads versions, compiled to WebAssembly (public/wasm/solver-2022/SOURCE.md), runs in a
 * Web Worker of its own (solver-2022-worker.ts) on the essay's board. It is the code as it was,
 * apart from printing and memory bugs, so it is slow on purpose: what the reader sees is 2022.
 *
 * Runs go through the essay's queue (client.ts, `exclusive`), so they never compete with the other
 * demos for the processor.
 */
import { trustSameOriginScripts } from '../trusted-types';
import { exclusive } from './client';
import { ESSAY_BOARD, ESSAY_PIECES, median } from './essay';
import { sharedMemoryAvailable } from './protocol';

export type Version2022 = 'serial' | 'pthreads';

/** The 2022 code refuses as many threads as the board has columns: ten columns, nine threads. */
export const MAX_THREADS_2022 = 9;

/** The thread counts the essay offers: one, a few, and the most the 2022 code accepts. */
export const THREADS_2022 = [1, 2, 4, MAX_THREADS_2022] as const;

/** Two rounds of the essay's seven pieces: long enough to time (about 16 ms serial on a desktop). */
export const PIECES_2022: readonly string[] = [...ESSAY_PIECES, ...ESSAY_PIECES];

/**
 * The input file the 2022 solver reads: an id, how many levels to search (pieces minus one), the
 * board's size, its rows top to bottom ('0' empty, '1' filled), then the pieces one per line. The
 * board is the essay's, sitting on the floor of a 20-row well.
 */
export const input2022 = (board: readonly string[], pieces: readonly string[], rows = 20): string => {
  const width = board[0]?.length ?? 0;
  const empty = Array.from({ length: rows - board.length }, () => '0'.repeat(width));
  const filled = board.map((line) => line.replaceAll('#', '1').replaceAll('.', '0'));
  return [1, pieces.length - 1, rows, width, ...empty, ...filled, pieces.length, ...pieces].join('\n') + '\n';
};

/** The pthreads build needs shared memory (a cross-origin isolated page); the serial one runs anywhere. */
export const canRun2022 = (version: Version2022): boolean => version === 'serial' || sharedMemoryAvailable();

export interface Timed2022 {
  version: Version2022;
  threads: number;
  /** Median of the timed runs, in milliseconds, as the 2022 code measures itself. */
  ms: number;
  /** The board the run ends on, rows top to bottom concatenated. */
  board: string;
}

/** A request to solver-2022-worker.ts. */
export interface Request2022 {
  id: number;
  version: Version2022;
  threads: number;
  input: string;
  runs: number;
}

/** Its answer: every run's time in ms and the last run's board, or why it failed. */
export type Reply2022 = { id: number; ms: number[]; board: string } | { id: number; error: string };

let worker: Worker | null = null;
let nextId = 0;

const solverWorker = (): Worker => {
  if (!worker) {
    // Under Trusted Types the Worker's URL goes through the default policy: same origin only.
    trustSameOriginScripts();
    worker = new Worker(new URL('./solver-2022-worker.ts', import.meta.url), {
      type: 'module',
      name: 'solver-2022',
    });
  }
  return worker;
};

const ask = (request: Omit<Request2022, 'id'>): Promise<{ ms: number[]; board: string }> =>
  new Promise((resolve, reject) => {
    const w = solverWorker();
    const id = nextId++;
    const onMessage = (event: MessageEvent<Reply2022>) => {
      if (event.data.id !== id) return;
      w.removeEventListener('message', onMessage);
      if ('error' in event.data) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    w.addEventListener('message', onMessage);
    w.postMessage({ ...request, id } satisfies Request2022);
  });

/**
 * Times one version: a warm-up run (it also downloads the build), then the median of `runs`,
 * queued behind the essay's other demos.
 */
export const time2022 = (version: Version2022, threads: number, runs = 5): Promise<Timed2022> =>
  exclusive(async () => {
    const input = input2022(ESSAY_BOARD, PIECES_2022);
    const { ms, board } = await ask({ version, threads: version === 'serial' ? 1 : threads, input, runs });
    return { version, threads: version === 'serial' ? 1 : threads, ms: median(ms), board };
  });
