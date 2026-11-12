import { describe, expect, test } from 'vitest';
import { formats, topics, type Topic } from '../../src/config/precrease';
import {
  checkNumbers,
  pathTo,
  postsUnder,
  related,
  subtree,
  validateTree,
} from '../../src/lib/precrease-tree';
import { readingMinutes } from '../../src/lib/reading';
import { excerptRuns, resultHref, toFilters } from '../../src/lib/precrease-search';
import { seeded, thumbnail } from '../../src/lib/thumbnail';

const post = (id: string, number: number, topicIds: string[], day: number) => ({
  id,
  number,
  topics: topicIds,
  date: new Date(2027, 0, day),
});

describe('Precrease topic tree', () => {
  test('the real tree is valid', () => {
    expect(() => validateTree(topics)).not.toThrow();
  });

  test('rejects unknown parents, duplicates and cycles', () => {
    expect(() => validateTree([{ id: 'a', label: 'A', intro: '', parent: 'missing' }])).toThrow(
      /unknown parent/,
    );
    expect(() =>
      validateTree([
        { id: 'a', label: 'A', intro: '' },
        { id: 'a', label: 'A', intro: '' },
      ]),
    ).toThrow(/twice/);
    const cycle: Topic[] = [
      { id: 'a', label: 'A', intro: '', parent: 'b' },
      { id: 'b', label: 'B', intro: '', parent: 'a' },
    ];
    expect(() => validateTree(cycle)).toThrow(/cycle/);
  });

  test('paths run root first and subtrees go to any depth', () => {
    const deep: Topic[] = [
      { id: 'root', label: 'Root', intro: '' },
      { id: 'mid', label: 'Mid', intro: '', parent: 'root' },
      { id: 'leaf', label: 'Leaf', intro: '', parent: 'mid' },
    ];
    expect(pathTo(deep, 'leaf').map((t) => t.id)).toEqual(['root', 'mid', 'leaf']);
    expect([...subtree(deep, 'root')]).toEqual(['root', 'mid', 'leaf']);
  });

  test('a topic page gathers posts from its whole subtree', () => {
    const posts = [post('perf', 1, ['performance'], 1), post('api', 2, ['backend'], 2)];
    expect(postsUnder(topics, posts, 'frontend').map((p) => p.id)).toEqual(['perf']);
  });

  test('related posts rank exact topics above shared ancestors', () => {
    const a = post('a', 1, ['performance'], 1);
    const sameTopic = post('b', 2, ['performance'], 2);
    const sibling = post('c', 3, ['accessibility'], 3);
    const unrelated = post('d', 4, ['backend'], 4);
    expect(related(topics, [a, sameTopic, sibling, unrelated], a).map((p) => p.id)).toEqual(['b', 'c']);
  });
});

describe('Crease numbers', () => {
  test('run from 1 with no gaps, in date order', () => {
    expect(() => checkNumbers([post('a', 1, ['craft'], 1), post('b', 2, ['craft'], 2)])).not.toThrow();
    expect(() => checkNumbers([post('a', 1, ['craft'], 1), post('b', 3, ['craft'], 2)])).toThrow(
      /without gaps/,
    );
    expect(() => checkNumbers([post('a', 1, ['craft'], 5), post('b', 2, ['craft'], 2)])).toThrow(
      /dated before/,
    );
  });
});

describe('Thumbnails', () => {
  test('the same slug always draws the same pattern', () => {
    expect(thumbnail('the-work-before-the-shape', 'crease')).toEqual(
      thumbnail('the-work-before-the-shape', 'crease'),
    );
    expect(thumbnail('a', 'truchet').shapes).not.toEqual(thumbnail('b', 'truchet').shapes);
  });

  test('every format has a family that draws something', () => {
    for (const { family } of Object.values(formats)) {
      expect(thumbnail('slug', family).shapes.length).toBeGreaterThan(50);
    }
  });

  test('shapes only use attributes the CSP allows (no inline style attributes)', () => {
    for (const { family } of Object.values(formats)) {
      expect(thumbnail('slug', family).shapes).not.toMatch(/style=/);
    }
  });

  test('the seeded generator stays within [0, 1)', () => {
    const rand = seeded('x');
    for (let i = 0; i < 1000; i++) {
      const n = rand();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('Reading time', () => {
  test('counts prose at 230 words a minute and ignores code', () => {
    const words = Array.from({ length: 460 }, () => 'word').join(' ');
    expect(readingMinutes(words)).toBe(2);
    expect(readingMinutes(`${words}\n\`\`\`ts\n${words}\n\`\`\``)).toBe(2);
    expect(readingMinutes('')).toBe(1);
  });
});

describe('Search', () => {
  test('Pagefind file URLs map to the URLs the site serves', () => {
    expect(resultHref('/precrease/the-work-before-the-shape.html')).toBe(
      '/precrease/the-work-before-the-shape',
    );
    expect(resultHref('/precrease/a.html#part')).toBe('/precrease/a#part');
    expect(resultHref('/index.html')).toBe('/');
  });

  test('a result only ever links to a path on this site', () => {
    expect(resultHref('javascript:alert(1)')).toBeNull();
    expect(resultHref('https://example.com/precrease/a')).toBeNull();
    expect(resultHref('//example.com/a')).toBeNull();
    expect(resultHref('/\\example.com')).toBeNull();
    expect(resultHref('precrease/a.html')).toBeNull();
  });

  test('only groups with a selection become filters', () => {
    expect(toFilters({ format: new Set(['note', 'essay']), topic: new Set() })).toEqual({
      format: { any: ['essay', 'note'] },
    });
  });

  test('excerpts keep their highlights as data, never as markup', () => {
    expect(excerptRuns('a <mark>fold</mark> &amp; <b>x</b>&lt;script&gt;')).toEqual([
      { text: 'a ', marked: false },
      { text: 'fold', marked: true },
      { text: ' & x<script>', marked: false },
    ]);
    expect(excerptRuns('&amp;lt;b&amp;gt; stays text')).toEqual([
      { text: '&lt;b&gt; stays text', marked: false },
    ]);
    expect(excerptRuns('5 < 6 and <mark>7</mark>')).toEqual([
      { text: '5 < 6 and ', marked: false },
      { text: '7', marked: true },
    ]);
  });
});
