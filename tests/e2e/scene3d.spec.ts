import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The hero's 3D figure (src/scripts/hero3d.ts, src/components/inspector/scene3d.ts): on devices
// that can run it, the hero's square turns 3D at the visitor's first move; the Inspector takes the
// same scene apart.
const panel = '#inspector';
const canvas = '[data-hero-fold] [data-stage] canvas';
// SwiftShader renders on the CPU, so on a busy runner the scene's first frame, and the pages
// around it, can take a few seconds.
const sceneReady = { timeout: 15_000 };

// CI has no GPU. SwiftShader gives the browser a software WebGL2, and the init script lets the
// capability check accept it (it turns software rendering away on purpose, for real visitors).
// One at a time with the other software-GL specs (the software-gl project, playwright.config.ts):
// several software-rendered scenes at once can starve SwiftShader, and then the scene rightly falls
// back to the SVG.
// Software WebGL is slow, more so with the hero's scene and the Work star on one page: a longer
// limit for these tests only.
test.describe.configure({ mode: 'default', timeout: 90_000 });
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

const sceneRequests = (urls: string[]) => urls.filter((url) => /\/_astro\/(scene3d|irazu-dem)\./.test(url));

test('the hero stays an SVG until the visitor moves, then turns 3D', async ({ page }) => {
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(sceneRequests(requested)).toEqual([]);
  await expect(page.locator(canvas)).toHaveCount(0);
  await expect(page.getByText('Drag to turn it')).toBeHidden();

  await page.mouse.move(200, 200);
  await page.mouse.move(240, 260);
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  await expect(page.locator(canvas)).toHaveCount(1);
  await expect(page.getByText('Drag to turn it')).toBeVisible();
});

test('a pointermove without movement is not the visitor moving', async ({ page }) => {
  // What the browser sends when the page changes under a resting pointer (it made CI flaky).
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 })));
  await page.waitForTimeout(500);
  expect(sceneRequests(requested)).toEqual([]);
});

test('the slider folds the 3D figure, from the keyboard too', async ({ page }) => {
  await allowSoftwareGl(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // Two moves: a page's first pointermove reports no movement, so it doesn't count as moving.
  await page.mouse.move(200, 200);
  await page.mouse.move(240, 260);
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  const slider = page.getByRole('slider', { name: 'Unfold the figure into its crease pattern' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  const fold = () =>
    page.locator('[data-hero-fold]').evaluate((el) => (el as HTMLElement).style.getPropertyValue('--fold'));
  await expect.poll(fold).toBe('1.000');
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/);
  expect(errors).toEqual([]);
});

test('with data saver on, the hero keeps the SVG and never downloads the scene', async ({ page }) => {
  await allowSoftwareGl(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true }),
  );
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/');
  await page.mouse.move(200, 200);
  await page.mouse.wheel(0, 200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(canvas)).toHaveCount(0);
  expect(sceneRequests(requested)).toEqual([]);
});

test("inspecting takes the hero's 3D figure apart, and closing puts it back together", async ({ page }) => {
  await allowSoftwareGl(page);
  await page.goto('/');
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await expect(page.locator(canvas)).toHaveCount(1, sceneReady);
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  await expect(page.locator(canvas)).toHaveAttribute('aria-hidden', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/inspecting/);
  // The figure stays 3D in the hero: one scene per page, never rebuilt.
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/);
  await expect(page.locator(canvas)).toHaveCount(1);
});

test('changing identity while inspecting exchanges the scene in the same canvas', async ({ page }) => {
  await allowSoftwareGl(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || /3D scene unavailable/.test(m.text())) errors.push(m.text());
  });
  await page.goto('/?inspect');
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  for (const name of ['Basalt & glacier', 'Washi & asagi', 'Contour lines']) {
    await page.getByRole('radio', { name }).check();
    await expect(page.locator(canvas)).toHaveCount(1);
    await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/);
  }
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.waitForTimeout(2_000); // the last exchange settles
  expect(errors).toEqual([]);
});

test('reduced motion keeps the SVG figure and never downloads the scene', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/?inspect');
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await page.mouse.move(200, 200);
  await page.waitForLoadState('networkidle');
  await expect(page.locator(canvas)).toHaveCount(0);
  expect(sceneRequests(requested)).toEqual([]);
  await context.close();
});

test('a page without the hero figure never downloads the scene', async ({ page }) => {
  await allowSoftwareGl(page);
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/about?inspect');
  await expect(page.locator(panel)).toBeVisible(sceneReady);
  await page.mouse.move(200, 200);
  await page.waitForLoadState('networkidle');
  expect(sceneRequests(requested)).toEqual([]);
});

test('Contour lines draws the Irazú from its real height grid', async ({ page }) => {
  await allowSoftwareGl(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (/Irazú heights unavailable|3D scene unavailable/.test(m.text())) warnings.push(m.text());
  });
  const grid = page.waitForResponse((r) => /\/_astro\/irazu-dem\.[\w-]+\.bin$/.test(r.url()), sceneReady);
  await page.goto('/?inspect');
  const response = await grid;
  expect(response.status()).toBe(200);
  expect((await response.body()).byteLength).toBe(161 * 161 * 2);
  await expect(page.locator('[data-hero-fold]')).toHaveClass(/scene-3d/, sceneReady);
  await page.waitForTimeout(2_000);
  expect(warnings).toEqual([]);
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
  test(`the home page with the 3D figure has no axe violations · ${theme}`, async ({ page }) => {
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
