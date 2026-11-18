import { describe, expect, test } from 'vitest';
import {
  langOf,
  languageLinks,
  localize,
  preferredLang,
  switchTarget,
  translationsOf,
  unlocalize,
} from '../../src/i18n/routing';
import { assertSameShape, assertWellFormed } from '../../src/i18n/dictionary';
import { DEFAULT_LANG, LANGS } from '../../src/i18n/config';
import { joinCareer } from '../../src/lib/career';
import { readFileSync } from 'node:fs';

describe('paths', () => {
  test.each([
    ['/', '/'],
    ['/es', '/'],
    ['/es/about', '/about'],
    ['/about', '/about'],
    ['/essays', '/essays'],
  ])('unlocalize(%s) is %s', (path, expected) => expect(unlocalize(path)).toBe(expected));

  test.each([
    ['/', 'es', '/es'],
    ['/about', 'es', '/es/about'],
    ['/es/about', 'en', '/about'],
    ['/es', 'en', '/'],
    ['/es/about', 'es', '/es/about'],
  ] as const)('localize(%s, %s) is %s', (path, lang, expected) =>
    expect(localize(path, lang)).toBe(expected),
  );

  test('unknown locales are English', () => {
    expect(langOf(undefined)).toBe('en');
    expect(langOf('fr')).toBe('en');
    expect(langOf('es')).toBe('es');
  });
});

describe('translations', () => {
  test('a page under [...locale] exists in both languages', () => {
    expect(translationsOf('/es/about', '/[...locale]/about')).toEqual({ en: '/about', es: '/es/about' });
  });
  test('any other page only in its own, unless it names its pair', () => {
    expect(translationsOf('/precrease/a-post', '/precrease/[slug]')).toEqual({ en: '/precrease/a-post' });
    const own = { en: '/precrease/a-post', es: '/es/precrease/una-entrada' };
    expect(translationsOf('/precrease/a-post', '/precrease/[slug]', own)).toBe(own);
  });
  test('the switch leads to the pair, or to the closest page that has one', () => {
    expect(switchTarget('/about', { en: '/about', es: '/es/about' }, 'es')).toBe('/es/about');
    expect(switchTarget('/precrease/a-post', { en: '/precrease/a-post' }, 'es')).toBe('/es/precrease');
    expect(switchTarget('/missing', { en: '/missing' }, 'es')).toBe('/es');
  });
});

describe('preferredLang', () => {
  test.each([
    [['es-CR', 'en'], 'es'],
    [['en-US', 'es'], 'en'],
    [['fr-FR', 'es-ES'], 'es'],
    [['fr', 'de'], null],
    [[], null],
  ] as const)('%j prefers %s', (languages, expected) => expect(preferredLang(languages)).toBe(expected));
});

describe('dictionaries', () => {
  test('a missing key fails', () => {
    expect(() => assertSameShape({ a: 'x', b: 'y' }, { a: 'x' }, 'es/ui.json')).toThrow(/keys differ/);
  });
  test('a different placeholder fails', () => {
    expect(() => assertSameShape({ a: 'Hi {name}' }, { a: 'Hola {nombre}' }, 'es/ui.json')).toThrow(
      /placeholders/,
    );
  });
  test('a list of another length fails', () => {
    expect(() => assertSameShape({ a: ['x', 'y'] }, { a: ['x'] }, 'es/career.json')).toThrow(/list of 2/);
  });
  test('a translation with the same keys, lists and placeholders passes', () => {
    expect(() =>
      assertSameShape(
        { g: { a: 'Hi {name}', l: ['x'] } },
        { g: { a: 'Hola, {name}', l: ['y'] } },
        'es/ui.json',
      ),
    ).not.toThrow();
  });
  test('empty strings and broken placeholders fail', () => {
    expect(() => assertWellFormed({ a: ' ' }, 'es/ui.json')).toThrow(/empty/);
    expect(() => assertWellFormed({ a: ['ok', 'Hola {name'] }, 'es/ui.json')).toThrow(/a\[1\]: placeholders/);
  });
});

describe('career words', () => {
  const facts = {
    vueSince: '2019-09',
    releases: [{ major: 1, elevationM: 2708, location: { lat: 10, lon: -84 } }],
    entries: [{ version: '1.0.0', kind: 'role' as const, start: '2019-09' }],
  };
  const words = {
    releases: { '1': { codename: 'Poás', place: 'Poás', theme: 'Developer' } },
    unreleased: [],
    entries: { '1.0.0': { title: 'Engineer', org: 'MDG' } },
  };
  test('join each release and entry with its words', () => {
    expect(joinCareer(facts, words, 'en').entries[0]).toMatchObject({ version: '1.0.0', title: 'Engineer' });
  });
  test('an entry without words fails, and so do words for an entry that does not exist', () => {
    expect(() => joinCareer(facts, { ...words, entries: {} }, 'es')).toThrow(/entry 1\.0\.0 has no words/);
    expect(() =>
      joinCareer(facts, { ...words, entries: { ...words.entries, '9.0.0': { title: 'x', org: 'y' } } }, 'es'),
    ).toThrow(/9\.0\.0 not in career\.json/);
  });
});

describe('languages', () => {
  test('the switch lists every language, the current one marked', () => {
    expect(languageLinks('/es/about', { en: '/about', es: '/es/about' }, 'es')).toEqual([
      { lang: 'en', href: '/about', current: false },
      { lang: 'es', href: '/es/about', current: true },
    ]);
  });
  test('the home redirect knows every language but the default', () => {
    const script = readFileSync('src/scripts/restore-identity.ts', 'utf8');
    const listed = /\[((?:"[a-z]+",?)+)\]\.indexOf\(l\)/.exec(script)?.[1];
    expect(listed?.split(',').map((l) => l.replaceAll('"', ''))).toEqual(
      LANGS.filter((l) => l !== DEFAULT_LANG),
    );
  });
});
