import { expect, test } from 'vitest';
import { normalize, rank, score } from '../../src/lib/command-match';

test('normalizing ignores case, accents and punctuation', () => {
  expect(normalize('Irazú!')).toBe('irazu');
  expect(normalize('  Topic map · Precrease ')).toBe('topic map precrease');
});

test('every word typed must start a word of the label or its context', () => {
  expect(score({ label: 'Quality gates', context: 'Colophon' }, 'col qual')).toBeGreaterThan(0);
  expect(score({ label: 'Quality gates', context: 'Colophon' }, 'gates')).toBeGreaterThan(0);
  expect(score({ label: 'Quality gates', context: 'Colophon' }, 'ates')).toBe(0);
  expect(score({ label: 'Irazú' }, 'iraz')).toBeGreaterThan(0);
});

test('an empty query keeps everything in its order', () => {
  const items = [{ label: 'B' }, { label: 'A' }];
  expect(rank(items, '')).toEqual(items);
});

test('labels that start with the query rank first, ties keep their order', () => {
  const items = [
    { label: 'The 3D scene', context: 'Colophon' },
    { label: 'Use the dark theme' },
    { label: 'Theme', context: 'Inspector' },
    { label: 'Use the light theme' },
  ];
  expect(rank(items, 'the').map((i) => i.label)).toEqual([
    'The 3D scene',
    'Theme',
    'Use the dark theme',
    'Use the light theme',
  ]);
});
