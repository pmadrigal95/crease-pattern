// Keeps the repository text-only. Photos and videos belong in the media store
// (Cloudflare R2), referenced through media.json, so the repo stays small forever.
// Fails when a tracked file is too large or is a video, whatever its size.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const MAX_BYTES = 500 * 1024;
const ALLOWED_LARGE = new Set(['pnpm-lock.yaml']);
const VIDEO = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

const problems = [];
for (const file of files) {
  if (VIDEO.test(file)) {
    problems.push(`${file}: videos are not stored in the repository`);
    continue;
  }
  const { size } = statSync(file);
  if (size > MAX_BYTES && !ALLOWED_LARGE.has(file)) {
    problems.push(`${file}: ${Math.round(size / 1024)} KB (limit ${MAX_BYTES / 1024} KB)`);
  }
}

if (problems.length > 0) {
  console.error('Files that belong in the media store (Cloudflare R2), not in git:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`File sizes OK: ${files.length} tracked files, none above ${MAX_BYTES / 1024} KB.`);
