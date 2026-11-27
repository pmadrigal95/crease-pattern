import { expect, test, type Page } from '@playwright/test';

// The hero's pointer effect (src/scripts/hero-pointer.ts, src/lib/pointer-effect.ts): nothing
// downloads until a mouse really moves over the hero; then the surface (by default) or the ink,
// as the visitor chose in the Inspector, draws behind the figure.
const ready = { timeout: 15_000 };
const effectChunks = /\/_astro\/(hero-pointer|pointer-(layer|surface|ink))\./;

// CI has no GPU: SwiftShader gives the browser a software WebGL 2 (see scene3d.spec.ts).
test.describe.configure({ mode: 'default', timeout: 90_000 });
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

const requests = (page: Page) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return () => urls.filter((u) => effectChunks.test(u)).map((u) => u.split('/').pop()?.split('.')[0]);
};
/** A real stroke across the hero's right half: several moves, each with movement. */
const stroke = async (page: Page) => {
  for (const [x, y] of [
    [900, 260],
    [960, 300],
    [1020, 280],
    [1080, 320],
  ] as const)
    await page.mouse.move(x, y, { steps: 4 });
};
const choose = (page: Page, effect: string) =>
  page.addInitScript((value) => localStorage.setItem('pm.pointer', value), effect);

test('nothing downloads before a mouse really moves over the hero', async ({ page }) => {
  const loaded = requests(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // What the browser sends when the page changes under a resting pointer: no movement.
  await page.evaluate(() =>
    document.querySelector('.hero')?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true })),
  );
  await page.waitForTimeout(500);
  expect(loaded()).toEqual([]);
});

test('by default the surface takes over from the still texture', async ({ page }) => {
  const loaded = requests(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await stroke(page);
  await stroke(page);
  await expect(page.locator('.hero > canvas.pointer-layer.surface')).toHaveCount(1, ready);
  // The still surface steps aside only once the canvas has drawn its first frame.
  await expect
    .poll(
      () =>
        page
          .locator('.hero')
          .evaluate((el) => (el as HTMLElement).style.getPropertyValue('--surface-strength')),
      ready,
    )
    .toBe('0');
  expect(loaded()).not.toContain('pointer-ink');
});

test('the move that downloads the effect is enough to start it', async ({ page }) => {
  // On a slow connection the effect's script arrives after the hand has stopped: that move counts.
  await page.route(/\/_astro\/hero-pointer\./, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await stroke(page);
  await expect(page.locator('.hero > canvas.pointer-layer.surface')).toHaveCount(1, ready);
});

test('the Inspector switches the effect, and the choice is remembered', async ({ browser }) => {
  // Reduced motion keeps the 3D figure off, so this test drives only the pointer effect.
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('[data-inspector-toggle]').click();
  const group = page.getByRole('group', { name: 'Pointer effect' });
  // Reduced motion and no choice yet: off.
  await expect(group.getByRole('radio', { name: 'Off' })).toBeChecked();
  await group.getByText('Ink').click();
  expect(await page.evaluate(() => localStorage.getItem('pm.pointer'))).toBe('ink');
  await page.keyboard.press('Escape');
  await stroke(page);
  await stroke(page);
  await expect(page.locator('.hero > canvas.pointer-layer.ink')).toHaveCount(1, ready);

  await page.reload();
  await page.locator('[data-inspector-toggle]').click();
  await expect(
    page.getByRole('group', { name: 'Pointer effect' }).getByRole('radio', { name: 'Ink' }),
  ).toBeChecked();
  await context.close();
});

test('reduced motion keeps the hero still, unless the visitor chose an effect', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await stroke(page);
  await stroke(page);
  await page.waitForTimeout(500);
  await expect(page.locator('.hero > canvas.pointer-layer')).toHaveCount(0);

  await choose(page, 'surface');
  await page.reload();
  await stroke(page);
  await stroke(page);
  await expect(page.locator('.hero > canvas.pointer-layer.surface')).toHaveCount(1, ready);
  await context.close();
});

test('"Off" keeps the hero still and downloads no effect', async ({ page }) => {
  await choose(page, 'off');
  const loaded = requests(page);
  await page.goto('/');
  await stroke(page);
  await stroke(page);
  await page.waitForTimeout(500);
  await expect(page.locator('.hero > canvas.pointer-layer')).toHaveCount(0);
  expect(loaded().filter((n) => n !== 'hero-pointer')).toEqual([]);
});

test('the effects raise no Content Security Policy or script errors', async ({ browser }) => {
  for (const effect of ['surface', 'ink']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' || /Pointer effect unavailable/.test(m.text())) errors.push(m.text());
    });
    await choose(page, effect);
    await page.goto('/');
    await stroke(page);
    await stroke(page);
    await expect(page.locator(`.hero > canvas.pointer-layer.${effect}`)).toHaveCount(1, ready);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('the Inspector shows the control only on the home page, where it acts', async ({ page }) => {
  for (const [path, count] of [
    ['/', 1],
    ['/es', 1],
    ['/about', 0],
    ['/work', 0],
  ] as const) {
    await page.goto(path);
    await page.locator('[data-inspector-toggle]').click();
    await expect(page.locator('#pm-inspector')).toBeVisible(ready);
    await expect(page.locator('input[name="inspector-pointer"]')).toHaveCount(count * 3);
  }
});
