/**
 * Precrease, the blog (decisions 46–49). The shape of its taxonomy lives here, in one file; what
 * each topic and format is called, in every language, lives in src/i18n/locales/<lang>/taxonomy.json
 * and is joined to this in src/lib/taxonomy.ts.
 *
 * - Topics form a tree with no depth limit. Each topic names its parent; a post can sit on any
 *   topic at any depth, and a topic's page gathers its whole subtree. Post URLs never contain the
 *   topic, so moving a branch never breaks a link.
 * - Formats are independent of topics: what kind of post it is, not what it's about. The format
 *   also picks the thumbnail's pattern family, so the thumbnail tells readers what to expect.
 *
 * Adding a topic is adding one entry here and its words in each taxonomy.json. The build fails on
 * an unknown parent, a cycle, or a topic without words.
 */

export interface TopicNode {
  /** Lowercase slug, used in /precrease/topics/<id>. */
  id: string;
  parent?: string;
}

export const topicTree: readonly TopicNode[] = [
  { id: 'architecture' },
  { id: 'frontend' },
  { id: 'performance', parent: 'frontend' },
  { id: 'accessibility', parent: 'frontend' },
  { id: 'motion', parent: 'frontend' },
  { id: 'backend' },
  { id: 'systems' },
  { id: 'concurrency', parent: 'systems' },
  { id: 'delivery' },
  { id: 'ai' },
  { id: 'craft' },
];

/** Each format's thumbnail family (src/lib/thumbnail.ts). */
export const formats = {
  essay: { family: 'crease' },
  note: { family: 'truchet' },
  'dog-ear': { family: 'corner' },
  'basic-folds': { family: 'cells' },
} as const;

export type Format = keyof typeof formats;
export const formatIds = Object.keys(formats) as [Format, ...Format[]];
export const topicIds = topicTree.map((t) => t.id) as [string, ...string[]];

/** Topics with fewer posts than this stay out of search engines (thin pages). */
export const MIN_POSTS_TO_INDEX = 3;
