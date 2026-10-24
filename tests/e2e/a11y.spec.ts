import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { allVisualDirections } from '../../src/config/visual-direction';

// Every page must pass axe in all 3 identities × 2 themes.
const pages = ['/'];

for (const path of pages) {
  for (const direction of allVisualDirections) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${path} has no axe violations · ${direction} · ${theme}`, async ({ page }) => {
        await page.addInitScript(
          ([d, t]) => {
            localStorage.setItem('pm.direction', d);
            localStorage.setItem('pm.theme', t);
          },
          [direction, theme] as const,
        );
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-direction', direction);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
}

test('the page has no horizontal overflow on a 375px phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
