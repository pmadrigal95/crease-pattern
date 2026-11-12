import { expect, test } from '@playwright/test';

// Reading aids on a Precrease post (decision 48): the side index, the fold-line progress and the
// change history.
const post = '/precrease/the-work-before-the-shape';

test('a long post has a side index that marks the section being read', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(post);
  const toc = page.getByRole('navigation', { name: 'On this page' });
  await expect(toc).toBeVisible();
  expect(await toc.getByRole('link').count()).toBeGreaterThanOrEqual(3);
  // Bring the heading near the top of the screen, as a reader scrolling down would.
  await page.evaluate(() => {
    document.getElementById('why-precrease')!.scrollIntoView({ block: 'start' });
    scrollBy(0, -50);
  });
  await expect(toc.locator('a[aria-current="location"]')).toHaveText('Why Precrease');
});

test('the change history links to the file on GitHub', async ({ page }) => {
  await page.goto(post);
  await expect(page.getByRole('link', { name: 'Change history on GitHub' })).toHaveAttribute(
    'href',
    /\/commits\/main\/src\/content\/precrease\/the-work-before-the-shape\.mdx$/,
  );
});

test('reading progress follows the scroll, and steps aside for reduced motion', async ({ browser }) => {
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 1280, height: 800 } });
    await page.goto(post);
    const progress = page.locator('.progress');
    if (reducedMotion === 'reduce') {
      await expect(progress).toBeHidden();
    } else {
      await page.evaluate(() => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
      const scale = await page.evaluate(() => {
        const t = getComputedStyle(document.querySelector('.progress')!, '::after').transform;
        return Number(t.match(/matrix\(([^,]+)/)?.[1] ?? 0);
      });
      expect(scale).toBeGreaterThan(0.3);
      expect(scale).toBeLessThan(0.7);
    }
    await page.close();
  }
});
