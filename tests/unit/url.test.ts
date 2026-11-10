import { expect, test } from 'vitest';
import { publicPath } from '../../src/lib/url';

test.each([
  ['/', '/'],
  ['/index.html', '/'],
  ['/changelog', '/changelog'],
  ['/changelog.html', '/changelog'],
  ['/changelog/', '/changelog'],
  ['/notes/threads/index.html', '/notes/threads'],
])('publicPath(%s) is %s', (input, expected) => {
  expect(publicPath(input)).toBe(expected);
});
