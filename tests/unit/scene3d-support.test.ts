import { expect, test } from 'vitest';
import { canRun3D } from '../../src/lib/scene3d-support';

const capable = { webgl2: true, deviceMemory: 8, cores: 8, reducedMotion: false };

test('a capable device gets the 3D scene', () => {
  expect(canRun3D(capable)).toBe(true);
});

test('no WebGL2, or a request for reduced motion, keeps the SVG', () => {
  expect(canRun3D({ ...capable, webgl2: false })).toBe(false);
  expect(canRun3D({ ...capable, reducedMotion: true })).toBe(false);
});

test('reported memory decides: 4 GB or more', () => {
  expect(canRun3D({ ...capable, deviceMemory: 4 })).toBe(true);
  expect(canRun3D({ ...capable, deviceMemory: 2, cores: 16 })).toBe(false);
});

test('without reported memory (Safari, Firefox), 4 cores or more stand in for it', () => {
  expect(canRun3D({ ...capable, deviceMemory: undefined, cores: 4 })).toBe(true);
  expect(canRun3D({ ...capable, deviceMemory: undefined, cores: 2 })).toBe(false);
  expect(canRun3D({ ...capable, deviceMemory: undefined, cores: undefined })).toBe(false);
});
