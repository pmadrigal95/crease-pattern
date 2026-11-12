// Builds Precrease's search index (Pagefind) from the built post pages, and only from them.
// Run after `astro build`.
//
// Why not `pagefind --site dist`: when no page carries `data-pagefind-body` (before the first post
// is published) the CLI falls back to indexing every page, and Precrease search would return the
// About page and the changelog. Here the input is chosen explicitly: dist/precrease/<slug>.html
// files that contain the post marker. No posts → an empty index, and search finds nothing.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pagefind from 'pagefind';

const dist = join(import.meta.dirname, '..', 'dist');
const postsDir = join(dist, 'precrease');
const MARKER = 'data-pagefind-body';

const posts = readdirSync(postsDir)
  .filter((name) => name.endsWith('.html'))
  .map((name) => ({ name, content: readFileSync(join(postsDir, name), 'utf8') }))
  .filter(({ content }) => content.includes(MARKER));

const { index, errors } = await pagefind.createIndex();
if (!index) throw new Error(`Pagefind could not start: ${errors.join('; ')}`);

for (const { name, content } of posts) {
  const added = await index.addHTMLFile({ url: `/precrease/${name.replace(/\.html$/, '')}`, content });
  if (added.errors.length) throw new Error(`Pagefind rejected ${name}: ${added.errors.join('; ')}`);
}
const written = await index.writeFiles({ outputPath: join(dist, 'pagefind') });
if (written.errors.length) throw new Error(`Pagefind could not write: ${written.errors.join('; ')}`);
await pagefind.close();

console.log(`search: ${posts.length} post${posts.length === 1 ? '' : 's'} indexed`);
