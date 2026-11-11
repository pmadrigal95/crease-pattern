import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildManifest } from '../../scripts/build-inspector-manifest.mjs';

const root = process.cwd();
const manifest = buildManifest(root);

const astroFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? astroFiles(join(dir, e.name)) : e.name.endsWith('.astro') ? [join(dir, e.name)] : [],
  );

describe('inspector manifest', () => {
  test('lists every data-inspect id in the source, and nothing else', () => {
    const inSource = ['src/components', 'src/pages']
      .flatMap(astroFiles)
      .flatMap((f) =>
        [...readFileSync(join(root, f), 'utf8').matchAll(/data-inspect="([^"]+)"/g)].map((m) => m[1]),
      );
    expect(Object.keys(manifest.parts).sort()).toEqual([...inSource].sort());
  });

  test('ids follow their file: component name, or page#section', () => {
    for (const [id, file] of Object.entries(manifest.parts)) {
      const name = basename(file, '.astro');
      if (file.startsWith('src/pages/')) expect(id.startsWith(`${name}#`), id).toBe(true);
      else expect(id, file).toBe(name);
    }
  });

  test('every part points at a real file with facts derived from it', () => {
    for (const file of Object.values(manifest.parts)) {
      expect(existsSync(join(root, file)), file).toBe(true);
      expect(manifest.files[file], file).toBeDefined();
    }
  });

  test('tokens are real design tokens the file actually uses', () => {
    const facts = manifest.files['src/components/site/FoldedPortrait.astro'] ?? { tokens: [] };
    expect(facts.tokens).toContain('color-accent-ui');
    expect(facts.tokens).toContain('motion-portrait');
    expect(facts.tokens.every((t) => /^[a-z0-9-]+$/.test(t))).toBe(true);
  });
});
