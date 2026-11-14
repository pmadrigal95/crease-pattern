/**
 * The Threads Web Worker (M3.2): connects worker-core to postMessage. Its clock is the shared
 * one (performance.timeOrigin + now), so spans from every worker line up on one timeline.
 */
import { handle } from './worker-core';
import type { ToWorker } from './protocol';

const now = () => performance.timeOrigin + performance.now();

self.addEventListener('message', (event: MessageEvent<ToWorker>) => {
  self.postMessage(handle(event.data, now));
});
