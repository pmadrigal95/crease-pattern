// Measures the JavaScript a visitor receives, the way Cloudflare serves it (Brotli). Shared by the
// budget check (scripts/check-bundle-budgets.ts) and the home page's measured figures
// (scripts/stamp-site-metrics.ts), so the number shown is the number enforced.
//  - page: every script an HTML page references directly.
//  - onDemand: what those scripts can import later, found by following their imports. Files
//    nothing references never reach a visitor and don't count.
//  - workModel: the Work section's Sonobe animator (src/components/site/work-model.ts), loaded on
//    the home page as the section approaches.
//  - scene3d: M4's 3D scenes, the hero's fox (src/components/inspector/scene3d.ts) and the Work
//    star (src/components/site/work3d.ts), and what only they import (three.js, shared). They load
//    only on the home page, on capable devices.
//  - commandMenu: the command menu (src/components/site/command-menu.ts), loaded on any page the
//    first time a visitor opens it with Ctrl/Cmd+K or its button.
//  - inspectorViews: the Inspector's folded views (src/components/inspector/fold.ts), loaded the
//    first time a visitor picks Fold or Pattern in the panel.
//  These have budgets of their own, and the other groups stop at them.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync } from 'node:zlib';
import { LANGS, commandIndexPath } from '../src/i18n/config.ts';

export const toKb = (bytes: number): number => Math.round((bytes / 1024) * 10) / 10;

/**
 * The 3D scenes' chunks, as Vite names them after their source files: the scenes, and their loader
 * (src/scripts/hero3d.ts) with the device check it runs first (src/lib/scene3d-support.ts). The
 * hero and the Inspector both call the loader to bring the figure up; it is 3D code either way, so
 * it counts here, not in the Inspector's onDemand (where it took 0.8 KB until 2026-11-20).
 */
const isScene3d = (file: string): boolean =>
  /^(scene3d|work3d|hero3d|scene3d-support)\.[\w-]+\.js$/.test(file);
/** The Work animator's entry chunk. */
const isWorkModel = (file: string): boolean => /^work-model\.[\w-]+\.js$/.test(file);
/** The command menu's entry chunk. */
const isCommandMenu = (file: string): boolean => /^command-menu\.[\w-]+\.js$/.test(file);
/** The Inspector's folded views' entry chunk. */
const isInspectorViews = (file: string): boolean => /^fold\.[\w-]+\.js$/.test(file);
/** Where the page and on-demand groups stop: code with budgets of its own. */
const isOwnBudget = (file: string): boolean =>
  isScene3d(file) || isWorkModel(file) || isCommandMenu(file) || isInspectorViews(file);

/** Bytes, Brotli, per group. */
export const measureBundles = (
  dist: string,
): {
  page: number;
  onDemand: number;
  workModel: number;
  scene3d: number;
  commandMenu: number;
  inspectorViews: number;
} => {
  const assets = join(dist, '_astro');
  const read = (file: string): string => readFileSync(join(assets, file), 'utf8');
  const size = (file: string): number => brotliCompressSync(readFileSync(join(assets, file))).length;
  const scripts = readdirSync(assets).filter((f) => f.endsWith('.js'));
  const html = readdirSync(dist)
    .filter((f) => f.endsWith('.html'))
    .map((f) => readFileSync(join(dist, f), 'utf8'))
    .join('\n');

  // Static (`from"./x.js"`, `import"./x.js"`) and dynamic (`import("./x.js")`) imports between chunks.
  const importsOf = (file: string): string[] =>
    [...read(file).matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map((m) => m[1] ?? '');

  /** Every chunk reachable from `start`, minus `skip` and anything `stop` matches. */
  const closure = (
    start: string[],
    skip: Set<string>,
    stop: (file: string) => boolean = () => false,
  ): Set<string> => {
    const seen = new Set<string>();
    const queue = [...start];
    while (queue.length) {
      const file = queue.pop() ?? '';
      if (seen.has(file) || skip.has(file) || stop(file) || !scripts.includes(file)) continue;
      seen.add(file);
      queue.push(...importsOf(file));
    }
    return seen;
  };
  const sum = (files: Iterable<string>): number => [...files].reduce((total, f) => total + size(f), 0);

  const page = new Set(scripts.filter((f) => html.includes(`/_astro/${f}`)));
  const onDemand = closure([...page].flatMap(importsOf), page, isOwnBudget);
  // A chunk shared with an earlier group (Vite's helpers, the capability check) counts there once.
  const workModel = closure(scripts.filter(isWorkModel), new Set([...page, ...onDemand]), isScene3d);
  const scene3d = closure(scripts.filter(isScene3d), new Set([...page, ...onDemand, ...workModel]));
  const commandMenu = closure(scripts.filter(isCommandMenu), new Set([...page, ...onDemand]), isScene3d);
  const inspectorViews = closure(
    scripts.filter(isInspectorViews),
    new Set([...page, ...onDemand]),
    isScene3d,
  );
  return {
    page: sum(page),
    onDemand: sum(onDemand),
    workModel: sum(workModel),
    scene3d: sum(scene3d),
    commandMenu: sum(commandMenu),
    inspectorViews: sum(inspectorViews),
  };
};

/**
 * Everything one page runs on load: the external scripts it references plus the scripts Astro
 * inlined into it (small ones with no imports), each Brotli-compressed. This is what the home
 * page's "JavaScript on first load" figure reports.
 */
export const measurePage = (dist: string, page: string): number => {
  const html = readFileSync(join(dist, page), 'utf8');
  const external = [...html.matchAll(/<script[^>]*\ssrc="\/_astro\/([^"]+\.js)"/g)].map((m) =>
    readFileSync(join(dist, '_astro', m[1] ?? '')),
  );
  const inline = [
    ...html.matchAll(
      /<script(?![^>]*\ssrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ]
    .map((m) => m[1] ?? '')
    .filter((code) => code.trim());
  return [...external, ...inline].reduce((sum, code) => sum + brotliCompressSync(code).length, 0);
};

/**
 * The Inspector's manifest as Vite emits it (/_astro/inspector.<hash>.json), Brotli. Zero when the
 * build has none.
 */
export const measureInspectorData = (dist: string): number => {
  const assets = join(dist, '_astro');
  return readdirSync(assets)
    .filter((f) => /^inspector\.[\w-]+\.json$/.test(f))
    .reduce((sum, f) => sum + brotliCompressSync(readFileSync(join(assets, f))).length, 0);
};

/**
 * The Inspector's styles as Vite emits them (/_astro/inspector.<hash>.css), Brotli: fetched when
 * the panel opens, like its manifest. Zero when the build has none.
 */
export const measureInspectorStyles = (dist: string): number => {
  const assets = join(dist, '_astro');
  return readdirSync(assets)
    .filter((f) => /^inspector\.[\w-]+\.css$/.test(f))
    .reduce((sum, f) => sum + brotliCompressSync(readFileSync(join(assets, f))).length, 0);
};

/**
 * The command menu's index (/commands.json, /es/commands.json…: scripts/build-command-index.ts),
 * Brotli: fetched the first time the menu opens. A page loads only its language's, so the budget
 * holds the largest.
 */
export const measureCommandData = (dist: string): number =>
  Math.max(
    ...LANGS.map((lang) => brotliCompressSync(readFileSync(join(dist, commandIndexPath(lang)))).length),
  );

/**
 * The 3D scenes' data files as Vite emits them (/_astro/*.<hash>.bin, such as the Irazú's height
 * grid), Brotli. They download with the scene, on the home page only.
 */
export const measureSceneData = (dist: string): number => {
  const assets = join(dist, '_astro');
  return readdirSync(assets)
    .filter((f) => f.endsWith('.bin'))
    .reduce((sum, f) => sum + brotliCompressSync(readFileSync(join(assets, f))).length, 0);
};

/**
 * Pablo's 2022 solver (public/wasm/solver-2022, M7), Brotli: each build is a module and its
 * generated glue, and a reader downloads one of them per run, so the budget holds the larger.
 */
export const measureSolver2022 = (dist: string): number => {
  const dir = join(dist, 'wasm', 'solver-2022');
  const build = (name: string) =>
    [`${name}.mjs`, `${name}.wasm`].reduce(
      (sum, f) => sum + brotliCompressSync(readFileSync(join(dir, f))).length,
      0,
    );
  return Math.max(build('serial'), build('pthreads'));
};

/**
 * Everything one Precrease post can run: the scripts its page references, what they import, and
 * the Web Workers they start, with the workers' own imports. Workers count because a reader who
 * presses Run downloads them. Pages missing from `dist` (drafts in a production build) are
 * skipped, so a production build measures only the posts that are out.
 */
export const measurePosts = (dist: string, paths: string[]): { path: string; bytes: number }[] => {
  const assets = join(dist, '_astro');
  const read = (file: string): string => readFileSync(join(assets, file), 'utf8');
  const size = (file: string): number => brotliCompressSync(readFileSync(join(assets, file))).length;
  const scripts = new Set(readdirSync(assets).filter((f) => f.endsWith('.js')));
  const linksOf = (file: string): string[] => [
    ...[...read(file).matchAll(/(?:from|import)\s*\(?\s*["'`]\.\/([^"'`]+\.js)["'`]/g)].map(
      (m) => m[1] ?? '',
    ),
    ...[...read(file).matchAll(/new URL\(\s*["'`]\/_astro\/([^"'`]+\.js)["'`]/g)].map((m) => m[1] ?? ''),
  ];
  return paths.flatMap((path) => {
    let html: string;
    try {
      html = readFileSync(join(dist, `${path}.html`), 'utf8');
    } catch {
      return [];
    }
    const seen = new Set<string>();
    const queue = [...html.matchAll(/\/_astro\/([^"'\s]+\.js)/g)].map((m) => m[1] ?? '');
    while (queue.length) {
      const file = queue.pop() ?? '';
      // The 3D scenes and the Work animator load only on the home page, never on a post.
      if (seen.has(file) || !scripts.has(file) || isOwnBudget(file)) continue;
      seen.add(file);
      queue.push(...linksOf(file));
    }
    return [{ path, bytes: [...seen].reduce((sum, f) => sum + size(f), 0) }];
  });
};
