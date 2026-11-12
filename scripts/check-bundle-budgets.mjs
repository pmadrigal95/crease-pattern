// Fails the build when JavaScript outgrows its budget (src/config/quality.ts), measured the way
// visitors receive it. Run after `pnpm build`. Budgets from decision 44 (on-demand raised from 30
// to 32 KB when the Identity switcher joined the panel).
import { join } from 'node:path';
import { jsBudgetKb } from '../src/config/quality.ts';
import { measureBundles, toKb } from './bundle-sizes.mjs';

const totals = measureBundles(join(import.meta.dirname, '..', 'dist'));

let failed = false;
for (const [group, bytes] of Object.entries(totals)) {
  const ok = toKb(bytes) <= jsBudgetKb[group];
  failed ||= !ok;
  console.log(`${ok ? 'OK  ' : 'OVER'} ${group}: ${toKb(bytes)} KB of ${jsBudgetKb[group]} KB (Brotli)`);
}
if (failed) process.exit(1);
