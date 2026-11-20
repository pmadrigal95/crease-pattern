import { describe, expect, test } from 'vitest';
import { readPage, sitemapXml } from '../../scripts/sitemap.ts';

const page = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;

describe('sitemap', () => {
  test('a page gives its canonical URL and its translations', () => {
    const html = page(
      '<link rel="canonical" href="https://x.dev/es/precrease/pliegue">' +
        '<link rel="alternate" hreflang="es" href="https://x.dev/es/precrease/pliegue">' +
        '<link rel="alternate" hreflang="en" href="https://x.dev/precrease/fold">' +
        '<link rel="alternate" type="application/rss+xml" href="/precrease/rss.xml">',
    );
    expect(readPage(html)).toEqual({
      loc: 'https://x.dev/es/precrease/pliegue',
      alternates: [
        ['es', 'https://x.dev/es/precrease/pliegue'],
        ['en', 'https://x.dev/precrease/fold'],
      ],
    });
  });

  test('a page marked noindex, or without a canonical URL, stays out', () => {
    expect(
      readPage(
        page('<link rel="canonical" href="https://x.dev/t"><meta name="robots" content="noindex, follow">'),
      ),
    ).toBeNull();
    expect(readPage(page('<title>x</title>'))).toBeNull();
  });

  test('the XML lists each page once, sorted, with escaped URLs', () => {
    const xml = sitemapXml([
      { loc: 'https://x.dev/b', alternates: [] },
      { loc: 'https://x.dev/a?x=1&y=2', alternates: [['en', 'https://x.dev/a']] },
    ]);
    expect(xml.indexOf('https://x.dev/a?x=1&amp;y=2')).toBeLessThan(xml.indexOf('https://x.dev/b'));
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="en" href="https://x.dev/a"/>');
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });
});
