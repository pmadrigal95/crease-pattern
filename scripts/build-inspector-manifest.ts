// Builds src/generated/inspector.json: what the Inspector shows about each inspectable part of the
// page. Everything is derived from the source and its git history at build time, so the overlay can
// never drift from the code (concept rule: inspector metadata is never written by hand).
//
// A part is any element carrying data-inspect="<id>". The id is checked against the file it lives
// in: a component uses its file name (FoldedPortrait), a page section uses "<page>#<section>"
// (index#hero). A mismatch or a duplicate fails the build.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'https://github.com/pmadrigal95/crease-pattern';
const SOURCES = ['src/components', 'src/pages'];

/** src/generated/tokens.json, as scripts/build-tokens.ts writes it. */
interface TokenManifest {
  base: Record<string, string>;
  directions: Record<string, { light: Record<string, string>; dark: Record<string, string> }>;
}
const readTokens = (root: string): TokenManifest =>
  JSON.parse(readFileSync(join(root, 'src/generated/tokens.json'), 'utf8')) as TokenManifest;
/** The first identity's colors: every identity defines the same names (build-tokens checks). */
const firstColors = (manifest: TokenManifest): Record<string, string> =>
  Object.values(manifest.directions)[0]?.light ?? {};

const listAstro = (root: string, dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listAstro(root, path);
    return entry.name.endsWith('.astro') ? [path] : [];
  });

const git = (root: string, args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

/** Token names the site defines (src/generated/tokens.json, built just before this script). */
function knownTokens(root: string): Set<string> {
  const manifest = readTokens(root);
  const colors = Object.keys(firstColors(manifest)).map((k) => `color-${k}`);
  return new Set([...Object.keys(manifest.base), ...colors]);
}

/**
 * Five colors per identity and theme for the Identity switcher's swatches, plus how many color
 * tokens every identity shares (the point of the switcher: same system, different values).
 */
function identities(root: string) {
  const manifest = readTokens(root);
  const { directions } = manifest;
  const SWATCH = ['bg', 'ink', 'accent', 'accent-ui', 'second'];
  const pick = (palette: Record<string, string>) => SWATCH.map((k) => palette[k] ?? '');
  return {
    tokenCount: Object.keys(firstColors(manifest)).length,
    swatches: Object.fromEntries(
      Object.entries(directions).map(([id, d]) => [id, { light: pick(d.light), dark: pick(d.dark) }]),
    ),
  };
}

export function buildManifest(root: string) {
  const tokens = knownTokens(root);
  const files: Record<
    string,
    { tokens: string[]; lastChange: { commit: string; date: string; subject: string } | null }
  > = {};
  const parts: Record<string, string> = {};

  for (const file of SOURCES.flatMap((dir) => listAstro(root, dir))) {
    const source = readFileSync(join(root, file), 'utf8');
    const ids = [...source.matchAll(/data-inspect="([^"]+)"/g)].map((m) => m[1] ?? '');
    if (ids.length === 0) continue;

    const path = relative(root, join(root, file)).replaceAll('\\', '/');
    const name = basename(file, '.astro');
    const isPage = path.startsWith('src/pages/');
    const used = [...new Set([...source.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1] ?? ''))]
      .filter((t) => tokens.has(t))
      .sort();
    const [commit = '', date = '', ...subject] = git(root, [
      'log',
      '-1',
      '--format=%h%x1f%cs%x1f%s',
      '--',
      path,
    ]).split('\x1f');

    files[path] = {
      tokens: used,
      lastChange: commit ? { commit, date, subject: subject.join('\x1f') } : null,
    };
    for (const id of ids) {
      const expected = isPage ? id.startsWith(`${name}#`) : id === name;
      if (!expected)
        throw new Error(
          `${path}: data-inspect="${id}" must be ${isPage ? `"${name}#<section>"` : `"${name}"`}`,
        );
      if (parts[id]) throw new Error(`data-inspect="${id}" is used twice (${parts[id]} and ${path})`);
      parts[id] = path;
    }
  }

  // Facts live once per file; parts point at their file. Keeps the payload small (it ships with the panel).
  return {
    repository: REPOSITORY,
    commit: git(root, ['rev-parse', 'HEAD']),
    files,
    parts,
    identities: identities(root),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildManifest(root);
  mkdirSync(join(root, 'src/generated'), { recursive: true });
  writeFileSync(join(root, 'src/generated/inspector.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`inspector: ${Object.keys(manifest.parts).length} inspectable parts`);
}
