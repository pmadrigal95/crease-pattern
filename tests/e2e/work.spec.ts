import { expect, test } from '@playwright/test';

// M6: /work lists the jobs first, then Pablo's own project, then the earlier roles in a few lines
// read from the changelog. Each case has four plates and a closing one, and its own way out.

test('/work lists Buo first, this site second, then the earlier roles', async ({ page }) => {
  await page.goto('/work');
  const cards = page.locator('.cases .case-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('href', '/work/buo');
  await expect(cards.nth(1)).toHaveAttribute('href', '/work/crease-pattern');
  await expect(cards.nth(1).locator('.meta')).toHaveText(/^Personal project · \d{4}$/);

  const earlier = page.getByRole('region', { name: 'Earlier work' });
  const roles = earlier.getByRole('listitem');
  // Finished roles at companies without a case of their own, newest first; never Buo.
  await expect(roles.first().getByRole('heading', { level: 3 })).toHaveText(/NICE Actimize/);
  // Buo is not one of them: its ribbon only runs on into its case.
  await expect(earlier.locator('.strips')).not.toContainText('Buo');
  await expect(earlier.getByRole('link', { name: /version by version/ })).toHaveAttribute(
    'href',
    '/changelog',
  );
});

test('the Spanish /work has the same order and its own words', async ({ page }) => {
  await page.goto('/es/work');
  await expect(page.locator('.cases .case-card').nth(1)).toHaveAttribute('href', '/es/work/crease-pattern');
  await expect(page.getByRole('region', { name: 'Trabajo anterior' })).toBeVisible();
});

test('the site case has four plates, a closing one and a link to the colophon', async ({ page }) => {
  await page.goto('/work/crease-pattern');
  await expect(page.locator('article.plate')).toHaveCount(4);
  await expect(page.locator('article.plate').first()).toHaveClass(/lead/);
  await expect(page.locator('#base')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plates' }).getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('link', { name: /See how it's built/ })).toHaveAttribute('href', '/colophon');
  // Every figure has a wide and a tall drawing, each read aloud by its plate's title.
  await expect(page.locator('.case-figure svg[role="img"]')).toHaveCount(8);
});

test('a case leads on to the next one, and the index marks only the plate being read', async ({ page }) => {
  await page.goto('/work/buo');
  await expect(page.getByRole('link', { name: /Next case study/ })).toHaveAttribute(
    'href',
    '/work/crease-pattern',
  );
  const index = page.getByRole('navigation', { name: 'Plates' });
  await expect(index.locator('[aria-current]')).toHaveCount(0);
  await page.locator('#publishing').scrollIntoViewIfNeeded();
  await expect(index.locator('[aria-current="location"]')).toHaveText(/Publishing/);
  // Back above the plates, none is being read.
  await page.evaluate(() => scrollTo(0, 0));
  await expect(index.locator('[aria-current]')).toHaveCount(0);
  await page.goto('/work/crease-pattern');
  await expect(page.getByRole('link', { name: /Next case study/ })).toHaveAttribute('href', '/work/buo');
});

test('reading a note points at its part of the diagram', async ({ page }) => {
  await page.goto('/work/buo');
  const plate = page.locator('#publishing');
  await plate.scrollIntoViewIfNeeded();
  await plate.locator('[data-step="result"]').hover();
  await expect(plate).toHaveAttribute('data-focus', 'result');
  await expect(plate.locator('.case-figure .wide .s-result').first()).toHaveCSS('opacity', '1');
  await expect(plate.locator('.case-figure .wide .box.key').first()).not.toHaveCSS('opacity', '1');
  await page.mouse.move(0, 0);
  await expect(plate).not.toHaveAttribute('data-focus');
});
