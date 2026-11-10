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
