/**
 * Guards: rules that are easy to break one file at a time and costly to find later. Each guard
 * says what to do instead. Exceptions are listed with their reason; adding one is a decision,
 * not a workaround.
 *
 * - Formatting: pages and components once built dates and "Crease No. 001" on their own, and one
 *   of them showed every date a day early (local time instead of UTC). Everything that turns a
 *   value into text for people now goes through src/lib/format.ts.
 * - Debug leftovers: a stray console.log or debugger ships to every visitor.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..', 'src');
const SOURCE = /\.(ts|astro|vue|mjs|js)$/;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'generated') continue;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (SOURCE.test(name)) yield path;
  }
}
const sources = [...files(SRC)].map((path) => ({
  file: relative(SRC, path).split(sep).join('/'),
  lines: readFileSync(path, 'utf8').split('\n'),
}));

/** Lines matching `pattern` outside the allowed files, as "file:line". */
function offenders(pattern: RegExp, allowed: Record<string, string>) {
  return sources
    .filter(({ file }) => !(file in allowed))
    .flatMap(({ file, lines }) =>
      lines.flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [])),
    );
}

describe('guards', () => {
  test('values are formatted only in lib/format.ts', () => {
    const found = offenders(/new Intl\.|\.toLocale(Date|Time)?String\(|\.padStart\(/, {
      'lib/format.ts': 'the one place that formats',
    });
    expect(
      found,
      'Use formatDate, formatMonth, formatNumber, formatList or padNumber from src/lib/format.ts',
    ).toEqual([]);
  });

  test('no debug code ships', () => {
    const found = offenders(/\bconsole\.(log|debug|info)\(|\bdebugger\b/, {});
    expect(found, 'Remove it, or use console.error for a real failure the visitor cannot see').toEqual([]);
  });
});
