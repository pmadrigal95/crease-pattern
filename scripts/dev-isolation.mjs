// Development server only (`astro dev`): sends the cross-origin isolation headers that
// public/_headers sends in production, read from that same file, so there is one source of truth.
// Isolated posts get COOP + COEP; everything else gets COEP alone, which only matters for the
// Workers those posts start (as in production's /_astro/* rule).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The posts public/_headers isolates (COOP + COEP), as site paths. */
function isolatedPaths() {
  const lines = readFileSync(join(import.meta.dirname, '..', 'public', '_headers'), 'utf8').split('\n');
  const paths = [];
  lines.forEach((line, i) => {
    if (line.startsWith('/precrease/') && /Cross-Origin-Opener-Policy/.test(lines[i + 1] ?? ''))
      paths.push(line.trim());
  });
  return paths;
}

export function devIsolation() {
  return {
    name: 'crease-pattern:dev-isolation',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        if (isolatedPaths().includes(path)) res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        next();
      });
    },
  };
}
