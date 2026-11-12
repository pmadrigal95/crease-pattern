// Scheduled publishing (deploy.yml): decides whether the daily run has anything to publish, so
// production isn't rebuilt every day for nothing. Prints `publish=true` or `publish=false` for
// $GITHUB_OUTPUT.
//
// A post is due when it isn't a draft and its date falls in the last few days, today included.
// The window is wider than one day on purpose: if a daily run fails, the next one still
// publishes the post. Redeploying the same post twice is harmless; missing it is not.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WINDOW_DAYS = 3;
// fileURLToPath rather than import.meta.dirname: this runs on the runner's own Node, whatever
// its version.
const dir = fileURLToPath(new URL('../src/content/precrease/', import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const earliest = new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

const due = readdirSync(dir)
  .filter((file) => /\.mdx?$/.test(file))
  .filter((file) => {
    const front = readFileSync(join(dir, file), 'utf8').split(/^---\s*$/m)[1] ?? '';
    const date = /^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m.exec(front)?.[1];
    const draft = /^draft:\s*true\b/m.test(front);
    return !draft && date !== undefined && date >= earliest && date <= today;
  });

console.error(due.length ? `Due: ${due.join(', ')}` : 'Nothing scheduled for today.');
console.log(`publish=${due.length > 0}`);
