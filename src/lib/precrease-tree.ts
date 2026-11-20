/**
 * Pure helpers for Precrease's topic tree and post list: no Astro imports, so unit tests can
 * run them directly. src/lib/precrease.ts feeds them the real content.
 */
import type { TopicNode } from '../config/precrease';

/** Throws when a parent is unknown, a topic id repeats, or the parents form a cycle. */
export const validateTree = (topics: readonly TopicNode[]): void => {
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
};

/** Root first: the breadcrumb from the top of the tree down to `id`, inclusive. */
export const pathTo = <T extends TopicNode>(topics: readonly T[], id: string): T[] => {
  const path: T[] = [];
  for (let t = topics.find((x) => x.id === id); t; t = topics.find((x) => x.id === t?.parent)) {
    path.unshift(t);
  }
  return path;
};

export const childrenOf = <T extends TopicNode>(topics: readonly T[], id: string | undefined) =>
  topics.filter((t) => t.parent === id);

/** `id` and every topic below it, at any depth. */
export const subtree = (topics: readonly TopicNode[], id: string): Set<string> => {
  const out = new Set([id]);
  for (const child of childrenOf(topics, id)) subtree(topics, child.id).forEach((x) => out.add(x));
  return out;
};

export interface PostLike {
  id: string;
  number: number;
  topics: readonly string[];
  date: Date;
}

/** Posts on `id` or anywhere below it, newest first. */
export const postsUnder = <P extends PostLike>(
  topics: readonly TopicNode[],
  posts: readonly P[],
  id: string,
): P[] => {
  const ids = subtree(topics, id);
  return posts.filter((p) => p.topics.some((t) => ids.has(t)));
};

/**
 * Up to `count` other posts, ranked by shared topics. Sharing an ancestor counts too, at half
 * weight, so a post on Accessibility still finds one on Performance (both under Frontend).
 */
export const related = <P extends PostLike>(
  topics: readonly TopicNode[],
  posts: readonly P[],
  post: P,
  count = 3,
): P[] => {
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
};

/**
 * Whether a post is out: not a draft, and its date has arrived. A post dated in the future is
 * scheduled; the daily production build (deploy.yml, 12:00 UTC) publishes it on its day. Dates
 * without a time are midnight UTC, so a post dated today is live in that day's build.
 */
export const isLive = (post: { draft: boolean; date: Date }, now: Date): boolean =>
  !post.draft && post.date.getTime() <= now.getTime();

/** Crease numbers must run 1, 2, 3… with no gaps or repeats, in publication order. */
export const checkNumbers = (posts: readonly PostLike[]): void => {
  const sorted = posts.toSorted((a, b) => a.number - b.number);
  sorted.forEach((p, i) => {
    if (p.number !== i + 1)
      throw new Error(`Crease numbers must run 1…${posts.length} without gaps: "${p.id}" has ${p.number}`);
  });
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.date < sorted[i - 1]!.date)
      throw new Error(`Crease No. ${sorted[i]!.number} is dated before No. ${sorted[i - 1]!.number}`);
  }
};

/** One file of a post in one language, as checkEditions reads it. */
export interface EditionLike {
  /** The edition's own slug. */
  id: string;
  number: number;
  lang: string;
  /** The folder its file sits in under src/content/precrease: '' for the default language. */
  folder: string;
  /** The original's slug, for an edition in another language. */
  translationOf?: string | undefined;
}

/**
 * Posts in other languages (M5.4): the original is written in the default language at the root of
 * src/content/precrease; each other language's edition sits in that language's folder with a slug
 * of its own and names its original in `translationOf`. Throws on anything that would publish a
 * broken pair: a slug used twice, a translation of nothing, two editions in one language, a
 * number that differs from the original's.
 */
export const checkEditions = (editions: readonly EditionLike[], defaultLang: string): void => {
  const slugs = new Set<string>();
  for (const e of editions) {
    if (slugs.has(e.id)) throw new Error(`Precrease slug "${e.id}" is used by two posts`);
    slugs.add(e.id);
  }
  const originals = new Map(editions.filter((e) => e.lang === defaultLang).map((e) => [e.id, e]));
  const pairs = new Set<string>();
  for (const e of editions) {
    if (e.lang === defaultLang) {
      if (e.folder !== '') throw new Error(`"${e.id}" is in ${defaultLang}: its file belongs at the root`);
      if (e.translationOf) throw new Error(`"${e.id}" is an original: it can't be a translation`);
      continue;
    }
    if (e.folder !== e.lang) throw new Error(`"${e.id}" is in ${e.lang}: its file belongs in ${e.lang}/`);
    const original = e.translationOf ? originals.get(e.translationOf) : undefined;
    if (!original) throw new Error(`"${e.id}" must name its original in translationOf`);
    if (original.number !== e.number)
      throw new Error(
        `"${e.id}" has number ${e.number}; its original "${original.id}" has ${original.number}`,
      );
    const pair = `${original.id}:${e.lang}`;
    if (pairs.has(pair)) throw new Error(`"${original.id}" has two editions in ${e.lang}`);
    pairs.add(pair);
  }
};

/**
 * Editions their original has outgrown: the original was updated (`updated`) after the edition was
 * published or last updated, so the correction may be missing from the edition. A warning, not an
 * error: a fix to the original must never wait on its translation.
 */
export const staleEditions = (
  editions: readonly {
    id: string;
    lang: string;
    date: Date;
    updated?: Date | undefined;
    translationOf?: string | undefined;
  }[],
  defaultLang: string,
): { edition: string; original: string }[] => {
  const originals = new Map(editions.filter((e) => e.lang === defaultLang).map((e) => [e.id, e]));
  return editions.flatMap((e) => {
    const original = e.translationOf ? originals.get(e.translationOf) : undefined;
    if (!original?.updated) return [];
    return original.updated > (e.updated ?? e.date) ? [{ edition: e.id, original: original.id }] : [];
  });
};
