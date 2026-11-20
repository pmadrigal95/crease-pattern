import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { GENERATED_JS } from './generated-js';

const ROOT = join(import.meta.dirname, '..', '..');

// Generated folders (guards.test.ts, GENERATED_JS) are built elsewhere and copied in. Their
// SOURCE.md lists a SHA-256 per file; any change that isn't a new build with a new SOURCE.md fails.
describe.each(GENERATED_JS)('%s', (dir) => {
  const source = readFileSync(join(ROOT, dir, 'SOURCE.md'), 'utf8');
  const listed = Object.fromEntries(
    [...source.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/gm)].map(([, file, hash]) => [file, hash]),
  );

  test('SOURCE.md lists every file in the folder, and only those', () => {
    const files = readdirSync(join(ROOT, dir)).filter((f) => f !== 'SOURCE.md');
    expect(Object.keys(listed).toSorted()).toEqual(files.toSorted());
  });

  test('every file matches its SHA-256', () => {
    for (const [file, hash] of Object.entries(listed)) {
      const actual = createHash('sha256')
        .update(readFileSync(join(ROOT, dir, file)))
        .digest('hex');
      expect(actual, file).toBe(hash);
    }
  });
});
