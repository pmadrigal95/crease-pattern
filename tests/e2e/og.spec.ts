import { expect, test } from '@playwright/test';
import { auditedPages } from '../../src/config/quality';

// Every page shares a preview image (M4.4): its own card, or the home page's. LinkedIn, X and the
// rest show it only if the meta points at a real 1200 × 630 PNG.
const pages = auditedPages.filter((p) => p !== '/this-page-does-not-exist');

for (const path of pages) {
  test(`${path} links a 1200 × 630 preview image that exists`, async ({ page, request }) => {
    await page.goto(path);
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/^https:\/\/.+\.png$/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

    // The meta names the live host; the same path must exist in this build.
    const response = await request.get(new URL(image!).pathname);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const png = await response.body();
    // PNG header: width and height are the IHDR chunk's first two big-endian 32-bit numbers.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
}

test('home, About, Changelog and Colophon each have their own card', async ({ page }) => {
  const cards: Record<string, string> = {
    '/': '/og/home.png',
    '/about': '/og/about.png',
    '/changelog': '/og/changelog.png',
    '/colophon': '/og/colophon.png',
  };
  for (const [path, card] of Object.entries(cards)) {
    await page.goto(path);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      new RegExp(`${card}$`),
    );
  }
});
