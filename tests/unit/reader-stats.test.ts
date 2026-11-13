import { describe, expect, test } from 'vitest';
import { handleStats, type CountStore, type Counts, type Deps } from '../../worker/stats';

// The reader-count API (M3a.3, decision 37), run without Cloudflare: a Map as the store and a
// counter as the rate limiter.
function setup(limit = 100) {
  const rows = new Map<string, Counts>();
  const store: CountStore = {
    async get(slug) {
      return rows.get(slug) ?? { views: 0, reads: 0, helped: 0 };
    },
    async add(slug, event) {
      const row = rows.get(slug) ?? { views: 0, reads: 0, helped: 0 };
      row[({ view: 'views', read: 'reads', helped: 'helped' } as const)[event]] += 1;
      rows.set(slug, row);
    },
  };
  const seen = new Map<string, number>();
  const deps: Deps = {
    store,
    limiter: {
      async allow(key) {
        seen.set(key, (seen.get(key) ?? 0) + 1);
        return seen.get(key)! <= limit;
      },
    },
    postExists: async (slug) => slug === 'the-work-before-the-shape',
  };
  return { rows, seen, deps };
}

const site = 'https://example.dev';
const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${site}${path}`, {
    method: 'POST',
    headers: { 'Sec-Fetch-Site': 'same-origin', Origin: site, 'CF-Connecting-IP': '203.0.113.7', ...headers },
  });
const slug = 'the-work-before-the-shape';

describe('reader stats API', () => {
  test('counts a view, a read and a "this helped", and returns the totals', async () => {
    const { deps } = setup();
    for (const event of ['view', 'view', 'read', 'helped'])
      expect((await handleStats(post(`/api/stats/${slug}/${event}`), deps))!.status).toBe(204);
    const res = (await handleStats(new Request(`${site}/api/stats/${slug}`), deps))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(await res.json()).toEqual({ views: 2, reads: 1, helped: 1 });
  });

  test('a post nobody has read yet answers zeros', async () => {
    const { deps } = setup();
    const res = (await handleStats(new Request(`${site}/api/stats/${slug}`), deps))!;
    expect(await res.json()).toEqual({ views: 0, reads: 0, helped: 0 });
  });

  test('refuses unknown posts, unknown events and malformed slugs without storing anything', async () => {
    const { deps, rows } = setup();
    expect((await handleStats(post('/api/stats/not-a-post/view'), deps))!.status).toBe(404);
    expect((await handleStats(post(`/api/stats/${slug}/share`), deps))!.status).toBe(404);
    expect((await handleStats(post('/api/stats/..%2Fadmin/view'), deps))!.status).toBe(404);
    expect((await handleStats(post("/api/stats/x';DROP TABLE post_stats;--/view"), deps))!.status).toBe(404);
    expect(rows.size).toBe(0);
  });

  test('only this site can count: cross-site requests are refused', async () => {
    const { deps, rows } = setup();
    const cross = post(`/api/stats/${slug}/view`, {
      'Sec-Fetch-Site': 'cross-site',
      Origin: 'https://evil.example',
    });
    expect((await handleStats(cross, deps))!.status).toBe(403);
    const foreign = post(`/api/stats/${slug}/view`, { Origin: 'https://evil.example' });
    expect((await handleStats(foreign, deps))!.status).toBe(403);
    expect(rows.size).toBe(0);
  });

  test('the rate limiter keys on visitor and post, and stops a burst', async () => {
    const { deps, seen } = setup(2);
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await handleStats(post(`/api/stats/${slug}/view`), deps))!.status);
    expect(statuses).toEqual([204, 204, 429]);
    expect([...seen.keys()]).toEqual([`203.0.113.7:${slug}`]);
  });

  test('wrong methods get 405, and other paths are left to the assets', async () => {
    const { deps } = setup();
    expect((await handleStats(new Request(`${site}/api/stats/${slug}/view`), deps))!.status).toBe(405);
    expect((await handleStats(post(`/api/stats/${slug}`), deps))!.status).toBe(405);
    expect(await handleStats(new Request(`${site}/precrease/${slug}`), deps)).toBeNull();
  });
});
