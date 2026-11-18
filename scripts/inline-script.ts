// The two scripts the layout inlines before first paint (src/scripts/restore-identity.ts and
// page-reveal.ts) are written in TypeScript and inlined as the JavaScript Node's own type stripping
// leaves: the same erasure that runs every script in scripts/, with no build tool between the
// source and the bytes. The layout inlines this output and scripts/csp-hashes.ts hashes this
// output, so the two can never drift apart.
//
// No file system here: the layout imports this at build time from inside Astro's bundle.
import { stripTypeScriptTypes } from 'node:module';

/** TypeScript source → the JavaScript to inline (types erased, nothing else changed). */
export const toInlineScript = (source: string): string => stripTypeScriptTypes(source).trim();
