// Fails the build when JavaScript outgrows its budget, measured the way visitors receive it
// (Brotli, as Cloudflare serves it). Run after `pnpm build`.
//  - Page scripts: every script an HTML page references directly. Lighthouse also caps these.
//  - On demand: what those scripts can import later (today the Inspector: Vue and the panel),
//    found by following their imports. Files nothing references never reach a visitor and don't
//    count. Budget from decision 44 (raised from 30 to 32 KB when the Identity switcher joined the panel).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

const BUDGET_KB = { page: 15, onDemand: 32 };
const assets = join(import.meta.dirname, '..', 'dist', '_astro');
const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const read = (file) => readFileSync(join(assets, file), 'utf8');
const size = (file) => brotliCompressSync(readFileSync(join(assets, file))).length;

const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));
const html = readdirSync(join(assets, '..'))
  .filter((f) => f.endsWith('.html'))
  .map((f) => readFileSync(join(assets, '..', f), 'utf8'))
  .join('\n');

// Static (`from"./x.js"`, `import"./x.js"`) and dynamic (`import("./x.js")`) imports between chunks.
const importsOf = (file) =>
  [...read(file).matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((m) => m[1]);

const page = scripts.filter((f) => html.includes(`/_astro/${f}`));
const onDemand = new Set();
const queue = page.flatMap(importsOf);
while (queue.length) {
  const file = queue.pop();
  if (page.includes(file) || onDemand.has(file) || !scripts.includes(file)) continue;
  onDemand.add(file);
  queue.push(...importsOf(file));
}

const totals = {
  page: page.reduce((sum, f) => sum + size(f), 0),
  onDemand: [...onDemand].reduce((sum, f) => sum + size(f), 0),
};

let failed = false;
for (const [group, bytes] of Object.entries(totals)) {
  const ok = kb(bytes) <= BUDGET_KB[group];
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${group}: ${kb(bytes)} KB of ${BUDGET_KB[group]} KB (Brotli)`);
}
if (failed) process.exit(1);
