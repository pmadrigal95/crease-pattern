// Writes the measured figures into the built home page. "This site, measured" shows values the
// page can't know until the build is done (the JavaScript it ships), so the page renders a
// placeholder element per figure and this script fills it in dist after `astro build`.
// It fails the build if a placeholder is missing or left unfilled: a dash must never ship.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { measurePage, toKb } from './bundle-sizes.mjs';

const dist = join(import.meta.dirname, '..', 'dist');
const file = join(dist, 'index.html');
// Measured on the home page itself: external scripts plus the ones Astro inlined.
const values = { 'first-load-js': toKb(measurePage(dist, 'index.html')).toFixed(1) };

let html = readFileSync(file, 'utf8');
for (const [name, value] of Object.entries(values)) {
  const pattern = new RegExp(`(<[^>]+data-metric="${name}"[^>]*>)[^<]*(<)`);
  if (!pattern.test(html)) throw new Error(`index.html has no data-metric="${name}" to fill`);
  html = html.replace(pattern, `$1${value}$2`);
}
writeFileSync(file, html);
console.log(
  `metrics: ${Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ')}`,
);
