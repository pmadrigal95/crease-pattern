// Measures the JavaScript a visitor receives, the way Cloudflare serves it (Brotli). Shared by the
// budget check (scripts/check-bundle-budgets.mjs) and the home page's measured figures
// (scripts/stamp-site-metrics.mjs), so the number shown is the number enforced.
//  - page: every script an HTML page references directly.
//  - onDemand: what those scripts can import later, found by following their imports. Files
//    nothing references never reach a visitor and don't count.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

export const toKb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** @returns {{ page: number, onDemand: number }} bytes, Brotli */
export function measureBundles(dist) {
  const assets = join(dist, '_astro');
  const read = (file) => readFileSync(join(assets, file), 'utf8');
  const size = (file) => brotliCompressSync(readFileSync(join(assets, file))).length;
  const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const html = readdirSync(dist)
    .filter((f) => f.endsWith('.html'))
    .map((f) => readFileSync(join(dist, f), 'utf8'))
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
  return {
    page: page.reduce((sum, f) => sum + size(f), 0),
    onDemand: [...onDemand].reduce((sum, f) => sum + size(f), 0),
  };
}

/**
 * Everything one page runs on load: the external scripts it references plus the scripts Astro
 * inlined into it (small ones with no imports), each Brotli-compressed. This is what the home
 * page's "JavaScript on first load" figure reports.
 * @returns {number} bytes, Brotli
 */
export function measurePage(dist, page) {
  const html = readFileSync(join(dist, page), 'utf8');
  const external = [...html.matchAll(/<script[^>]*\ssrc="\/_astro\/([^"]+\.js)"/g)].map((m) =>
    readFileSync(join(dist, '_astro', m[1])),
  );
  const inline = [
    ...html.matchAll(
      /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((m) => m[1])
    .filter((code) => code.trim());
  return [...external, ...inline].reduce((sum, code) => sum + brotliCompressSync(code).length, 0);
}

/**
 * The Inspector's manifest as Vite emits it (/_astro/inspector.<hash>.json), Brotli. Zero when the
 * build has none.
 * @returns {number} bytes
 */
export function measureInspectorData(dist) {
  const assets = join(dist, '_astro');
  return readdirSync(assets)
    .filter((f) => /^inspector\.[\w-]+\.json$/.test(f))
    .reduce((sum, f) => sum + brotliCompressSync(readFileSync(join(assets, f))).length, 0);
}

/**
 * Everything an interactive essay (a post `public/_headers` isolates) can run: the scripts its page
 * references, what they import, and the Web Workers they start, with the workers' own imports.
 * Workers count because a reader who presses Run downloads them. Pages missing from `dist` (drafts
 * in a production build) are skipped, so this returns an empty list there.
 * @param {string[]} paths site paths, such as "/precrease/when-threads-pay-off"
 * @returns {{ path: string, bytes: number }[]} Brotli
 */
export function measureEssays(dist, paths) {
  const assets = join(dist, '_astro');
  const read = (file) => readFileSync(join(assets, file), 'utf8');
  const size = (file) => brotliCompressSync(readFileSync(join(assets, file))).length;
  const scripts = new Set(readdirSync(assets).filter((f) => f.endsWith('.js')));
  const linksOf = (file) => [
    ...[...read(file).matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((m) => m[1]),
    ...[...read(file).matchAll(/new URL\(\s*["'`]\/_astro\/([^"'`]+\.js)["'`]/g)].map((m) => m[1]),
  ];
  return paths.flatMap((path) => {
    let html;
    try {
      html = readFileSync(join(dist, `${path}.html`), 'utf8');
    } catch {
      return [];
    }
    const seen = new Set();
    const queue = [...html.matchAll(/\/_astro\/([^"'\s]+\.js)/g)].map((m) => m[1]);
    while (queue.length) {
      const file = queue.pop();
      if (seen.has(file) || !scripts.has(file)) continue;
      seen.add(file);
      queue.push(...linksOf(file));
    }
    return [{ path, bytes: [...seen].reduce((sum, f) => sum + size(f), 0) }];
  });
}
