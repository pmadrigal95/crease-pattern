// Writes the measured figures into the built home page, in every language. "This site, measured" shows values the
// page can't know until the build is done (the JavaScript it ships), so the page renders a
// placeholder element per figure and this script fills it in dist after `astro build`.
// It fails the build if a placeholder is missing or left unfilled: a dash must never ship.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measurePage, toKb } from './bundle-sizes.ts';
import { DEFAULT_LANG, LANGS } from '../src/i18n/config.ts';

const dist = join(import.meta.dirname, '..', 'dist');
// Measured on the English home page: external scripts plus the ones Astro inlined. Every language's
// home ships the same scripts, so they all show this figure.
const values = { 'first-load-js': toKb(measurePage(dist, 'index.html')).toFixed(1) };
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
  writeFileSync(file, html);
}
console.log(
  `metrics (${homes.join(', ')}): ${Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')}`,
);
