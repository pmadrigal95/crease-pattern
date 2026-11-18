/**
 * Precrease's topics and formats with their words in a page's language: the tree and the
 * thumbnail families from src/config/precrease.ts, joined with src/i18n/locales/<lang>/taxonomy.json.
 */
import { formats, topicTree, type Format, type TopicNode } from '../config/precrease';
import { dictionary } from '../i18n/dictionary';
import { validateTree } from './precrease-tree';

export interface Topic extends TopicNode {
  label: string;
  /** One sentence for the topic's page and the map. */
  intro: string;
}

export interface FormatInfo {
  label: string;
  description: string;
  family: (typeof formats)[Format]['family'];
}

validateTree(topicTree);

/** The topic tree in a page's language. A topic without words fails the build. */
export function topicsFor(locale: string | undefined | null): readonly Topic[] {
  const words: Record<string, { label: string; intro: string } | undefined> =
    dictionary(locale).taxonomy.topics;
  return topicTree.map((node) => {
    const own = words[node.id];
    if (!own) throw new Error(`taxonomy.json: topic "${node.id}" has no words`);
    return { ...node, ...own };
  });
}

/** Each format's label, description and thumbnail family in a page's language. */
export function formatsFor(locale: string | undefined | null): Record<Format, FormatInfo> {
  const words: Record<string, { label: string; description: string } | undefined> =
    dictionary(locale).taxonomy.formats;
  return Object.fromEntries(
    Object.entries(formats).map(([id, { family }]) => {
      const own = words[id];
      if (!own) throw new Error(`taxonomy.json: format "${id}" has no words`);
      return [id, { ...own, family }];
    }),
  ) as Record<Format, FormatInfo>;
}
