import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// M4's 3D fox (src/components/inspector/scene3d.ts): opening the Inspector on the home page hands
// the hero's square to a WebGL scene on devices that can run it, and back to the SVG on close.
const panel = '#inspector';
const canvas = '[data-hero-fold] [data-stage] canvas';
// SwiftShader renders on the CPU, so on a busy runner the scene's first frame, and the pages
// around it, can take a few seconds.
const sceneReady = { timeout: 15_000 };

// CI has no GPU. SwiftShader gives the browser a software WebGL2, and the init script lets the
// capability check accept it (it turns software rendering away on purpose, for real visitors).
// One worker for this file: several software-rendered scenes at once can starve SwiftShader, and
// then the capability check rightly falls back to the SVG.
test.describe.configure({ mode: 'default' });
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });
const allowSoftwareGl = (page: Page) =>
  page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: Record<string, unknown>,
    ) {
      return getContext.call(this, type, { ...options, failIfMajorPerformanceCaveat: false });
    } as typeof getContext;
  });

test('inspecting on a capable device hands the hero to the 3D fox, and closing hands it back', async ({
  page,
}) => {
  await allowSoftwareGl(page);
  await page.goto('/');
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await expect(page.locator(canvas)).toHaveCount(1, sceneReady);
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  await expect(page.locator(canvas)).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-hero-fold]')).not.toHaveClass(/scene-3d/, sceneReady);
  await expect(page.locator(canvas)).toHaveCount(0);
});

test('reduced motion keeps the SVG fox and never downloads the scene', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/?inspect');
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(canvas)).toHaveCount(0);
  expect(requested.filter((url) => /\/_astro\/scene3d\./.test(url))).toEqual([]);
  await context.close();
});

test('a page without the hero fox never downloads the scene', async ({ page }) => {
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/about?inspect');
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await page.waitForLoadState('networkidle');
  expect(requested.filter((url) => /\/_astro\/scene3d\./.test(url))).toEqual([]);
});

test('the 3D scene raises no Content Security Policy violations', async ({ page }) => {
  await allowSoftwareGl(page);
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.goto('/?inspect');
  await expect(page.locator(canvas)).toHaveCount(1, sceneReady);
  await page.waitForLoadState('networkidle');
  expect(violations).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`the home page with the 3D fox has no axe violations · ${theme}`, async ({ page }) => {
    await allowSoftwareGl(page);
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await page.goto('/?inspect');
    await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.timeline instanceof DocumentTimeline)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
