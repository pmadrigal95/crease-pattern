// Guards the CI/CD trust boundaries found in the 2026-10 security audit:
// 1. every action is pinned to a full commit SHA, never a movable tag;
// 2. every checkout drops the persisted GITHUB_TOKEN;
// 3. the Cloudflare secrets appear only in deploy.yml, inside a job that runs in the
//    `production` environment and only on main.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '.github/workflows';
const SECRET = /secrets\.CLOUDFLARE_/;
const problems = [];

for (const name of readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f))) {
  const file = join(DIR, name);
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    const uses = line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if (uses && !/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(uses[1])) {
      problems.push(`${file}:${i + 1} ${uses[1]} is not pinned to a full commit SHA`);
    }
    if (uses && uses[1].startsWith('actions/checkout@')) {
      const block = lines.slice(i + 1, i + 4).join('\n');
      if (!/persist-credentials:\s*false/.test(block)) {
        problems.push(`${file}:${i + 1} actions/checkout must set persist-credentials: false`);
      }
    }
  });

  if (!SECRET.test(lines.join('\n'))) continue;
  if (name !== 'deploy.yml') {
    problems.push(`${file} references the Cloudflare secrets; only deploy.yml may`);
    continue;
  }
  // Split deploy.yml into jobs by their two-space indented keys under `jobs:`.
  const jobsStart = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  const jobs = [];
  for (let i = jobsStart + 1; i < lines.length; i++) {
    const key = lines[i].match(/^ {2}([\w-]+):\s*$/);
    if (key) jobs.push({ name: key[1], body: [] });
    else if (jobs.length) jobs[jobs.length - 1].body.push(lines[i]);
  }
  for (const job of jobs) {
    const body = job.body.join('\n');
    if (!SECRET.test(body)) continue;
    if (!/^ {4}environment:\s*production\s*$/m.test(body)) {
      problems.push(
        `${file} job "${job.name}" uses the Cloudflare secrets outside the production environment`,
      );
    }
    if (!/^ {4}if:\s*github\.ref == 'refs\/heads\/main'\s*$/m.test(body)) {
      problems.push(`${file} job "${job.name}" uses the Cloudflare secrets without a main-only condition`);
    }
  }
}

if (problems.length) {
  console.error('Workflow policy violations:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  'Workflows OK: actions pinned by SHA, no persisted credentials, secrets only in main-only production deploy.',
);
