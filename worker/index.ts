/**
 * The site's Worker. Everything is static (dist/) and served as assets; this code runs only for
 * /api/* (wrangler.jsonc, assets.run_worker_first). Today that is the reader counts of
 * Precrease posts (worker/stats.ts). No npm dependencies on purpose: the deploy job bundles this
 * file on its own, next to the Cloudflare token, without installing anything.
 */
import { COLUMN, handleStats, type CountStore, type Limiter } from './stats';

/** The parts of Cloudflare's bindings this Worker uses, typed here to avoid a types package. */
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
}
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
interface Fetcher {
  fetch(request: Request): Promise<Response>;
}
interface Env {
  ASSETS: Fetcher;
  READERS: D1Database;
  READER_LIMIT: RateLimit;
}

const d1Store = (db: D1Database): CountStore => ({
  async get(slug) {
    const row = await db
      .prepare('SELECT views, reads, helped FROM post_stats WHERE slug = ?')
      .bind(slug)
      .first<{ views: number; reads: number; helped: number }>();
    return row ?? { views: 0, reads: 0, helped: 0 };
  },
  async add(slug, event) {
    const column = COLUMN[event];
    await db
      .prepare(
        `INSERT INTO post_stats (slug, ${column}) VALUES (?, 1)
         ON CONFLICT (slug) DO UPDATE SET ${column} = ${column} + 1, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(slug)
      .run();
  },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const limiter: Limiter = { allow: async (key) => (await env.READER_LIMIT.limit({ key })).success };
    const postExists = async (slug: string) => {
      const page = await env.ASSETS.fetch(
        new Request(new URL(`/precrease/${slug}`, request.url), { method: 'HEAD' }),
      );
      return page.ok;
    };
    const response = await handleStats(request, { store: d1Store(env.READERS), limiter, postExists });
    return response ?? env.ASSETS.fetch(request);
  },
};
