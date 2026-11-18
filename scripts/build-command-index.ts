// Builds the ⌘K index (M4.7): every page of the site, its sections and every Precrease post, read
// from the built HTML so the menu offers exactly what the site has. Run after `astro build`.
//
// Why not Pagefind: it needs WebAssembly, which the CSP allows only on Precrease pages, on purpose.
// The site is small, so names and section headings are enough to find a place; full-text search
// of the posts stays in Precrease's own box, and ⌘K hands a query over to it.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainText } from './plain-text.ts';

const dist = join(import.meta.dirname, '..', 'dist');

/** The pages ⌘K lists, in this order: the site's own, then Precrease's. */
const PAGES = [
  '/',
  '/about',
  '/changelog',
  '/colophon',
  '/privacy',
  '/precrease',
  '/precrease/map',
  '/precrease/subscribe',
];

const html = (path: string): string | null => {
  const file = join(dist, path === '/' ? 'index.html' : `${path.slice(1)}.html`);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
};
const decode = plainText;
/** "About · Pablo Madrigal" → "About"; "Topic map · Precrease · Pablo Madrigal" → "Topic map". */
const titleOf = (page: string, owner: string): string => {
  const title = decode(page.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const parts = title.split(' · ').filter((p) => p !== owner && p !== 'Precrease');
  // Precrease's own front page has nothing left once the names go: it is Precrease.
  return parts[0] ?? title.split(' · ')[0] ?? title;
};
const description = (page: string): string =>
  decode(page.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
/** The page's second-level headings that carry an anchor, inside its main content. */
const sections = (page: string): { title: string; anchor: string }[] => {
  const main = page.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
  return [...main.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .map(([, id = '', inner = '']) => ({ title: decode(inner), anchor: id }))
    .filter((s) => s.title);
};

const home = html('/');
if (!home) throw new Error('dist/index.html is missing: run astro build first.');
const owner = decode(home.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').split(' · ')[0] ?? '';

const pages = PAGES.flatMap((path) => {
  const page = html(path);
  if (!page) return [];
  return [
    {
      title: path === '/' ? 'Home' : titleOf(page, owner),
      href: path,
      sections: sections(page).map((s) => ({
        title: s.title,
        href: `${path === '/' ? '/' : path}#${s.anchor}`,
      })),
    },
  ];
});

// Posts: the pages that carry Precrease's post marker, newest number first.
const postsDir = join(dist, 'precrease');
const posts = readdirSync(postsDir)
  .filter((name) => name.endsWith('.html'))
  .map((name) => ({ name, page: readFileSync(join(postsDir, name), 'utf8') }))
  .filter(({ page }) => page.includes('data-pagefind-body'))
  .map(({ name, page }) => ({
    title: titleOf(page, owner),
    href: `/precrease/${name.replace(/\.html$/, '')}`,
    number: Number(page.match(/data-pagefind-meta="number"[^>]*>(\d+)</)?.[1] ?? 0),
    description: description(page),
  }))
  .sort((a, b) => b.number - a.number);

writeFileSync(join(dist, 'commands.json'), JSON.stringify({ pages, posts }));
console.log(`commands: ${pages.length} pages, ${posts.length} posts`);
