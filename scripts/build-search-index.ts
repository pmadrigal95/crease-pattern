// Builds Precrease's search index (Pagefind) from the built post pages, and only from them.
// Run after `astro build`.
//
// Why not `pagefind --site dist`: when no page carries `data-pagefind-body` (before the first post
// is published) the CLI falls back to indexing every page, and Precrease search would return the
// About page and the changelog. Here the input is chosen explicitly: dist/precrease/<slug>.html
// files that contain the post marker. No posts → an empty index, and search finds nothing.
//
// Every language (M5.5): posts in dist/precrease and dist/<lang>/precrease. Pagefind writes one
// index per <html lang> and the browser loads the one that matches the page, so each language finds
// only its own posts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pagefind from 'pagefind';
import { DEFAULT_LANG, LANGS } from '../src/i18n/config.ts';

const dist = join(import.meta.dirname, '..', 'dist');
const MARKER = 'data-pagefind-body';

const posts = LANGS.flatMap((lang) => {
  const base = lang === DEFAULT_LANG ? '/precrease' : `/${lang}/precrease`;
  const dir = join(dist, base);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({
      url: `${base}/${name.replace(/\.html$/, '')}`,
      content: readFileSync(join(dir, name), 'utf8'),
    }))
    .filter(({ content }) => content.includes(MARKER));
});

const { index, errors } = await pagefind.createIndex();
if (!index) throw new Error(`Pagefind could not start: ${errors.join('; ')}`);

for (const { url, content } of posts) {
  const added = await index.addHTMLFile({ url, content });
  if (added.errors.length) throw new Error(`Pagefind rejected ${url}: ${added.errors.join('; ')}`);
}
const written = await index.writeFiles({ outputPath: join(dist, 'pagefind') });
if (written.errors.length) throw new Error(`Pagefind could not write: ${written.errors.join('; ')}`);
await pagefind.close();

console.log(`search: ${posts.length} post${posts.length === 1 ? '' : 's'} indexed`);
