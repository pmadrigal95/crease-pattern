// Hashes for inline scripts Astro doesn't hash itself (is:inline). The hash is computed from the
// same output the layout inlines (./inline-script.ts), so the two can never drift apart.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { toInlineScript } from './inline-script.ts';

/** Inline script that restores the visitor's identity and theme before first paint. */
export const restoreIdentityScript = toInlineScript(
  readFileSync(new URL('../src/scripts/restore-identity.ts', import.meta.url), 'utf8'),
);

/** Inline script that starts the page-to-page fold or the first-load entrance (decision 42). */
export const pageRevealScript = toInlineScript(
  readFileSync(new URL('../src/scripts/page-reveal.ts', import.meta.url), 'utf8'),
);

export const sha256 = (source: string): `sha256-${string}` =>
  `sha256-${createHash('sha256').update(source).digest('base64')}`;
