import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The 404's walk (NotFoundMap.astro, src/scripts/notfound-walk.ts, doc 38). The English 404 is in
// a11y.spec.ts's audited pages, in every identity and theme; here, the walk, its pause and Spanish.
const axe = async (page: import('@playwright/test').Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze())
    .violations;
const figureX = (page: import('@playwright/test').Page) =>
  page.locator('.nf-map svg.origami').evaluate((el) => Number(el.getAttribute('x')));

test('the figure walks the trail, says the error, and pauses on request', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByText('Error 404', { exact: true })).toBeVisible();
  const start = await figureX(page);
  await expect.poll(() => figureX(page)).not.toBe(start);

  const pause = page.getByRole('button', { name: 'Pause the figure' });
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await pause.click();
  const resume = page.getByRole('button', { name: 'Move the figure' });
  await expect(resume).toHaveAttribute('aria-pressed', 'true');
  const stopped = await figureX(page);
  await page.waitForTimeout(400);
  expect(await figureX(page)).toBe(stopped);
  expect(await axe(page)).toEqual([]);

  await resume.click();
  await expect(page.getByRole('button', { name: 'Pause the figure' })).toBeVisible();
});

test('with reduced motion the figure waits by the pin, with nothing to pause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/this-page-does-not-exist');
  await expect(page.locator('.nf-map .pause')).toBeHidden();
  const pin = await page.locator('.nf-map .pin').evaluate((el) => Number(el.getAttribute('cx')));
  await expect.poll(async () => Math.abs((await figureX(page)) + 14 - pin)).toBeLessThan(4);
});

test('the Spanish 404 is Spanish throughout, the map included, and leads to the Spanish home', async ({
  page,
}) => {
  await page.goto('/es/404');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página no está en el mapa.');
  await expect(page.getByRole('img', { name: /mapa de curvas de nivel del volcán Irazú/ })).toBeVisible();
  await expect(page.locator('.nf-map .here')).toHaveText('Estás aquí');
  await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/es');
  await expect(page.getByRole('button', { name: 'Pausar la figura' })).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});
