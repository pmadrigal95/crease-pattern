// Development server only (`astro dev`): sends the cross-origin isolation headers that
// public/_headers sends in production, read from that same file, so there is one source of truth.
// Isolated posts get COOP + COEP; everything else gets COEP alone, which only matters for the
// Workers those posts start (as in production's /_astro/* rule).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** The slice of Vite's dev server this plugin uses (Vite itself comes through Astro). */
interface DevServer {
  middlewares: {
    use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): void;
  };
}

/** The posts public/_headers isolates (COOP + COEP), as site paths. */
const isolatedPaths = (): string[] => {
  const lines = readFileSync(join(import.meta.dirname, '..', 'public', '_headers'), 'utf8').split('\n');
  const paths: string[] = [];
  lines.forEach((line, i) => {
    if (/^(\/[a-z]{2})?\/precrease\//.test(line) && /Cross-Origin-Opener-Policy/.test(lines[i + 1] ?? ''))
      paths.push(line.trim());
  });
  return paths;
};

export const devIsolation = () => {
  return {
    name: 'crease-pattern:dev-isolation',
    apply: 'serve' as const,
    configureServer(server: DevServer) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        if (isolatedPaths().includes(path)) res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        next();
      });
    },
  };
};
