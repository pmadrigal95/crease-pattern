/**
 * ⌘K's matching (M4.7): pure functions, no DOM, shared by the menu and the tests. The site is
 * small, so a command matches when every word typed starts a word of its label or of the place
 * it belongs to ("col qual" finds Colophon › Quality gates), ignoring case and accents; labels
 * that start with the query rank first, then the others in their original order.
 */

/** Lower case, accents stripped, punctuation turned into spaces: "Irazú!" → "irazu". */
export const normalize = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
};

export interface Searchable {
  /** What the option shows and matches first. */
  label: string;
  /** Extra words it also answers to: the page a section is on, a post's number. */
  context?: string;
}

/** 0 when it doesn't match; higher is better. */
export const score = (item: Searchable, query: string): number => {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(item.label);
  const words = `${label} ${normalize(item.context ?? '')}`.split(' ').filter(Boolean);
  const terms = q.split(' ');
  if (!terms.every((term) => words.some((word) => word.startsWith(term)))) return 0;
  if (label.startsWith(q)) return 3;
  if (label.split(' ').some((word) => word.startsWith(terms[0]!))) return 2;
  return 1;
};

/** The items that match, best first; ties keep their order. */
export const rank = <T extends Searchable>(items: readonly T[], query: string): T[] => {
  return items
    .map((item, index) => ({ item, index, score: score(item, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
};
