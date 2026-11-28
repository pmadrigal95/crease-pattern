/**
 * What the colophon says about the build, counted from the repository while the site builds
 * (doc 40): the back of each sheet and the title block read these, so no number on the page is
 * typed by hand. Node only: imported from Astro frontmatter, never shipped to a browser.
 *
 * Two figures exist only after the build and are stamped into the page then
 * (scripts/stamp-site-metrics.ts): the HTML pages and the home page's JavaScript. Lighthouse runs
 * after the build too; its last recorded measurement is src/data/lighthouse.json.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { auditedPages, themes } from '../config/quality';
import { allVisualDirections } from '../config/visual-direction';
import { IRAZU_DEM } from './identity-scenes';
import { MODEL_IDS } from './origami/models';

const at = (...parts: string[]) => join(process.cwd(), ...parts);
const kb = (...parts: string[]) => statSync(at(...parts)).size / 1024;
const files = (dir: string, ending: string) =>
  readdirSync(at(dir), { recursive: true }).filter((f) => String(f).endsWith(ending)).length;

/** DTCG tokens ({ $value }) in a group, at any depth. */
const tokens = (group: unknown): number =>
  group && typeof group === 'object'
    ? '$value' in group
      ? 1
      : Object.entries(group)
          .filter(([k]) => !k.startsWith('$'))
          .reduce((n, [, v]) => n + tokens(v), 0)
    : 0;
const json = (...parts: string[]): unknown => JSON.parse(readFileSync(at(...parts), 'utf8'));

export interface BuildFacts {
  version: string;
  components: number;
  modules: number;
  unitTests: number;
  e2eSpecs: number;
  tokensKb: number;
  baseTokens: number;
  colorTokens: number;
  identities: number;
  themes: number;
  surfacesKb: Record<string, number>;
  demKb: number;
  demSize: number;
  figures: number;
  portraitKb: { photo: number; contours: number; silhouette: number };
  axeRuns: [pages: number, identities: number, themes: number];
  lighthouse: [pages: number, runs: number];
}

export const buildFacts = (): BuildFacts => {
  const lhci = json('lighthouserc.json') as { ci: { collect: { url: string[]; numberOfRuns: number } } };
  const contour = json('tokens', 'directions', 'contour-lines.json') as { light: unknown };
  return {
    version: (json('package.json') as { version: string }).version,
    components: files('src/components', '.astro'),
    modules: files('src', '.ts'),
    unitTests: files('tests/unit', '.test.ts'),
    e2eSpecs: files('tests/e2e', '.spec.ts') + files('tests/essay', '.spec.ts'),
    tokensKb: kb('src/styles/tokens.css'),
    baseTokens: tokens(json('tokens', 'base.json')),
    colorTokens: tokens(contour.light),
    identities: allVisualDirections.length,
    themes: themes.length,
    surfacesKb: Object.fromEntries(
      ['contours', 'basalt', 'washi'].map((name) => [name, kb('public', 'textures', `${name}.svg`)]),
    ),
    demKb: kb('src', 'assets', 'scenes', 'irazu-dem.bin'),
    demSize: IRAZU_DEM.size,
    figures: MODEL_IDS.length,
    portraitKb: {
      photo: kb('src', 'assets', 'portrait', 'portrait.jpg'),
      contours: kb('src', 'assets', 'portrait', 'contours.svg'),
      silhouette: kb('src', 'assets', 'portrait', 'silhouette.webp'),
    },
    axeRuns: [auditedPages.length, allVisualDirections.length, themes.length],
    lighthouse: [lhci.ci.collect.url.length, lhci.ci.collect.numberOfRuns],
  };
};
