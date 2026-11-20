/**
 * The Web Worker that runs Pablo's 2022 solver (solver-2022.ts). Each build loads once, from the
 * generated files in public/wasm/solver-2022 (its glue starts the pthreads build's own pool of
 * nine Workers). Blocking on pthread_join is allowed here, which it isn't on the page's main thread.
 *
 * The input goes in as a file in Emscripten's in-memory file system (written by the port's C, since
 * Closure shortens the JS file system's method names) and the 2022 main() reads it, exactly as it
 * read its test files; afterwards the run's time and board are read from the port.
 */
import type { Reply2022, Request2022, Version2022 } from './solver-2022';

/** The part of an Emscripten module (build.sh release, EXPORTED_*) this worker uses. */
interface SolverModule {
  ccall(
    name: 'solver_write_input',
    returns: 'number',
    args: ['string', 'string'],
    values: [string, string],
  ): number;
  callMain(args: string[]): number;
  UTF8ToString(pointer: number): string;
  _solver_get_elapsed(): number;
  _solver_get_board(): number;
}
type SolverFactory = () => Promise<SolverModule>;

const INPUT = '/board.txt';
const modules = new Map<Version2022, Promise<SolverModule>>();

/** Loads a build once. The URL is built from a fixed list, never from the message. */
const load = (version: Version2022): Promise<SolverModule> => {
  let module = modules.get(version);
  if (!module) {
    const file = version === 'pthreads' ? 'pthreads.mjs' : 'serial.mjs';
    const url = new URL(`/wasm/solver-2022/${file}`, self.location.origin).href;
    module = (import(/* @vite-ignore */ url) as Promise<{ default: SolverFactory }>).then((m) => m.default());
    // A failed download is forgotten, so the next run retries.
    module.catch(() => modules.delete(version));
    modules.set(version, module);
  }
  return module;
};

self.addEventListener('message', (event: MessageEvent<Request2022>) => {
  const { id, version, threads, input, runs } = event.data;
  const reply = (message: Reply2022) => self.postMessage(message);
  load(version)
    .then((solver) => {
      // The serial main() takes the file only; the pthreads one also takes the thread count.
      const args = version === 'pthreads' ? [INPUT, String(threads)] : [INPUT];
      /** One run, in ms. The input is written before each one: the runtime doesn't keep it between runs. */
      const run = (): number => {
        if (solver.ccall('solver_write_input', 'number', ['string', 'string'], [INPUT, input]) !== 0)
          throw new Error('could not write the input file');
        // A run that stopped early (exit() on bad input) would leave no time: never report one.
        // A copy each time: callMain puts the program's name at the front of the array it gets.
        if (solver.callMain([...args]) !== 0 || solver._solver_get_elapsed() <= 0)
          throw new Error('the 2022 solver stopped before finishing');
        return solver._solver_get_elapsed() * 1000;
      };
      run(); // warm-up
      const ms = Array.from({ length: runs }, run);
      reply({ id, ms, board: solver.UTF8ToString(solver._solver_get_board()) });
    })
    .catch((error: unknown) => reply({ id, error: String(error) }));
});
