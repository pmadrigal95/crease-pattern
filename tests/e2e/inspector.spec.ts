import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The Inspector (decision 44, M2a): opened with Shift+I, the Inspect button or ?inspect.
const panel = '#inspector';
const toggle = '[data-inspector-toggle]';

test('Shift+I opens the Inspector, moves focus in, and Esc returns it', async ({ page }) => {
  await page.goto('/about');
  await page.locator(toggle).focus();
  await page.keyboard.press('Shift+I');
  await expect(page.locator(panel)).toBeVisible();
  await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(`${panel} h2`)).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator(panel)).toHaveCount(0);
  await expect(page.locator(toggle)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(toggle)).toBeFocused();
});

test('clicking a part pins it and shows where it comes from, without following links', async ({ page }) => {
  await page.goto('/about');
  await page.locator(toggle).click();
  // The page makes room for the panel, so every part stays clickable while inspecting.
  await page.locator('[data-inspect="FoldedPortrait"] figcaption').click();
  await expect(page).toHaveURL(/\/about$/);
  const details = page.locator(`${panel} .facts`);
  await expect(details).toContainText('FoldedPortrait');
  await expect(details.getByRole('link', { name: 'View source' })).toHaveAttribute(
    'href',
    /github\.com\/pmadrigal95\/crease-pattern\/blob\/.+\/src\/components\/site\/FoldedPortrait\.astro$/,
  );
  await expect(page.locator(`${panel} [role="status"]`)).toHaveText('Selected FoldedPortrait');
});

test('arrow keys move through the layers and Enter pins one', async ({ page }) => {
  await page.goto('/');
  await page.locator(toggle).click();
  const layers = page.locator(`${panel} .layers button`);
  await layers.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(layers.nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(layers.nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('?inspect opens the Inspector on load', async ({ page }) => {
  await page.goto('/changelog?inspect');
  await expect(page.locator(panel)).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the open Inspector has no axe violations · ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await page.goto('/about?inspect');
    await expect(page.locator(panel)).toBeVisible();
    await page.locator('[data-inspect="FoldedPortrait"] figcaption').click();
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

test('opening the Inspector raises no Content Security Policy violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await page.goto('/about?inspect');
  await expect(page.locator(panel)).toBeVisible();
  await page.locator('[data-inspect="FoldedPortrait"] figcaption').click();
  await page.waitForLoadState('networkidle');
  expect(violations).toEqual([]);
});

test('on wide screens the page tilts into layers, nested parts sit higher, and closing settles it', async ({
  page,
}) => {
  await page.goto('/?inspect');
  await expect(page.locator('html')).toHaveClass(/inspector-3d/);
  await expect(page.locator('main')).not.toHaveCSS('transform', 'none');
  await expect(page.locator('[data-inspect="index#hero"]')).toHaveAttribute('style', /--layer-depth:\s*1/);
  await expect(page.locator('[data-inspect="ReleaseSummary"]')).toHaveAttribute(
    'style',
    /--layer-depth:\s*2/,
  );

  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/inspector-3d/);
  await expect(page.locator('.layer-path')).toHaveCount(0);
});

test('reduced motion keeps the Inspector flat', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/?inspect');
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/inspector-3d/);
  await expect(page.locator('main')).toHaveCSS('transform', 'none');
  await context.close();
});

test('phones keep the Inspector flat', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/?inspect');
  await expect(page.locator('#inspector')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/inspector-3d/);
});

test('the Identity switcher applies a direction and a theme, and remembers them', async ({ page }) => {
  await page.goto('/?inspect');
  await page.getByRole('radio', { name: 'Washi & asagi' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-direction', 'washi-asagi');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(
    await page.evaluate(() => [localStorage.getItem('pm.direction'), localStorage.getItem('pm.theme')]),
  ).toEqual(['washi-asagi', 'dark']);

  // restore-identity.js brings the choice back before the next page paints.
  await page.goto('/about');
  await expect(page.locator('html')).toHaveAttribute('data-direction', 'washi-asagi');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // Back to System forgets the theme instead of storing a default.
  await page.goto('/about?inspect');
  await page.getByRole('radio', { name: 'System' }).check();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(() => localStorage.getItem('pm.theme'))).toBeNull();
});
