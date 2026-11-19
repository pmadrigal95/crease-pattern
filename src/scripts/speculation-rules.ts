/**
 * The site's speculation rules (Chromium): any page of the site a link points to is prerendered
 * once the pointer rests on that link (eagerness "moderate", about 200 ms) or it's pressed, so the
 * click just shows a page that's already built and the fold between pages starts at once. Never
 * the API, never links that open elsewhere or download. Inlined in every page's <head> by
 * BaseLayout and hashed for the CSP by scripts/csp-hashes.ts, from this one string.
 *
 * Browsers without speculation rules get a plain prefetch on the same signs of intent
 * (src/scripts/prefetch.ts). Pages that count a visit wait until they're shown.
 */
export const speculationRules = JSON.stringify({
  prerender: [
    {
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: '/api/*' } },
          { not: { selector_matches: '[target=_blank], [download]' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
});
