// Serves dist/ with the headers in public/_headers, the way Cloudflare does: `astro preview` ignores
// that file, so a page there is never cross-origin isolated. The essay's end-to-end tests run
// against this (playwright.essay.config.ts) to exercise real Web Workers and SharedArrayBuffer.
// Test use only: no caching, no compression. Usage: node scripts/serve-dist.mjs [port]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'dist');
const port = Number(process.argv[2] ?? 4323);

/** `_headers` as rules: a path (exact, or ending in `*`) and the headers it adds. */
function headerRules() {
  const rules = [];
  for (const line of readFileSync(join(root, '_headers'), 'utf8').split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ path: line.trim(), headers: [] });
    else
      rules.at(-1)?.headers.push(
        line
          .trim()
          .split(/:\s*(.*)/s)
          .slice(0, 2),
      );
  }
  return rules;
}
const rules = headerRules();
const matches = (rule, path) => (rule.endsWith('*') ? path.startsWith(rule.slice(0, -1)) : path === rule);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

/** `/about` → about.html (build.format 'file'), `/` → index.html; null outside dist or missing. */
function fileFor(path) {
  const candidates = path.endsWith('/') ? [`${path}index.html`] : [path, `${path}.html`];
  for (const candidate of candidates) {
    const file = normalize(join(root, decodeURIComponent(candidate)));
    if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  for (const rule of rules)
    if (matches(rule.path, path)) for (const [name, value] of rule.headers) res.setHeader(name, value);
  const file = fileFor(path);
  res.statusCode = file ? 200 : 404;
  const served = file ?? join(root, '404.html');
  res.setHeader('Content-Type', TYPES[extname(served)] ?? 'application/octet-stream');
  res.end(readFileSync(served));
}).listen(port, () => console.log(`dist/ with _headers on http://localhost:${port}`));
