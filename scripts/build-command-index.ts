// Builds the ⌘K index (M4.7): every page of the site, its sections and every Precrease post, read
// from the built HTML so the menu offers exactly what the site has. Run after `astro build`.
//
// One index per language (M5.5): /commands.json for English, /<lang>/commands.json for the others,
// each with that language's pages and posts only. The menu fetches the one for the page it opens on.
//
// Why not Pagefind: it needs WebAssembly, which the CSP allows only on Precrease pages, on purpose.
// The site is small, so names and section headings are enough to find a place; full-text search
// of the posts stays in Precrease's own box, and ⌘K hands a query over to it.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { plainText } from './plain-text.ts';
import { DEFAULT_LANG, LANGS, commandIndexPath, type Lang } from '../src/i18n/config.ts';

/** A site path in `lang` (the same rule as src/i18n/routing.ts, which Node can't import directly). */
const localize = (path: string, lang: Lang): string =>
  lang === DEFAULT_LANG ? path : path === '/' ? `/${lang}` : `/${lang}${path}`;

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
const titleTag = (page: string) => decode(page.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
/** "About · Pablo Madrigal" → "About"; "Topic map · Precrease · Pablo Madrigal" → "Topic map". */
const titleOf = (page: string, owner: string): string => {
  const parts = titleTag(page)
    .split(' · ')
    .filter((p) => p !== owner && p !== 'Precrease');
  // Precrease's own front page has nothing left once the names go: it is Precrease.
  return parts[0] ?? titleTag(page).split(' · ')[0] ?? '';
};
const description = (page: string): string =>
  decode(page.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
/**
 * The page's second-level headings that carry an anchor, inside its main content. A heading that
 * is a link (Precrease's featured post) leads to another page, so it is not a section of this one.
 */
const sections = (page: string): { title: string; anchor: string }[] => {
  const main = page.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
  return [...main.matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .filter(([, , inner = '']) => !/<a\b/.test(inner))
    .map(([, id = '', inner = '']) => ({ title: decode(inner), anchor: id }))
    .filter((s) => s.title);
};
/** The home page's name in ⌘K, from the language's copy file. */
const homeTitle = (lang: Lang): string => {
  const copy = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'src/i18n/locales', lang, 'ui.json'), 'utf8'),
  );
  return (copy as { commands: { home: string } }).commands.home;
};

const build = (lang: Lang) => {
  const home = html(localize('/', lang));
  if (!home) throw new Error(`The ${lang} home page is missing: run astro build first.`);
  const owner = titleTag(home).split(' · ')[0] ?? '';

  const pages = PAGES.map((path) => localize(path, lang)).flatMap((path) => {
    const page = html(path);
    if (!page) return [];
    const isHome = path === localize('/', lang);
    return [
      {
        title: isHome ? homeTitle(lang) : titleOf(page, owner),
        href: path,
        sections: sections(page).map((s) => ({ title: s.title, href: `${path}#${s.anchor}` })),
      },
    ];
  });

  // Posts in this language: the pages that carry Precrease's post marker, newest number first.
  const base = localize('/precrease', lang);
  const postsDir = join(dist, base);
  const posts = (existsSync(postsDir) ? readdirSync(postsDir) : [])
    .filter((name) => name.endsWith('.html'))
    .map((name) => ({ name, page: readFileSync(join(postsDir, name), 'utf8') }))
    .filter(({ page }) => page.includes('data-pagefind-body'))
    .map(({ name, page }) => ({
      title: titleOf(page, owner),
      href: `${base}/${name.replace(/\.html$/, '')}`,
      number: Number(page.match(/data-pagefind-meta="number"[^>]*>(\d+)</)?.[1] ?? 0),
      description: description(page),
    }))
    .sort((a, b) => b.number - a.number);

  const file = join(dist, commandIndexPath(lang));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ pages, posts }));
  console.log(`commands (${lang}): ${pages.length} pages, ${posts.length} posts`);
};

for (const lang of LANGS) build(lang);
