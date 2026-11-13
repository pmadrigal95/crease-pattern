/**
 * What a Threads worker does with one message (M3.2), as a plain function: no `self`, no
 * postMessage. worker.ts connects it to a real Web Worker; the unit tests call it directly.
 *
 * Every worker rebuilds the list of root tasks from the problem itself (it's deterministic and
 * cheap: one placement per position of the first piece), so tasks travel as indices, never as
 * boards.
 */
import type { Board } from './board';
import {
  readProblem,
  staticBlocks,
  writeResult,
  type FromWorker,
  type Problem,
  type Span,
  type ToWorker,
} from './protocol';
import { rootTasks, solveTask, type TaskResult } from './search';

export type Clock = () => number;

const toBoard = (p: Problem): Board => ({ width: p.width, height: p.height, rows: Uint16Array.from(p.rows) });

export function handle(message: ToWorker, now: Clock): FromWorker {
  const received = now();
  const spans: Span[] = [{ kind: 'start', from: message.sentAt, to: received }];
  const results: TaskResult[] = [];

  const solveAll = (problem: Problem, indices: Iterable<number>, onResult: (r: TaskResult) => void) => {
    const tasks = rootTasks(toBoard(problem), problem.pieces);
    for (const index of indices) {
      const task = tasks[index];
      if (!task) continue;
      const from = now();
      const result = solveTask(task, problem.pieces, problem.depth);
      spans.push({ kind: 'work', from, to: now(), task: index });
      onResult(result);
    }
    return tasks.length;
  };

  if (message.type === 'serial') {
    const count = rootTasks(toBoard(message.problem), message.problem.pieces).length;
    solveAll(
      message.problem,
      Array.from({ length: count }, (_, i) => i),
      (r) => results.push(r),
    );
  } else if (message.type === 'messages') {
    // The board arrived as a copy inside the message: that copy is this model's cost.
    const from = now();
    const problem = { ...message.problem, rows: [...message.problem.rows] };
    spans.push({ kind: 'copy', from, to: now() });
    solveAll(problem, message.tasks, (r) => results.push(r));
  } else {
    const view = new Int32Array(message.buffer);
    const { problem, tasks } = readProblem(view);
    const write = (r: TaskResult) => writeResult(view, problem, tasks, r);
    if (message.type === 'fork-join') {
      solveAll(problem, staticBlocks(tasks, message.workers)[message.worker] ?? [], write);
    } else {
      // A shared queue: take the next task until none are left.
      const next = function* () {
        for (;;) {
          const i = Atomics.add(view, 0, 1);
          if (i >= tasks) return;
          yield i;
        }
      };
      solveAll(problem, next(), write);
    }
  }
  return { type: 'done', run: message.run, worker: message.worker, results, spans };
}
