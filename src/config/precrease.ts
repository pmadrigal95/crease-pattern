/**
 * Precrease, the blog (decisions 46–49). Its taxonomy lives here, in one file:
 *
 * - Topics form a tree with no depth limit. Each topic names its parent; a post can sit on any
 *   topic at any depth, and a topic's page gathers its whole subtree. Post URLs never contain the
 *   topic, so moving a branch never breaks a link.
 * - Formats are independent of topics: what kind of post it is, not what it's about. The format
 *   also picks the thumbnail's pattern family, so the thumbnail tells readers what to expect.
 *
 * Adding a topic is adding one entry. The build fails on an unknown parent or a cycle.
 */

export interface Topic {
  /** Lowercase slug, used in /precrease/topics/<id>. */
  id: string;
  label: string;
  /** One sentence for the topic's page and the map. */
  intro: string;
  parent?: string;
}

export const topics: readonly Topic[] = [
  {
    id: 'architecture',
    label: 'Architecture & Design',
    intro: 'How software is shaped so it can keep changing: boundaries, modules, interfaces.',
  },
  {
    id: 'frontend',
    label: 'Frontend',
    intro: 'Interfaces that hold up in the browser, for every person using them.',
  },
  {
    id: 'performance',
    label: 'Performance',
    intro: 'Measured speed: what users wait for and how to remove it.',
    parent: 'frontend',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    intro: 'Keyboard, screen readers, contrast and everything else that decides who can use it.',
    parent: 'frontend',
  },
  {
    id: 'motion',
    label: 'Interaction & Motion',
    intro: 'Movement that explains something, and the restraint around it.',
    parent: 'frontend',
  },
  {
    id: 'backend',
    label: 'Backend & Data',
    intro: 'APIs, storage and the data that outlives every interface.',
  },
  {
    id: 'systems',
    label: 'Systems',
    intro: 'Concurrency, distributed work and the cost of coordination.',
  },
  {
    id: 'concurrency',
    label: 'Concurrency',
    intro: 'Threads, workers and why more of them is not always faster.',
    parent: 'systems',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    intro: 'Testing, CI/CD, DevOps and security: getting changes out safely.',
  },
  {
    id: 'ai',
    label: 'AI & Engineering',
    intro: 'Building software with AI in the loop, and what still needs a person.',
  },
  {
    id: 'craft',
    label: 'Craft & Career',
    intro: 'Reading, writing, leading, and learning in public.',
  },
];

export const formats = {
  essay: { label: 'Essay', family: 'crease' },
  note: { label: 'Note', family: 'truchet' },
  'dog-ear': { label: 'Dog-ear', family: 'corner' },
  'basic-folds': { label: 'Basic Folds', family: 'cells' },
} as const;

export type Format = keyof typeof formats;
export const formatIds = Object.keys(formats) as [Format, ...Format[]];
export const topicIds = topics.map((t) => t.id) as [string, ...string[]];

/** Topics with fewer posts than this stay out of search engines (thin pages). */
export const MIN_POSTS_TO_INDEX = 3;
