/**
 * Precrease's content, ready for pages: published posts newest first, checked once per build.
 * Drafts show in `astro dev` so they can be previewed, and never in a build.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { copyFor } from '../i18n/dictionary';
import { DEFAULT_LANG, localize, type Lang } from '../i18n/routing';
import { formatsFor } from './taxonomy';
import { padNumber } from './format';
import { fill } from './template';
import { checkNumbers, isLive } from './precrease-tree';

export type Post = CollectionEntry<'precrease'>;

/** Flattened shape the pure helpers in precrease-tree.ts work with. */
export interface PostSummary {
  id: string;
  number: number;
  topics: string[];
  date: Date;
  /** Published: not a draft and its date has arrived. Only `astro dev` ever sees other posts. */
  live: boolean;
  entry: Post;
}

/**
 * Preview builds (`pnpm preview:upload`) include drafts and scheduled posts, so they can be read on
 * a real device through a Cloudflare preview URL before they're published. Those posts get
 * `noindex`. The production deploy never sets this.
 */
export const PREVIEW = process.env.PRECREASE_PREVIEW === '1';

/** One clock per build, so every page agrees on what is out. */
const buildTime = new Date();

export async function getPosts(): Promise<PostSummary[]> {
  const entries = await getCollection('precrease');
  const posts = entries
    .map((entry) => ({
      id: entry.id,
      number: entry.data.number,
      topics: entry.data.topics,
      date: entry.data.date,
      live: isLive(entry.data, buildTime),
      entry,
    }))
    .filter((p) => import.meta.env.DEV || PREVIEW || p.live);
  // Drafts and scheduled posts may hold a future number; the sequence rule applies to what is out.
  checkNumbers(posts.filter((p) => p.live));
  return posts.sort((a, b) => b.number - a.number);
}

/** "Crease No. 001", worded by the copy file of the page's language. */
export const creaseNumber = (value: number, lang: Lang = DEFAULT_LANG): string =>
  fill(copyFor(lang).precrease.number, { number: padNumber(value) });

/** What kind of post it is: "Essay", or "Basic Folds 03" inside a series. */
export function postKind(post: Post, lang: Lang = DEFAULT_LANG): string {
  const { format, series } = post.data;
  const label = formatsFor(lang)[format].label;
  return series ? `${label} ${padNumber(series.part, 2)}` : label;
}

export const postHref = (id: string) => `/precrease/${id}`;
export const topicHref = (id: string, lang: Lang = DEFAULT_LANG) => localize(`/precrease/topics/${id}`, lang);
