// Fails the build when JavaScript outgrows its budget, measured the way visitors receive it
// (Brotli, as Cloudflare serves it). Run after `pnpm build`.
//  - Page scripts: every script an HTML page references directly. Lighthouse also caps these.
//  - On demand: everything else in dist/_astro, which only loads when a visitor asks for it
//    (today the Inspector: Vue and the panel). Budget from decision 44.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const BUDGET_KB = { page: 15, onDemand: 30 };
const dist = join(import.meta.dirname, '..', 'dist');
const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

const scripts = readdirSync(join(dist, '_astro')).filter((f) => f.endsWith('.js'));
const html = readdirSync(dist)
  .filter((f) => f.endsWith('.html'))
  .map((f) => readFileSync(join(dist, f), 'utf8'))
  .join('\n');
const size = (file) => brotliCompressSync(readFileSync(join(dist, '_astro', file))).length;

const page = scripts.filter((f) => html.includes(`/_astro/${f}`));
const onDemand = scripts.filter((f) => !page.includes(f));
const totals = {
  page: page.reduce((sum, f) => sum + size(f), 0),
  onDemand: onDemand.reduce((sum, f) => sum + size(f), 0),
};

let failed = false;
for (const [group, bytes] of Object.entries(totals)) {
  const ok = kb(bytes) <= BUDGET_KB[group];
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${group}: ${kb(bytes)} KB of ${BUDGET_KB[group]} KB (Brotli)`);
}
if (failed) process.exit(1);
