import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// Every Precrease post says what it draws on or where to keep learning (decided 2026-11-13). The
// schema checks each entry's shape and HTTPS; this checks that no post ships without any.
const dir = join(process.cwd(), 'src/content/precrease');
const posts = readdirSync(dir).filter((f) => /\.mdx?$/.test(f));

test.each(posts)('%s lists at least one reference', (file) => {
  const frontMatter = readFileSync(join(dir, file), 'utf8').split(/^---$/m)[1] ?? '';
  const block = /^references:\n((?:\s+.*\n?)+)/m.exec(frontMatter)?.[1] ?? '';
  const urls = [...block.matchAll(/^\s+url:\s*(\S+)/gm)].map((m) => m[1]);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(url).toMatch(/^https:\/\//);
});
