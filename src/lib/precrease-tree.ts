/**
 * Pure helpers for Precrease's topic tree and post list: no Astro imports, so unit tests can
 * run them directly. src/lib/precrease.ts feeds them the real content.
 */
import type { Topic } from '../config/precrease';

/** Throws when a parent is unknown, a topic id repeats, or the parents form a cycle. */
export function validateTree(topics: readonly Topic[]): void {
  const ids = new Set<string>();
  for (const t of topics) {
    if (ids.has(t.id)) throw new Error(`Precrease topic "${t.id}" is defined twice`);
    ids.add(t.id);
  }
  for (const t of topics) {
    if (t.parent && !ids.has(t.parent)) throw new Error(`Topic "${t.id}" has unknown parent "${t.parent}"`);
    const seen = new Set<string>([t.id]);
    for (let p = t.parent; p; p = topics.find((x) => x.id === p)?.parent) {
      if (seen.has(p)) throw new Error(`Topic "${t.id}" is part of a parent cycle`);
      seen.add(p);
    }
  }
}

/** Root first: the breadcrumb from the top of the tree down to `id`, inclusive. */
export function pathTo(topics: readonly Topic[], id: string): Topic[] {
  const path: Topic[] = [];
  for (let t = topics.find((x) => x.id === id); t; t = topics.find((x) => x.id === t?.parent)) {
    path.unshift(t);
  }
  return path;
}

export const childrenOf = (topics: readonly Topic[], id: string | undefined) =>
  topics.filter((t) => t.parent === id);

/** `id` and every topic below it, at any depth. */
export function subtree(topics: readonly Topic[], id: string): Set<string> {
  const out = new Set([id]);
  for (const child of childrenOf(topics, id)) subtree(topics, child.id).forEach((x) => out.add(x));
  return out;
}

export interface PostLike {
  id: string;
  number: number;
  topics: readonly string[];
  date: Date;
}

/** Posts on `id` or anywhere below it, newest first. */
export function postsUnder<P extends PostLike>(
  topics: readonly Topic[],
  posts: readonly P[],
  id: string,
): P[] {
  const ids = subtree(topics, id);
  return posts.filter((p) => p.topics.some((t) => ids.has(t)));
}

/**
 * Up to `count` other posts, ranked by shared topics. Sharing an ancestor counts too, at half
 * weight, so a post on Accessibility still finds one on Performance (both under Frontend).
 */
export function related<P extends PostLike>(
  topics: readonly Topic[],
  posts: readonly P[],
  post: P,
  count = 3,
): P[] {
  const family = (ids: readonly string[]) =>
    new Set(ids.flatMap((id) => pathTo(topics, id).map((t) => t.id)));
  const mine = new Set(post.topics);
  const myFamily = family(post.topics);
  return posts
    .filter((p) => p.id !== post.id)
    .map((p) => {
      const exact = p.topics.filter((t) => mine.has(t)).length;
      const near = [...family(p.topics)].filter((t) => myFamily.has(t)).length;
      return { p, score: exact * 2 + near };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.date.getTime() - a.p.date.getTime())
    .slice(0, count)
    .map((x) => x.p);
}

/** Crease numbers must run 1, 2, 3… with no gaps or repeats, in publication order. */
export function checkNumbers(posts: readonly PostLike[]): void {
  const sorted = [...posts].sort((a, b) => a.number - b.number);
  sorted.forEach((p, i) => {
    if (p.number !== i + 1)
      throw new Error(`Crease numbers must run 1…${posts.length} without gaps: "${p.id}" has ${p.number}`);
  });
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.date < sorted[i - 1]!.date)
      throw new Error(`Crease No. ${sorted[i]!.number} is dated before No. ${sorted[i - 1]!.number}`);
  }
}
