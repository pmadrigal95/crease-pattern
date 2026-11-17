// Measures the JavaScript a visitor receives, the way Cloudflare serves it (Brotli). Shared by the
// budget check (scripts/check-bundle-budgets.mjs) and the home page's measured figures
// (scripts/stamp-site-metrics.mjs), so the number shown is the number enforced.
//  - page: every script an HTML page references directly.
//  - onDemand: what those scripts can import later, found by following their imports. Files
//    nothing references never reach a visitor and don't count.
//  - scene3d: M4's 3D scene (src/components/inspector/scene3d.ts) and what only it imports
//    (three.js). It loads only on the home page, on capable devices, so it has a budget of its own
//    and the other groups stop at it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';

export const toKb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

/** The 3D scene's entry chunk, as Vite names it after its source file. */
const isScene3d = (file) => /^scene3d\.[\w-]+\.js$/.test(file);

/** @returns {{ page: number, onDemand: number, scene3d: number }} bytes, Brotli */
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

  /** Every chunk reachable from `start`, minus `skip` and anything `stop` matches. */
  const closure = (start, skip, stop = () => false) => {
    const seen = new Set();
    const queue = [...start];
    while (queue.length) {
      const file = queue.pop();
      if (seen.has(file) || skip.has(file) || stop(file) || !scripts.includes(file)) continue;
      seen.add(file);
      queue.push(...importsOf(file));
    }
    return seen;
  };
  const sum = (files) => [...files].reduce((total, f) => total + size(f), 0);

  const page = new Set(scripts.filter((f) => html.includes(`/_astro/${f}`)));
  const onDemand = closure([...page].flatMap(importsOf), page, isScene3d);
  // A chunk the scene shares with the panel (Vite's helpers) is already counted in onDemand.
  const scene3d = closure(scripts.filter(isScene3d), new Set([...page, ...onDemand]));
  return { page: sum(page), onDemand: sum(onDemand), scene3d: sum(scene3d) };
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
 * Everything one Precrease post can run: the scripts its page references, what they import, and
 * the Web Workers they start, with the workers' own imports. Workers count because a reader who
 * presses Run downloads them. Pages missing from `dist` (drafts in a production build) are
 * skipped, so a production build measures only the posts that are out.
 * @param {string[]} paths site paths, such as "/precrease/when-threads-pay-off"
 * @returns {{ path: string, bytes: number }[]} Brotli
 */
export function measurePosts(dist, paths) {
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
      // The 3D scene loads only where the hero fox is, never on a post.
      if (seen.has(file) || !scripts.has(file) || isScene3d(file)) continue;
      seen.add(file);
      queue.push(...linksOf(file));
    }
    return [{ path, bytes: [...seen].reduce((sum, f) => sum + size(f), 0) }];
  });
}
