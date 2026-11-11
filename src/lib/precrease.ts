/**
 * Precrease's content, ready for pages: published posts newest first, checked once per build.
 * Drafts show in `astro dev` so they can be previewed, and never in a build.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { topics } from '../config/precrease';
import { checkNumbers, validateTree } from './precrease-tree';

export type Post = CollectionEntry<'precrease'>;

/** Flattened shape the pure helpers in precrease-tree.ts work with. */
export interface PostSummary {
  id: string;
  number: number;
  topics: string[];
  date: Date;
  entry: Post;
}

validateTree(topics);

export async function getPosts(): Promise<PostSummary[]> {
  const entries = await getCollection('precrease', (p) => import.meta.env.DEV || !p.data.draft);
  const posts = entries.map((entry) => ({
    id: entry.id,
    number: entry.data.number,
    topics: entry.data.topics,
    date: entry.data.date,
    entry,
  }));
  // Drafts may hold a future number; the sequence rule applies to what is published.
  checkNumbers(posts.filter((p) => !p.entry.data.draft));
  return posts.sort((a, b) => b.number - a.number);
}

export const postHref = (id: string) => `/precrease/${id}`;
export const topicHref = (id: string) => `/precrease/topics/${id}`;
