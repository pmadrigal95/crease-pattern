/**
 * A pool of Threads workers, created once and reused (M3.2): in 2022 the threads were created
 * again at every level of the search, and that alone cost more than the work. `run` solves one
 * problem with one of the four models (protocol.ts) and reports the answer, the wall time and
 * each worker's timeline on one shared clock.
 *
 * The pool talks to anything shaped like a Worker, so tests can drive it with in-process
 * workers; the browser uses the real one in worker.ts.
 */
import {
  needsSharedMemory,
  readResults,
  sharedMemoryAvailable,
  shareProblem,
  staticBlocks,
  type FromWorker,
  type Model,
  type Problem,
  type Span,
  type ToWorker,
} from './protocol';
import { pickBest, rootTasks, type SearchResult } from './search';

export interface WorkerLike {
  postMessage(message: ToWorker): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FromWorker>) => void): void;
  terminate(): void;
}

export type WorkerFactory = () => WorkerLike;

export const browserWorkers: WorkerFactory = () =>
  new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
    name: 'threads',
  }) as unknown as WorkerLike;

export interface RunReport {
  model: Model;
  /** Workers that took part (1 for `serial`). */
  workers: number;
  tasks: number;
  result: SearchResult;
  startedAt: number;
  endedAt: number;
  /** One timeline per worker that took part, in the order of `workers`. */
  spans: Span[][];
}

export class ThreadPool {
  readonly size: number;
  private readonly workers: WorkerLike[];
  private readonly now: () => number;
  private pending: {
    run: number;
    expected: number;
    replies: FromWorker[];
    resolve: (r: FromWorker[]) => void;
  } | null = null;
  private runs = 0;

  constructor(
    size: number,
    factory: WorkerFactory = browserWorkers,
    now = () => performance.timeOrigin + performance.now(),
  ) {
    if (size < 1) throw new Error('A pool needs at least one worker');
    this.size = size;
    this.now = now;
    this.workers = Array.from({ length: size }, () => {
      const worker = factory();
      worker.addEventListener('message', (event) => this.receive(event.data));
      return worker;
    });
  }

  private receive(reply: FromWorker) {
    const p = this.pending;
    if (!p || reply.run !== p.run) return;
    p.replies.push(reply);
    if (p.replies.length === p.expected) {
      this.pending = null;
      p.resolve(p.replies);
    }
  }

  /** Solves the problem with one model. One run at a time per pool. */
  async run(model: Model, problem: Problem): Promise<RunReport> {
    if (this.pending) throw new Error('This pool is already running');
    if (needsSharedMemory(model) && !sharedMemoryAvailable())
      throw new Error(`The ${model} model needs SharedArrayBuffer, which this page doesn't have`);
    const run = ++this.runs;
    const board = { width: problem.width, height: problem.height, rows: Uint16Array.from(problem.rows) };
    const tasks = rootTasks(board, problem.pieces).length;
    const workers = model === 'serial' ? 1 : this.size;
    const startedAt = this.now();
    const replies = new Promise<FromWorker[]>((resolve) => {
      this.pending = { run, expected: workers, replies: [], resolve };
    });

    const buffer = needsSharedMemory(model) ? shareProblem(problem, tasks) : null;
    const blocks = staticBlocks(tasks, workers);
    for (let w = 0; w < workers; w++) {
      const sentAt = this.now();
      const message: ToWorker =
        model === 'serial'
          ? { type: 'serial', run, worker: w, problem, sentAt }
          : model === 'messages'
            ? { type: 'messages', run, worker: w, problem, tasks: blocks[w]!, sentAt }
            : { type: model, run, worker: w, workers, buffer: buffer!, sentAt };
      this.workers[w]!.postMessage(message);
    }

    const done = (await replies).sort((a, b) => a.worker - b.worker);
    const endedAt = this.now();
    const results = buffer
      ? readResults(new Int32Array(buffer), problem, tasks)
      : done.flatMap((r) => r.results);
    return {
      model,
      workers,
      tasks,
      result: pickBest(results),
      startedAt,
      endedAt,
      spans: done.map((r) => r.spans),
    };
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
  }
}
