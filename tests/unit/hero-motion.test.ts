import { expect, test } from 'vitest';
import { FoldControl, FrameProbe } from '../../src/components/inspector/hero-motion';

/** Steps a FoldControl at 60 frames a second from `from` to `to` ms; returns the largest fold seen. */
function run(fold: FoldControl, from: number, to: number) {
  let peak = 0;
  for (let now = from; now <= to; now += 1000 / 60) {
    fold.step(now, 1 / 60);
    peak = Math.max(peak, fold.value);
  }
  return peak;
}

test('the demonstration unfolds partway, then folds back and stops', () => {
  const fold = new FoldControl(0);
  fold.demo(0);
  const peak = run(fold, 0, 6000);
  expect(peak).toBeGreaterThan(0.5);
  expect(peak).toBeLessThan(0.65);
  expect(fold.value).toBe(0);
  expect(fold.step(6100, 1 / 60)).toBe(false);
});

test('the slider wins: touching it cancels the demonstration', () => {
  const fold = new FoldControl(0);
  fold.demo(0);
  run(fold, 0, 900);
  fold.set(1);
  run(fold, 900, 3000);
  expect(fold.value).toBe(1);
});

test('no demonstration when the slider already moved', () => {
  const fold = new FoldControl(0.4);
  fold.demo(0);
  expect(run(fold, 0, 6000)).toBe(0.4);
});

test('the fold follows the slider, eased, and stays inside 0 to 1', () => {
  const fold = new FoldControl(0);
  fold.set(2);
  fold.step(0, 1 / 60);
  expect(fold.value).toBeGreaterThan(0);
  expect(fold.value).toBeLessThan(1);
  run(fold, 0, 2000);
  expect(fold.value).toBe(1);
});

function probe(frameMs: number) {
  let slow = 0;
  const p = new FrameProbe(() => slow++);
  for (let i = 0; i <= 60; i++) p.frame(i * frameMs);
  return slow;
}

test('a smooth device keeps the 3D figure', () => {
  expect(probe(16.7)).toBe(0);
});

test('a device under 30 frames a second hands the figure back, once', () => {
  expect(probe(50)).toBe(1);
});

test('a pause between movements is not counted as a slow frame', () => {
  let slow = 0;
  const p = new FrameProbe(() => slow++);
  let now = 0;
  for (let burst = 0; burst < 6; burst++) {
    for (let i = 0; i < 10; i++) p.frame((now += 16.7));
    p.pause();
    now += 2000;
  }
  expect(slow).toBe(0);
});
