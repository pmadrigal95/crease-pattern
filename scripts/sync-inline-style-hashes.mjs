// Runs after `astro build`: makes sure every inline <style> block in a page has its hash in that
// page's Content Security Policy.
//
// Astro hashes the inline styles it renders, but it misses the styles of components used inside
// MDX content (a post's own components, such as the Threads essay's demos or MarginNote). Our
// Vite setting inlines a page's CSS when it's small (astro.config.mjs, assetsInlineLimit), so
// those styles land in the HTML without a hash and the browser blocks them, as the CSP says.
//
// This adds the exact SHA-256 of each such block to `style-src`, nothing else: never
// 'unsafe-inline', and only for content this build wrote. Pass --check to fail instead of fixing
// (useful to see whether Astro still needs it).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const check = process.argv.includes('--check');

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith('.html')) yield path;
  }
}

const hashOf = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const META = /(<meta\s+http-equiv="content-security-policy"\s+content=")([^"]*)(")/i;

let pages = 0;
let added = 0;
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, 'utf8');
  const meta = META.exec(html);
  if (!meta) continue;
  const policy = meta[2];
  const missing = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g)]
    .map((m) => hashOf(m[1]))
    .filter((hash, i, all) => all.indexOf(hash) === i && !policy.includes(hash));
  if (missing.length === 0) continue;
  pages++;
  added += missing.length;
  if (check) {
    console.error(`${file}: ${missing.length} inline style block(s) without a hash in the CSP`);
    continue;
  }
  const fixed = /style-src\s/.test(policy)
    ? policy.replace(/style-src\s([^;]*)/, (_, sources) => `style-src ${sources} ${missing.join(' ')}`)
    : `${policy}; style-src 'self' ${missing.join(' ')}`;
  writeFileSync(file, html.replace(META, `$1${fixed}$3`));
}

if (check && added > 0) process.exit(1);
console.log(
  added
    ? `CSP: added ${added} inline style hash(es) on ${pages} page(s).`
    : 'CSP: every inline style already has its hash.',
);
