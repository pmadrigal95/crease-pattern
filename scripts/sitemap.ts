// The sitemap, read from the built pages (M5.5). Each page says what the sitemap needs: its canonical
// URL, its translations (the hreflang links in its <head>) and whether it should be indexed at all.
// Reading them back keeps the sitemap from disagreeing with the pages: a thin topic page with
// `noindex` stays out, and a post and its Spanish edition, which have different slugs, are listed
// as a pair.

/** What one built page tells the sitemap. */
export interface SitemapPage {
  loc: string;
  /** hreflang → absolute URL, the page's own included. */
  alternates: [string, string][];
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** The page's entry, or null when it asks not to be indexed or names no canonical URL. */
export const readPage = (html: string): SitemapPage | null => {
  const head = html.match(/<head[\s\S]*?<\/head>/)?.[0] ?? '';
  const links = head.match(/<link\b[^>]*>/g) ?? [];
  const metas = head.match(/<meta\b[^>]*>/g) ?? [];
  if (metas.some((m) => attr(m, 'name') === 'robots' && /noindex/.test(attr(m, 'content') ?? '')))
    return null;
  const loc = links.map((l) => (attr(l, 'rel') === 'canonical' ? attr(l, 'href') : undefined)).find(Boolean);
  if (!loc) return null;
  const alternates = links.flatMap((l): [string, string][] => {
    const lang = attr(l, 'hreflang');
    const href = attr(l, 'href');
    return attr(l, 'rel') === 'alternate' && lang && href ? [[lang, href]] : [];
  });
  return { loc, alternates };
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The sitemap's XML: one <url> per page, sorted, with its translations as xhtml:link. */
export const sitemapXml = (pages: readonly SitemapPage[]): string => {
  const urls = pages
    .toSorted((a, b) => a.loc.localeCompare(b.loc))
    .map(({ loc, alternates }) => {
      const links = alternates.map(
        ([lang, href]) => `<xhtml:link rel="alternate" hreflang="${escape(lang)}" href="${escape(href)}"/>`,
      );
      return `<url><loc>${escape(loc)}</loc>${links.join('')}</url>`;
    });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    urls.join('') +
    '</urlset>\n'
  );
};
