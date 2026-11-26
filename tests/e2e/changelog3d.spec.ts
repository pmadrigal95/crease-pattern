import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The changelog's 3D relief (src/components/site/ExpeditionRelief.astro, changelog3d.ts): on a wide
// screen whose device can run it, the map's drawing gives way to the places as paper models of
// their real terrain; everyone else keeps the drawing, and downloads nothing for the 3D.
const map = '.expedition';
const ready = { timeout: 20_000 };
const relief3d = /\/_astro\/(changelog3d|three\.module)\.|-dem\.[\w-]+\.bin/;

// CI has no GPU: SwiftShader gives software WebGL2, and these scripts decide what the capability
// check sees (it turns software rendering away on purpose, for real visitors).
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
const open = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/changelog');
};
const range = (page: Page) => page.getByRole('slider', { name: 'Walk the route' });

test('on a capable device the relief replaces the drawing and climbs to now', async ({ page }) => {
  await withGl(page);
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await open(page);
  await expect(page.locator(map)).toHaveClass(/relief-on/, ready);
  await expect(page.locator(`${map} canvas`)).toHaveCount(1);
  await expect(page.locator(`${map} svg.drawing`).first()).toBeHidden();
  await expect(page.getByText(/^Real relief from Copernicus GLO-30/)).toBeVisible();
  // The climb ends on the Irazú, now.
  await expect(range(page)).toHaveValue('1000', ready);
  await expect(page.locator(`${map} [data-era="3"]`)).toBeVisible();
  await expect(page.locator(`${map} [data-era="0"]`)).toBeHidden();
  expect(problems).toEqual([]);
});

test('the slider walks the route from place to place, and says where it is', async ({ page }) => {
  await withGl(page);
  await open(page);
  await expect(range(page)).toHaveValue('1000', ready);
  await range(page).focus();
  await page.keyboard.press('PageDown');
  await expect(page.locator(`${map} [data-relief-live]`)).toHaveText('v2 Turrialba, 3,340 m, 2021 – 2024');
  await expect(page.locator(`${map} [data-era="2"]`)).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.locator(`${map} [data-relief-live]`)).toHaveText(/^v0 Base camp, 1,435 m/);
});

test('each name under the relief goes to its release notes', async ({ page }) => {
  await withGl(page);
  await open(page);
  await expect(page.locator(map)).toHaveClass(/relief-on/, ready);
  const names = page.getByRole('navigation', { name: 'Map of the volcanoes behind each release' });
  await expect(names.getByRole('link')).toHaveCount(4);
  await names.getByRole('link', { name: /^v1 Poás/ }).click();
  await expect(page).toHaveURL(/#release-1$/);
});

test('without WebGL the drawing stays and nothing for the relief downloads', async ({ page }) => {
  await withoutGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await open(page);
  await page.locator(map).scrollIntoViewIfNeeded();
  await expect.poll(() => requested.some((url) => /scene3d-support\./.test(url)), ready).toBe(true);
  await page.waitForTimeout(1_000);
  await expect(page.locator(`${map} svg.drawing.wide`)).toBeVisible();
  await expect(page.locator(`${map} [data-relief]`)).toBeHidden();
  expect(requested.filter((url) => relief3d.test(url))).toEqual([]);
});

test('reduced motion and phones keep the drawing', async ({ browser }) => {
  for (const options of [{ reducedMotion: 'reduce' as const }, { viewport: { width: 375, height: 812 } }]) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await withGl(page);
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto('/changelog');
    await page.locator(map).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    await expect(page.locator(map)).not.toHaveClass(/relief-on/);
    expect(requested.filter((url) => relief3d.test(url))).toEqual([]);
    await context.close();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`the relief has no axe violations · ${theme}`, async ({ page }) => {
    await withGl(page);
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await open(page);
    await expect(range(page)).toHaveValue('1000', ready);
    const results = await new AxeBuilder({ page })
      .include(map)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
