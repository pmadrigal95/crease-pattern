import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The Work section's Sonobe star (src/components/site/WorkModel.astro, M4.3): drawn at build time,
// it assembles as the section scrolls into view, in three.js where the device can run it and in
// SVG everywhere else, and comes apart with the count while the Inspector is open.
const figure = '[data-work-model]';
const counts = `${figure} .counts`;
const ready = { timeout: 15_000 };

// CI has no GPU: SwiftShader gives software WebGL2, and these scripts decide what the capability
// check sees (it turns software rendering away on purpose, for real visitors).
// Software WebGL is slow, more so with the hero's scene and the Work star on one page: a longer
// limit for these tests only.
test.describe.configure({ mode: 'default', timeout: 90_000 });
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
const withGl = (page: Page) =>
  page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: object,
    ) {
      return getContext.call(this, type, { ...options, failIfMajorPerformanceCaveat: false });
    } as typeof getContext;
  });
const withoutGl = (page: Page) =>
  page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: object,
    ) {
      return type === 'webgl2' ? null : getContext.call(this, type, options);
    } as typeof getContext;
  });
const homeOnly = /\/_astro\/(work-model|work3d|three\.module)\./;
const toWork = async (page: Page) => {
  await page.mouse.wheel(0, 40); // the first scroll lets the loader start
  await page.locator(figure).scrollIntoViewIfNeeded();
};

test('without JavaScript the star is drawn, labelled, with its count in the page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('img', { name: /Sonobe star/ })).toBeVisible();
  expect(await page.locator(`${figure} polygon`).count()).toBeGreaterThan(20);
  await expect(page.locator(counts)).toHaveCount(1);
  await context.close();
});

test('nothing for the star downloads before the visitor scrolls', async ({ page }) => {
  await withGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(requested.filter((url) => homeOnly.test(url))).toEqual([]);
});

test('on a capable device the star assembles in 3D, comes apart with the Inspector, and back', async ({
  page,
}) => {
  await withGl(page);
  await page.goto('/');
  await toWork(page);
  await expect(page.locator(`${figure} canvas`)).toHaveCount(1, ready);
  await expect(page.locator(figure)).toHaveClass(/scene-3d/, ready);
  await expect(page.locator(counts)).toBeHidden();

  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator(counts)).toBeVisible(ready);
  await expect(page.locator(counts)).toContainText(/components\s*\d+/);
  await page.keyboard.press('Escape');
  await expect(page.locator(counts)).toBeHidden(ready);
});

test('without WebGL the star assembles in SVG and never downloads three.js', async ({ page }) => {
  await withoutGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await toWork(page);
  await expect.poll(() => requested.some((url) => /\/_astro\/work-model\./.test(url)), ready).toBe(true);
  await page.waitForTimeout(3_000); // the assembly finishes
  expect(await page.locator(`${figure} polygon`).count()).toBeGreaterThan(20);
  await expect(page.locator(`${figure} canvas`)).toHaveCount(0);
  expect(requested.filter((url) => /\/_astro\/(work3d|three\.module)\./.test(url))).toEqual([]);
});

test('reduced motion keeps the star assembled and still, in SVG', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await withGl(page);
  await page.goto('/');
  const before = await page.locator(`${figure} polygon`).count();
  await toWork(page);
  await page.waitForTimeout(1_000);
  expect(await page.locator(`${figure} polygon`).count()).toBe(before);
  await expect(page.locator(`${figure} canvas`)).toHaveCount(0);
  await context.close();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the Work section, star apart and count shown, has no axe violations · ${theme}`, async ({ page }) => {
    await withGl(page);
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await page.goto('/');
    await toWork(page);
    await expect(page.locator(figure)).toHaveClass(/scene-3d/, ready);
    await page.locator('[data-inspector-toggle]').click();
    await expect(page.locator(counts)).toBeVisible(ready);
    await page.waitForTimeout(1_000);
    const results = await new AxeBuilder({ page })
      .include('#work')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
