// Records the colophon's last Lighthouse measurement into src/data/lighthouse.json, which the
// colophon's instruments read (doc 40). Lighthouse runs after the build, so the build can't
// measure the page it is building: run this after `pnpm lighthouse` and commit the file with
// the change it measured. The median of the runs, as Lighthouse CI asserts on.
// Usage: node scripts/record-lighthouse.ts
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', '.lighthouseci');
const page = 'colophon.html';

interface Lhr {
  finalDisplayedUrl: string;
  fetchTime: string;
  categories: Record<string, { score: number }>;
  audits: Record<string, { numericValue: number }>;
}
const runs = readdirSync(dir)
  .filter((f) => /^lhr-.*\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Lhr)
  .filter((r) => r.finalDisplayedUrl.endsWith(`/${page}`));
if (!runs.length) throw new Error(`No Lighthouse run of ${page} in .lighthouseci: run pnpm lighthouse first`);

const median = (values: number[]) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const score = (key: string) => Math.round(median(runs.map((r) => r.categories[key]?.score ?? 0)) * 100);
const audit = (key: string) => median(runs.map((r) => r.audits[key]?.numericValue ?? 0));

const record = {
  page: '/colophon',
  measuredOn: runs
    .map((r) => r.fetchTime)
    .toSorted()
    .at(-1)!
    .slice(0, 10),
  runs: runs.length,
  performance: score('performance'),
  accessibility: score('accessibility'),
  bestPractices: score('best-practices'),
  seo: score('seo'),
  lcpMs: Math.round(audit('largest-contentful-paint')),
  cls: Number(audit('cumulative-layout-shift').toFixed(3)),
};
writeFileSync(
  join(import.meta.dirname, '..', 'src', 'data', 'lighthouse.json'),
  `${JSON.stringify(record, null, 2)}\n`,
);
console.log('lighthouse recorded:', record);
