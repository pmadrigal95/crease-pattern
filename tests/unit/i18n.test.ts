import { describe, expect, test } from 'vitest';
import {
  langOf,
  localize,
  preferredLang,
  switchTarget,
  translationsOf,
  unlocalize,
} from '../../src/lib/i18n';
import { assertSameShape } from '../../src/lib/copy';

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

describe('copy files', () => {
  test('a missing key fails', () => {
    expect(() => assertSameShape({ a: 'x', b: 'y' }, { a: 'x' }, 'es')).toThrow(/keys differ/);
  });
  test('a different placeholder fails', () => {
    expect(() => assertSameShape({ a: 'Hi {name}' }, { a: 'Hola {nombre}' }, 'es')).toThrow(/placeholders/);
  });
  test('a translation with the same keys and placeholders passes', () => {
    expect(() =>
      assertSameShape({ g: { a: 'Hi {name}' } }, { g: { a: 'Hola, {name}' } }, 'es'),
    ).not.toThrow();
  });
});
