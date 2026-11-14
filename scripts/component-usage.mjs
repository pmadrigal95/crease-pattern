// Builds src/generated/components.json: every component of the site, and where and how often it is
// used. Crease No. 003 (the component essay) cites these numbers, so they come from the source on
// every build and can't drift from the code. Build-time data only: nothing ships to the browser.
//
// A use is one tag (`<PostCard`) in a file that imports the component. A file that imports a
// component without rendering it as a tag (the Inspector mounts its Vue panel from a script) counts
// as one use, so nothing in use reads as unused. A component handed to post content
// (`<Content components={{ MarginNote }} />`) is used wherever a post writes its tag, so each MDX
// file that does counts as a file that uses it. A component rendering itself (`Astro.self`) adds
// nothing: recursion is how it's built, not another place it's used.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = 'src/components';
/** Where components can be used: pages, layouts, other components and post content (MDX). */
const SOURCES = ['src/pages', 'src/layouts', 'src/components', 'src/content'];
const COMPONENT_FILE = /\.(astro|vue)$/;
const SOURCE_FILE = /\.(astro|vue|mdx|ts)$/;
/** A default import, optionally followed by named ones: `import TopicBranch, { type Branch } from`. */
const IMPORT = /import\s+(\w+)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]([^'"]+\.(?:astro|vue))['"]/g;
/** Components handed to post content: `components={{ MarginNote, Figure }}`. */
const CONTENT_MAP = /components=\{\{([^}]*)\}\}/g;

const list = (root, dir, match) =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) return list(root, path, match);
    return match.test(entry.name) ? [path] : [];
  });

const tagsOf = (name, source) => [...source.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))].length;

/**
 * The string-literal props a file passes to a component (`unfold="load"` → { unfold: ['load'] }),
 * merged over its tags. Expressions (`text={data.title}`) are skipped: their value isn't known
 * until the page renders. Reads up to the tag's first `>`, enough for the props this site writes.
 */
function literalProps(name, source) {
  /** @type {Record<string, Set<string>>} */
  const props = {};
  for (const [, attrs] of source.matchAll(new RegExp(`<${name}(?=[\\s/>])([^>]*)>`, 'g')))
    for (const [, key, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) (props[key] ??= new Set()).add(value);
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, [...v].sort()]));
}

/**
 * @param {{ path: string, source: string }[]} files repository-relative paths, forward slashes
 * @param {string[]} components repository-relative paths of the component files
 */
export function componentUsage(files, components) {
  /** @type {Map<string, Map<string, { count: number, props: Record<string, string[]> }>>} component → file → use */
  const uses = new Map(components.map((c) => [c, new Map()]));
  const add = (target, file, count, props = {}) => {
    const prev = uses.get(target).get(file);
    uses.get(target).set(file, { count: (prev?.count ?? 0) + count, props: { ...prev?.props, ...props } });
  };
  const posts = files.filter((f) => f.path.endsWith('.mdx'));

  for (const { path, source } of files) {
    const handedToContent = new Set(
      [...source.matchAll(CONTENT_MAP)].flatMap((m) => m[1].split(',').map((n) => n.trim())),
    );
    for (const [, name, spec] of source.matchAll(IMPORT)) {
      if (!spec.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), spec));
      if (!uses.has(target) || target === path) continue;
      if (handedToContent.has(name)) {
        for (const post of posts) {
          const count = tagsOf(name, post.source);
          if (count) add(target, post.path, count, literalProps(name, post.source));
        }
      } else {
        add(target, path, Math.max(tagsOf(name, source), 1), literalProps(name, source));
      }
    }
  }

  const entries = components
    .map((path) => {
      const usedIn = [...uses.get(path)]
        .map(([file, { count, props }]) => ({ file, count, ...(Object.keys(props).length ? { props } : {}) }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
      return {
        name: posix.basename(path).replace(COMPONENT_FILE, ''),
        path,
        group: posix.dirname(path).slice(COMPONENTS.length + 1),
        uses: usedIn.reduce((sum, u) => sum + u.count, 0),
        usedIn,
      };
    })
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));

  return {
    components: entries,
    totals: {
      components: entries.length,
      uses: entries.reduce((sum, c) => sum + c.uses, 0),
      /** Used in two or more files: shared, not written for one place. */
      reused: entries.filter((c) => c.usedIn.length >= 2).length,
      unused: entries.filter((c) => c.uses === 0).map((c) => c.path),
    },
  };
}

export function buildComponentUsage(root) {
  const components = list(root, COMPONENTS, COMPONENT_FILE);
  const files = SOURCES.flatMap((dir) => list(root, dir, SOURCE_FILE)).map((path) => ({
    path,
    source: readFileSync(join(root, path), 'utf8'),
  }));
  return componentUsage(files, components);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const usage = buildComponentUsage(root);
  mkdirSync(join(root, 'src/generated'), { recursive: true });
  writeFileSync(join(root, 'src/generated/components.json'), JSON.stringify(usage, null, 2) + '\n');
  const { components, uses, reused } = usage.totals;
  console.log(`components: ${components} components, ${uses} uses, ${reused} used in 2+ files`);
}
