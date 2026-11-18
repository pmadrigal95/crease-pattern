import { describe, expect, test } from 'vitest';
import { careerFor } from '../../src/lib/career';
import { formatsFor, topicsFor } from '../../src/lib/taxonomy';
import { formats, topicTree } from '../../src/config/precrease';
import { copyFor, dictionary } from '../../src/i18n/dictionary';
import { LANGS } from '../../src/i18n/config';
import { allVisualDirections } from '../../src/config/visual-direction';

// R1: every language has every word a page shows, and the facts behind them stay shared.
describe.each(LANGS)('%s', (lang) => {
  test('keeps the career facts (dates, map, stacks) from the one career.json', () => {
    const own = careerFor(lang);
    const en = careerFor('en');
    const facts = (c: typeof en) => ({
      entries: c.entries.map(({ version, start, end, stack }) => ({ version, start, end, stack })),
      releases: c.releases.map(({ major, elevationM, location }) => ({ major, elevationM, location })),
    });
    expect(facts(own)).toEqual(facts(en));
  });

  test('names every topic, format and identity', () => {
    expect(topicsFor(lang).map((t) => [t.id, t.parent])).toEqual(topicTree.map((t) => [t.id, t.parent]));
    expect(Object.keys(formatsFor(lang)).sort()).toEqual(Object.keys(formats).sort());
    expect(Object.keys(copyFor(lang).identities).sort()).toEqual([...allVisualDirections].sort());
  });

  test('has a profile', () => {
    expect(dictionary(lang).profile.role).not.toBe('');
  });
});

test('Spanish career lines are translated, not copied', () => {
  const [en, es] = [careerFor('en'), careerFor('es')];
  es.releases.forEach((r, i) => expect(r.theme).not.toBe(en.releases[i]!.theme));
  es.entries.forEach((e, i) => {
    const lines = (x: typeof e) => [...(x.added ?? []), ...(x.changed ?? [])];
    lines(e).forEach((line, j) => expect(line).not.toBe(lines(en.entries[i]!)[j]));
  });
});
