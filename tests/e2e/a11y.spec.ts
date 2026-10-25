import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { allVisualDirections } from '../../src/config/visual-direction';

// Every page must pass axe in all 3 identities × 2 themes.
const pages = ['/', '/changelog', '/about', '/colophon', '/this-page-does-not-exist'];

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

for (const path of pages) {
  test(`${path} has no horizontal overflow on a 375px phone`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}

for (const path of pages) {
  test(`${path} runs with no Content Security Policy violations`, async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        console.error(`Content Security Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });
}

test('an unknown URL answers 404 with a way home', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to the home page' })).toBeVisible();
});

test('the main navigation marks the current page', async ({ page }) => {
  await page.goto('/changelog');
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Changelog' }),
  ).toHaveAttribute('aria-current', 'page');
});
