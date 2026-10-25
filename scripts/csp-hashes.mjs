// Hashes for inline scripts Astro doesn't hash itself (is:inline). The hash is computed
// from the same file the layout inlines, so the two can never drift apart.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Inline script that restores the visitor's identity and theme before first paint. */
export const restoreIdentityScript = readFileSync(
  new URL('../src/scripts/restore-identity.js', import.meta.url),
  'utf8',
).trim();

export const sha256 = (source) => `sha256-${createHash('sha256').update(source).digest('base64')}`;
