/**
 * Guards: rules that are easy to break one file at a time and costly to find later. Each guard
 * says what to do instead. Exceptions are listed with their reason; adding one is a decision,
 * not a workaround.
 *
 * - Formatting: pages and components once built dates and "Crease No. 001" on their own, and one
 *   of them showed every date a day early (local time instead of UTC). Everything that turns a
 *   value into text for people now goes through src/lib/format.ts.
 * - Debug leftovers: a stray console.log or debugger ships to every visitor.
 * - TypeScript only: the repository is 100% TypeScript, scripts and configs included. A .js file
 *   slipped back in twice before this guard existed.
 * - Shadows are black: eight of them were mixed from --color-ink, which is light in the dark
 *   themes, so paper, panels and buttons glowed instead of casting a shadow.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';
import { GENERATED_JS } from './generated-js';

const SRC = join(import.meta.dirname, '..', '..', 'src');
const SOURCE = /\.(ts|astro|vue)$/;

const files = function* (dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === 'generated') continue;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (SOURCE.test(name)) yield path;
  }
};
const sources = [...files(SRC)].map((path) => ({
  file: relative(SRC, path).split(sep).join('/'),
  lines: readFileSync(path, 'utf8').split('\n'),
}));

/** Lines matching `pattern` outside the allowed files, as "file:line". */
const offenders = (pattern: RegExp, allowed: Record<string, string>) => {
  return sources
    .filter(({ file }) => !(file in allowed))
    .flatMap(({ file, lines }) =>
      lines.flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}  ${line.trim()}`] : [])),
    );
};

describe('guards', () => {
  test('values are formatted only in lib/format.ts', () => {
    const found = offenders(/new Intl\.|\.toLocale(Date|Time)?String\(|\.padStart\(/, {
      'lib/format.ts': 'the one place that formats',
      'components/precrease/PostReaders.astro':
        'its browser script formats counts that arrive at runtime, and browser scripts stay self-contained',
    });
    expect(
      found,
      'Use formatDate, formatMonth, formatNumber, formatList or padNumber from src/lib/format.ts',
    ).toEqual([]);
  });

  // A shadow layer that blurs (its third length isn't 0) in the ink color. A 1px ring in ink is a
  // border, and stays allowed.
  const BLURRED_INK =
    /(?<=box-shadow:(?:[^;]*,)?\s*(?:inset\s+)?)-?\d+(?:px)?\s+-?\d+(?:px)?\s+[1-9]\d*px(?:\s+-?\d+px)?\s+(?:color-mix\(in \w+, )?var\(--color-ink\)/g;
  test('shadows are never mixed from the ink color', () => {
    const styled = function* (dir: string): Generator<string> {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* styled(path);
        else if (/\.(css|astro|vue)$/.test(name)) yield path;
      }
    };
    const found = [...styled(SRC)].flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(BLURRED_INK)].map(() =>
        relative(SRC, path).split(sep).join('/'),
      ),
    );
    expect(found, 'Use rgb(0 0 0 / alpha): --color-ink is light in the dark themes').toEqual([]);
  });

  test('no debug code ships', () => {
    const found = offenders(/\bconsole\.(log|debug|info)\(|\bdebugger\b/, {});
    expect(found, 'Remove it, or use console.error for a real failure the visitor cannot see').toEqual([]);
  });
});

describe('cross-origin isolation', () => {
  // A post with `isolated: true` runs code on several threads and needs SharedArrayBuffer, which
  // only exists on pages served with COOP and COEP. Forgetting the headers breaks the essay
  // silently (it falls back to one thread), so every such post must have its block.
  const headers = readFileSync(join(SRC, '..', 'public', '_headers'), 'utf8');
  const blockFor = (path: string) => {
    const lines = headers.split('\n');
    const start = lines.findIndex((l) => l.trim() === path);
    if (start < 0) return '';
    const end = lines.findIndex((l, i) => i > start && l.length > 0 && !/^\s/.test(l));
    return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
  };
  const postsDir = join(SRC, 'content', 'precrease');
  // Editions in other languages sit in a folder per language (es/…) and live under /es/precrease/.
  const isolated = readdirSync(postsDir, { recursive: true, encoding: 'utf8' })
    .map((f) => f.replaceAll('\\', '/'))
    .filter((f) => /\.mdx?$/.test(f))
    .filter((f) =>
      /^isolated:\s*true\b/m.test(readFileSync(join(postsDir, f), 'utf8').split(/^---\s*$/m)[1] ?? ''),
    )
    .map((f) => f.replace(/\.mdx?$/, ''));

  test.each(isolated.length ? isolated : ['(none yet)'])('%s is served cross-origin isolated', (slug) => {
    if (slug === '(none yet)') return;
    const [lang, name] = slug.includes('/') ? slug.split('/') : [undefined, slug];
    const path = lang ? `/${lang}/precrease/${name}` : `/precrease/${name}`;
    const block = blockFor(path);
    expect(block, `Add a ${path} block to public/_headers`).toMatch(
      /Cross-Origin-Opener-Policy: same-origin/,
    );
    expect(block).toMatch(/Cross-Origin-Embedder-Policy: require-corp/);
  });

  test('built assets carry an embedder policy, so workers started by isolated pages are allowed', () => {
    expect(blockFor('/_astro/*')).toMatch(/Cross-Origin-Embedder-Policy: require-corp/);
  });
});

test('the repository has no JavaScript sources: write .ts (Node runs it directly)', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  const js = tracked.filter((file) => /\.(js|mjs|cjs|jsx)$/.test(file));
  expect(js.filter((file) => !GENERATED_JS.some((dir) => file.startsWith(dir)))).toEqual([]);
});
