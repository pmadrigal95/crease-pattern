import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Design debt phase 4: Precrease on the home page in the zine's voice, a one-line Contact, the
// footer on a crease, and a 404 that draws the map it talks about.

test('the home page shows the latest Crease as a cover, the two before it as cards', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#precrease');
  await expect(section.getByRole('heading', { level: 2, name: 'Precrease' })).toBeVisible();
  const cover = section.locator('.cover');
  await expect(cover.locator('h3 a')).toHaveAttribute('href', /^\/precrease\/.+/);
  // The number only with its label, on the cover's sheet; the rest say what each post is in words.
  await expect(cover.locator('.stamp')).toHaveText(/^Crease No\. \d{3}$/);
  await expect(cover.locator('.kind')).toHaveText(/^Essay · .+$/);
  await expect(cover.locator('.meta')).toHaveText(/\d{4} · \d+ min read/);
  const cards = section.locator('.card');
  expect(await cards.count()).toBeLessThanOrEqual(2);
  for (const card of await cards.all()) await expect(card).not.toContainText(/No\. \d|\b0\d\d\b/);
});

test('inspecting lays the cover sheet flat and names its folds', async ({ page }) => {
  await page.goto('/');
  const plan = page.locator('#precrease .cover .plan');
  await expect(plan).toBeHidden();
  await page.locator('[data-inspector-toggle]').click();
  await page.locator('#precrease').scrollIntoViewIfNeeded();
  await expect(plan).toBeVisible();
  await expect(plan).toContainText('Mountain fold');
  await expect(plan).toContainText('Valley fold');
  await expect(page.locator('#precrease .cover .sheet')).toHaveCSS('transform', 'none');
  const results = await new AxeBuilder({ page })
    .include('#precrease')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
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

test('Contact is a postcard that turns over to the Irazú, and back', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-postcard]');
  const front = card.locator('.front');
  const turn = page.getByRole('button', { name: 'See the front' });
  // The postmark's clock: the local time in Costa Rica.
  await expect(card.locator('[data-clock]')).toHaveText(/^\d{1,2}:\d{2}/);
  await expect(front).toHaveJSProperty('inert', true);
  await turn.click();
  await expect(page.getByRole('button', { name: 'See the back' })).toBeVisible();
  await expect(front).toHaveJSProperty('inert', false);
  await expect(card.locator('.back')).toHaveJSProperty('inert', true);
  await expect(page.getByRole('img', { name: /Irazú volcano as contour lines/ })).toBeVisible();
  await page.getByRole('button', { name: 'See the back' }).click();
  await expect(card.getByRole('link', { name: /@/ })).toBeVisible();
});

test('copying the address stamps the postcard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const card = page.locator('[data-postcard]');
  await card.getByRole('button', { name: 'Copy email' }).click();
  await expect(card).toHaveClass(/stamped/);
  await expect(card.locator('.cancel')).toHaveCSS('opacity', '0.9');
});

test('without JavaScript the postcard keeps its address and copy button, and no turn', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  const card = page.locator('[data-postcard]');
  await expect(card.getByRole('link', { name: /@/ })).toHaveAttribute('href', /^mailto:/);
  await expect(page.locator('[data-turn]')).toBeHidden();
  await context.close();
});

test('inspecting names the print layers of the postcard', async ({ page }) => {
  await page.goto('/?inspect');
  const layers = page.locator('[data-postcard] .layer');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(layers).toHaveCount(4);
  for (const layer of await layers.all()) await expect(layer).toBeVisible();
  const results = await new AxeBuilder({ page })
    .include('#contact')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('the footer hangs on a crease with the figure, its last flap in three columns, on every page', async ({
  page,
}) => {
  for (const path of ['/', '/about', '/colophon']) {
    await page.goto(path);
    const footer = page.locator('footer');
    await expect(footer.locator('.crease .origami-mark')).toHaveCount(1);
    await expect(footer.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link')).toHaveCount(
      4,
    );
    await expect(footer.getByRole('navigation', { name: 'Elsewhere' }).getByRole('link')).toHaveCount(3);
    await expect(footer.getByRole('navigation', { name: 'This site' }).getByRole('link')).toHaveCount(3);
    await expect(footer.getByRole('list', { name: 'Language' }).locator('[aria-current]')).toHaveText(
      'English',
    );
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
