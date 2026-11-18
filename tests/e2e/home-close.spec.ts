import { expect, test } from '@playwright/test';

// Design debt phase 4: Precrease on the home page in the zine's voice, a one-line Contact, the
// footer on a crease, and a 404 that draws the map it talks about.

test('the home page shows the latest Crease large, the earlier ones in a list', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#precrease');
  await expect(section.getByRole('heading', { level: 2, name: 'Precrease' })).toBeVisible();
  await expect(section.locator('.latest h3 a')).toHaveAttribute('href', /^\/precrease\/.+/);
  await expect(section.locator('.latest .kicker')).toHaveText(/^Crease No\. \d{3} · .+ · .+\d{4}$/);
  expect(await section.locator('.older li').count()).toBeLessThanOrEqual(2);
});

test('the serif loads only as Precrease approaches, never with the page', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (/newsreader/i.test(r.url())) fonts.push(r.url());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(fonts).toEqual([]);
  await page.locator('#precrease').scrollIntoViewIfNeeded();
  await expect.poll(() => fonts.length).toBe(3);
});

test('Contact is one line, the address and a copy button', async ({ page }) => {
  await page.goto('/');
  const contact = page.locator('#contact');
  await expect(contact.locator('.line')).toHaveText('Email reaches me fastest.');
  await expect(contact.getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:/);
});

test('the footer hangs on a crease with the fox, on every page', async ({ page }) => {
  for (const path of ['/', '/about', '/colophon']) {
    await page.goto(path);
    await expect(page.locator('footer .crease .fox-mark')).toHaveCount(1);
    await expect(
      page.locator('footer').getByRole('list', { name: 'Elsewhere' }).getByRole('link'),
    ).toHaveCount(6);
  }
});

test('the 404 draws the Irazú, with you outside the map', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  const map = page.getByRole('img', { name: /contour map of the Irazú/ });
  await expect(map).toBeVisible();
  expect(await page.locator('.nf-map .contour').count()).toBeGreaterThan(10);
  await expect(page.locator('.nf-map .here')).toHaveText('You are here');
});
