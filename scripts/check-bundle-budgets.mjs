// Fails the build when JavaScript outgrows its budget (src/config/quality.ts), measured the way
// visitors receive it. Run after `pnpm build`. Budgets from decision 44 (on-demand raised from 30
// to 32 KB when the Identity switcher joined the panel). Each Precrease post has its own budget.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { jsBudgetKb } from '../src/config/quality.ts';
import { measureBundles, measureInspectorData, measurePosts, toKb } from './bundle-sizes.mjs';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
/** Every post's page, from the content folder: one MDX file per post. */
const postPaths = readdirSync(join(root, 'src/content/precrease'))
  .filter((f) => /\.mdx?$/.test(f))
  .map((f) => `/precrease/${f.replace(/\.mdx?$/, '')}`);
const rows = [
  ...Object.entries(measureBundles(dist)).map(([group, bytes]) => ({ label: group, group, bytes })),
  { label: 'inspectorData', group: 'inspectorData', bytes: measureInspectorData(dist) },
  ...measurePosts(dist, postPaths).map(({ path, bytes }) => ({
    label: `post ${path}`,
    group: 'post',
    bytes,
  })),
];

let failed = false;
for (const { label, group, bytes } of rows) {
  const ok = toKb(bytes) <= jsBudgetKb[group];
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${label}: ${toKb(bytes)} KB of ${jsBudgetKb[group]} KB (Brotli)`);
}
if (failed) process.exit(1);
