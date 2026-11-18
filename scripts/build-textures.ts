// Generates the identity surfaces in public/textures/: seamless SVG tiles the home hero uses as a
// CSS mask, one per visual identity (design debt fix 4). Each generator is seeded, so the same
// code writes the same files; run `node scripts/build-textures.ts` after changing one and commit
// the result.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { basaltTile } from './textures/basalt.ts';
import { contourTile } from './textures/contours.ts';
import { washiTile } from './textures/washi.ts';

const out = join(import.meta.dirname, '..', 'public', 'textures');
mkdirSync(out, { recursive: true });

const tiles: [file: string, build: () => { svg: string; note: string }][] = [
  ['contours.svg', contourTile],
  ['basalt.svg', basaltTile],
  ['washi.svg', washiTile],
];
for (const [file, build] of tiles) {
  const { svg, note } = build();
  writeFileSync(join(out, file), svg);
  console.log(`texture: ${file}, ${note}, ${(svg.length / 1024).toFixed(1)} KB`);
}
