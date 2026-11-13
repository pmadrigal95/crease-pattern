/**
 * Reader counts for Precrease posts (M3a.3, decision 37): views, reads to the end, and "this
 * helped". Public from day one, counted per post and nothing else: no cookies, no IDs, no IPs
 * stored. The IP is used only by the rate limiter, in memory, for a minute, so one visitor can't
 * inflate a post's numbers.
 *
 * This module is the whole API, written against two small interfaces (a store and a limiter) so
 * unit tests can run it without Cloudflare. worker/index.ts wires it to D1 and the rate-limiting
 * binding.
 *
 *   GET  /api/stats/<slug>          → { views, reads, helped }, cached for a minute
 *   POST /api/stats/<slug>/<event>  → 204; event is view, read or helped
 */

export const EVENTS = ['view', 'read', 'helped'] as const;
export type ReaderEvent = (typeof EVENTS)[number];

export interface Counts {
  views: number;
  reads: number;
  helped: number;
}

/** Where counts live. D1 in production, a Map in tests. */
export interface CountStore {
  get(slug: string): Promise<Counts>;
  add(slug: string, event: ReaderEvent): Promise<void>;
}

/** Answers whether a key may act now. Cloudflare's rate-limiting binding in production. */
export interface Limiter {
  allow(key: string): Promise<boolean>;
}

export interface Deps {
  store: CountStore;
  limiter: Limiter;
  /** Whether a post with this slug is published (its page exists). */
  postExists(slug: string): Promise<boolean>;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE = /^\/api\/stats\/([^/]+)(?:\/([^/]+))?$/;

/** Handles /api/stats/*; returns null for any other path, so the caller can serve assets. */
export async function handleStats(request: Request, deps: Deps): Promise<Response | null> {
  const url = new URL(request.url);
  const match = ROUTE.exec(url.pathname);
  if (!match) return null;
  const [, slug = '', event] = match;
  if (!SLUG.test(slug) || slug.length > 120) return json({ error: 'Unknown post.' }, 404);

  if (event === undefined) {
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return json({ error: 'Use GET.' }, 405, { Allow: 'GET, HEAD' });
    if (!(await deps.postExists(slug))) return json({ error: 'Unknown post.' }, 404);
    return json(await deps.store.get(slug), 200, { 'Cache-Control': 'public, max-age=60' });
  }

  if (!isEvent(event)) return json({ error: 'Unknown event.' }, 404);
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, { Allow: 'POST' });
  // Only this site's own pages count: browsers mark cross-site requests, and those are refused.
  const site = request.headers.get('Sec-Fetch-Site');
  const origin = request.headers.get('Origin');
  if ((site && site !== 'same-origin') || (origin && origin !== url.origin))
    return json({ error: 'Not allowed.' }, 403);
  if (!(await deps.postExists(slug))) return json({ error: 'Unknown post.' }, 404);

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await deps.limiter.allow(`${ip}:${slug}`))) return json({ error: 'Too many requests.' }, 429);
  await deps.store.add(slug, event);
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

const isEvent = (value: string): value is ReaderEvent => (EVENTS as readonly string[]).includes(value);

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

/** Column per event, so a request can never name a column itself. */
export const COLUMN: Record<ReaderEvent, keyof Counts> = { view: 'views', read: 'reads', helped: 'helped' };
