/**
 * A treemap: a rectangle shared among weighted items, each a region of its share, cut in halves of
 * weight that alternate across and down (doc 41, the topic sheet). Pure, so it can be tested.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Region<T> extends Rect {
  item: T;
}

/** Splits `items` (heaviest first works best) over `rect`, the first cut across if it's wide. */
export const treemap = <T extends { weight: number }>(
  items: readonly T[],
  rect: Rect,
  across: boolean = rect.w >= rect.h,
): Region<T>[] => {
  const { x, y, w, h } = rect;
  const [only] = items;
  if (!only) return [];
  if (items.length === 1) return [{ item: only, ...rect }];
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  // The first group takes items while it stays at or under half the weight, and at least one.
  let k = 1;
  let first = only.weight;
  while (k < items.length - 1 && (first + items[k]!.weight) / total <= 0.5) first += items[k++]!.weight;
  const share = first / total;
  const [a, b] = [items.slice(0, k), items.slice(k)];
  return across
    ? [
        ...treemap(a, { x, y, w: w * share, h }, !across),
        ...treemap(b, { x: x + w * share, y, w: w * (1 - share), h }, !across),
      ]
    : [
        ...treemap(a, { x, y, w, h: h * share }, !across),
        ...treemap(b, { x, y: y + h * share, w, h: h * (1 - share) }, !across),
      ];
};
