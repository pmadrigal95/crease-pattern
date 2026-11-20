// Writes dist/sitemap.xml and dist/robots.txt from the built pages (scripts/sitemap.ts). Run after
// `astro build`. Replaces @astrojs/sitemap, which can't pair pages whose slugs differ by language
// and listed pages marked `noindex`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPage, sitemapXml } from './sitemap.ts';

const dist = join(import.meta.dirname, '..', 'dist');

const pages = readdirSync(dist, { recursive: true, encoding: 'utf8' })
  .map((f) => f.replaceAll('\\', '/'))
  // Pages only: the 404 page and anything Pagefind or Vite wrote are not places to index.
  .filter((f) => f.endsWith('.html') && f !== '404.html' && !/^(_astro|pagefind)\//.test(f))
  .flatMap((f) => {
    const page = readPage(readFileSync(join(dist, f), 'utf8'));
    return page ? [page] : [];
  });

const home = pages.find((p) => new URL(p.loc).pathname === '/');
if (!home) throw new Error('sitemap: the home page is missing or has no canonical URL');
const sitemap = new URL('/sitemap.xml', home.loc).href;

writeFileSync(join(dist, 'sitemap.xml'), sitemapXml(pages));
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`);
console.log(`sitemap: ${pages.length} pages`);
