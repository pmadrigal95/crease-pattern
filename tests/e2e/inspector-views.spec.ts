import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

// The Inspector's views (src/components/inspector/use-views.ts, fold.ts): the page folded like a
// Miura-ori, its gestures, and its crease pattern drawn and downloadable.
test.describe.configure({ timeout: 60_000 });

const open = async (page: Page, path = '/') => {
  await page.goto(path);
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#pm-inspector')).toBeVisible();
};
const choose = (page: Page, name: 'Layers' | 'Fold' | 'Pattern') =>
  page.getByRole('radio', { name, exact: true }).check();
/** The page's top-level parts: one panel each when folded. */
const sections = (page: Page) => page.locator('.fold-section');
const settled = (page: Page) => expect(page.locator('html')).toHaveClass(/fold-settled/, { timeout: 5_000 });

test('the folded views load only when picked, and the tour waits for them', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await open(page);
  await page.waitForLoadState('networkidle');
  expect(requested.filter((url) => /\/_astro\/fold\.[\w-]+\.js$/.test(url))).toEqual([]);
  const tour = page.getByRole('button', { name: 'Walk through' });
  await expect(tour).toBeDisabled();

  await choose(page, 'Fold');
  await expect(page.locator('.fold-stage')).toHaveCount(1);
  expect(requested.some((url) => /\/_astro\/fold\.[\w-]+\.js$/.test(url))).toBe(true);
  await expect(tour).toBeEnabled();
});

test('folded, every section is a panel with its name, and every crease opens and closes', async ({
  page,
}) => {
  await open(page);
  await choose(page, 'Fold');
  await settled(page);
  const count = await sections(page).count();
  expect(count).toBeGreaterThan(3);
  await expect(page.locator('.fold-label')).toHaveCount(count);
  const creases = page.locator('.fold-crease');
  await expect(creases).toHaveCount(count - 1);

  const first = creases.first();
  await expect(first).toHaveAccessibleName(/^Open this crease: /);
  await first.click();
  await settled(page);
  await expect(page.locator('.fold-crease').first()).toHaveClass(/open/);
  await expect(page.locator('.fold-crease').first()).toHaveAccessibleName(/^Close this crease: /);
});

test('keys fold the page closer and R brings it back', async ({ page }) => {
  await open(page);
  await choose(page, 'Fold');
  await settled(page);
  const second = sections(page).nth(1);
  const rest = await second.evaluate((el) => el.style.transform);
  // Focus on the table, outside the panel: inside it, arrows belong to the panel's own controls.
  await page.locator('.fold-stage').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => second.evaluate((el) => el.style.transform)).not.toBe(rest);
  await page.keyboard.press('r');
  await expect.poll(() => second.evaluate((el) => el.style.transform)).toBe(rest);
});

test('dragging the folded page turns it without pinning the section under the pointer', async ({ page }) => {
  await open(page);
  await choose(page, 'Fold');
  await settled(page);
  const box = (await sections(page).nth(2).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('.fold-section.fold-current')).toHaveCount(0);
});

test('the pattern draws the page, names its parts and answers the pointer', async ({ page }) => {
  await open(page);
  await choose(page, 'Pattern');
  await settled(page);
  await expect(page.locator('.fold-ink .sheet')).toHaveCount(1);
  const parts = page.locator('.fold-ink .part');
  expect(await parts.count()).toBeGreaterThan(0);
  await expect(page.locator('.fold-ink .mountain').first()).toBeAttached();
  await expect(page.locator('.fold-ink .valley').first()).toBeAttached();
  await expect(page.locator('.fold-dim').first()).toHaveText(/^\d+ px$/);

  const box = (await parts.first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.fold-tag')).toHaveClass(/on/);
  await expect(page.locator('.fold-tag')).toContainText(/\d+ lines · \d+ tokens/);
});

test('the downloaded pattern is a standalone SVG in print colours any viewer reads', async ({ page }) => {
  await open(page);
  await choose(page, 'Pattern');
  await settled(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download the pattern (SVG)' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('crease-pattern-home.svg');
  const svg = readFileSync((await download.path())!, 'utf8');
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  expect(svg).toContain('fill="#ffffff"');
  // Only plain colours: no CSS variables, no colour functions a viewer might not know.
  expect(svg).not.toMatch(/var\(|oklch|color-mix/);
});

test('closing the Inspector unfolds the page back where the visitor left it', async ({ page }) => {
  await page.goto('/');
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#pm-inspector')).toBeVisible();
  const before = await page.evaluate(() => scrollY);
  await choose(page, 'Fold');
  await settled(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.fold-stage')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('html')).not.toHaveClass(/fold-on/);
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await expect(page.locator('main')).toBeVisible();
});

test('back to layers, the folded stage is gone', async ({ page }) => {
  await open(page);
  await choose(page, 'Fold');
  await settled(page);
  await choose(page, 'Layers');
  await expect(page.locator('.fold-stage')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('html')).toHaveClass(/inspector-3d/);
});

test('phones keep the flat outline: no folded views', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await open(page);
  await expect(page.getByRole('radio', { name: 'Fold', exact: true })).toHaveCount(0);
  await context.close();
});

for (const view of ['Fold', 'Pattern'] as const) {
  test(`the ${view.toLowerCase()} view has no axe violations`, async ({ page }) => {
    await open(page);
    await choose(page, view);
    await settled(page);
    await page.waitForTimeout(1_600); // the pattern draws itself in
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
