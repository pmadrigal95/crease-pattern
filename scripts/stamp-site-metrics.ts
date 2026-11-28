// Writes the measured figures into the built home page, in every language. "This site, measured" shows values the
// page can't know until the build is done (the JavaScript it ships), so the page renders a
// placeholder element per figure and this script fills it in dist after `astro build`.
// It fails the build if a placeholder is missing or left unfilled: a dash must never ship.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measurePage, toKb } from './bundle-sizes.ts';
import { DEFAULT_LANG, LANGS } from '../src/i18n/config.ts';
import { jsBudgetKb } from '../src/config/quality.ts';

const dist = join(import.meta.dirname, '..', 'dist');
// Measured on the English home page: external scripts plus the ones Astro inlined. Every language's
// home ships the same scripts, so they all show this figure.
const firstLoad = toKb(measurePage(dist, 'index.html'));
const values = {
  'first-load-js': firstLoad.toFixed(1),
  // What's left of the page budget, the margin under the drawing (src/components/site/WorkReadout.astro).
  'js-spare': (jsBudgetKb.page - firstLoad).toFixed(1),
};
// The drawing's used part: as wide as the figure is a share of the budget, of the sheet's width.
const bars = { 'first-load-js': firstLoad / jsBudgetKb.page };
/** The home page in each language: index.html, and <lang>.html for the others (src/i18n/config.ts). */
const homes = LANGS.map((lang) => (lang === DEFAULT_LANG ? 'index.html' : `${lang}.html`));

for (const home of homes) {
  const file = join(dist, home);
  let html = readFileSync(file, 'utf8');
  for (const [name, value] of Object.entries(values)) {
    const pattern = new RegExp(`(<[^>]+data-metric="${name}"[^>]*>)[^<]*(<)`);
    if (!pattern.test(html)) throw new Error(`${home} has no data-metric="${name}" to fill`);
    html = html.replace(pattern, `$1${value}$2`);
  }
  for (const [name, share] of Object.entries(bars)) {
    const bar = new RegExp(`<rect[^>]*data-metric-bar="${name}"[^>]*>`);
    const tag = html.match(bar)?.[0];
    const sheet =
      tag &&
      html
        .slice(0, html.indexOf(tag))
        .match(/<svg[^>]*viewBox="0 0 (\d+(?:\.\d+)?) /g)
        ?.at(-1);
    const width = sheet ? Number(sheet.match(/viewBox="0 0 ([\d.]+) /)![1]) : NaN;
    if (!tag || !Number.isFinite(width)) throw new Error(`${home} has no data-metric-bar="${name}" to fill`);
    html = html.replace(
      tag,
      tag.replace(/width="[^"]*"/, `width="${(Math.min(1, share) * width).toFixed(1)}"`),
    );
  }
  writeFileSync(file, html);
}
// The colophon's title block and its first sheet's back (doc 40): the pages this build wrote and
// the home page's JavaScript, in every language.
const pages = readdirSync(dist, { recursive: true })
  .map(String)
  .filter(
    (f) => f.endsWith('.html') && !/(^|[\\/])404\.html$/.test(f) && !/^(_astro|pagefind)[\\/]/.test(f),
  ).length;
const colophonValues = { 'html-pages': String(pages), 'first-load-js': values['first-load-js'] };
for (const lang of LANGS) {
  const page = lang === DEFAULT_LANG ? 'colophon.html' : join(lang, 'colophon.html');
  const file = join(dist, page);
  let html = readFileSync(file, 'utf8');
  for (const [name, value] of Object.entries(colophonValues)) {
    const pattern = new RegExp(`(<[^>]+data-metric="${name}"[^>]*>)[^<]*(<)`, 'g');
    if (!pattern.test(html)) throw new Error(`${page} has no data-metric="${name}" to fill`);
    html = html.replace(pattern, `$1${value}$2`);
  }
  writeFileSync(file, html);
}

console.log(
  `metrics (${homes.join(', ')}, colophon: ${pages} pages): ${Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')}`,
);
