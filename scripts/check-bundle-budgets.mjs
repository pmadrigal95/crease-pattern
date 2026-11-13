// Fails the build when JavaScript outgrows its budget (src/config/quality.ts), measured the way
// visitors receive it. Run after `pnpm build`. Budgets from decision 44 (on-demand raised from 30
// to 32 KB when the Identity switcher joined the panel). Interactive essays have their own budget.
import { join } from 'node:path';
import { jsBudgetKb } from '../src/config/quality.ts';
import { measureBundles, measureEssays, toKb } from './bundle-sizes.mjs';
import { isolatedPaths } from './dev-isolation.mjs';

const dist = join(import.meta.dirname, '..', 'dist');
const rows = [
  ...Object.entries(measureBundles(dist)).map(([group, bytes]) => ({ label: group, group, bytes })),
  ...measureEssays(dist, isolatedPaths()).map(({ path, bytes }) => ({
    label: `essay ${path}`,
    group: 'essay',
    bytes,
  })),
];

let failed = false;
for (const { label, group, bytes } of rows) {
  const ok = toKb(bytes) <= jsBudgetKb[group];
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${label}: ${toKb(bytes)} KB of ${jsBudgetKb[group]} KB (Brotli)`);
}
if (!rows.some((r) => r.group === 'essay'))
  console.log('-    essay: no interactive essay in this build (drafts are only in preview builds)');
if (failed) process.exit(1);
