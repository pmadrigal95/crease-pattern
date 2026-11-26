import { expect, test } from '@playwright/test';

// "This site, measured" as instruments (src/components/site/WorkReadout.astro): each drawing comes
// from the data the build checks, and the papers switch the identity.
const readout = '[data-readout]';

test('the JavaScript sheet is drawn from the measured figure and the budget', async ({ page }) => {
  await page.goto('/');
  const kb = Number(await page.locator('[data-metric="first-load-js"]').textContent());
  const budget = Number(
    (await page.locator(`${readout} .note`).first().textContent())?.match(/(\d+) KB/)?.[1],
  );
  expect(kb).toBeGreaterThan(0);
  expect(budget).toBe(15);
  await expect(page.locator('[data-metric="js-spare"]')).toHaveText((budget - kb).toFixed(1));
  const width = Number(await page.locator('[data-metric-bar="first-load-js"]').getAttribute('width'));
  expect(width).toBeCloseTo((kb / budget) * 300, 0);
});

test('the 0 shows every axe run behind it, and the parts add up to their figure', async ({ page }) => {
  await page.goto('/');
  const runs = page.locator(`${readout} .runs rect`);
  await expect(runs).toHaveCount(14 * 3 * 2);
  await expect(runs.first().locator('title')).toHaveText('/ · Basalt & glacier · Light');
  await expect(page.locator(`${readout} .viz`).nth(1)).toContainText('84 of 84 clean');
  const parts = Number(await page.locator(`${readout} > div`).nth(2).locator('.fig').textContent());
  await expect(page.locator(`${readout} .dots i`)).toHaveCount(parts);
  const counts = await page.locator(`${readout} .family .n`).allTextContents();
  expect(counts.reduce((sum, n) => sum + Number(n), 0)).toBe(parts);
});

test('the drawings are decoration; the papers are buttons that switch the identity', async ({ page }) => {
  await page.goto('/');
  for (const viz of await page.locator(`${readout} .viz:not(.papers)`).all())
    await expect(viz).toHaveAttribute('aria-hidden', 'true');
  const washi = page.getByRole('button', { name: 'Washi & asagi' });
  await expect(washi).toHaveAttribute('aria-pressed', 'false');
  await washi.click();
  await expect(page.locator('html')).toHaveAttribute('data-direction', 'washi-asagi');
  await expect(washi).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('pm.direction'))).toBe('washi-asagi');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-direction', 'washi-asagi');
});

test("a case card's drawing folds on hover: the plates line up, the site's sheet folds", async ({ page }) => {
  await page.goto('/');
  const [buo, site] = await page.locator('.home-cases .case-card').all();
  const plate = buo!.locator('.sheet:not(.lead)').first();
  await expect(plate).toHaveCSS('transform', 'none');
  await buo!.hover();
  await expect.poll(() => plate.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  const fold = site!.locator('.half.fold');
  await site!.hover();
  await expect
    .poll(() => fold.evaluate((el) => getComputedStyle(el).transform))
    .toBe('matrix(-1, 0, 0, 1, 0, 0)');
});
