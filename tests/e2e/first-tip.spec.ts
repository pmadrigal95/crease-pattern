import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// First-visit help (src/components/site/first-tip.ts): once per visitor, after their first
// interaction. On the home page the walkthrough starts on its own, quietly; anywhere else a tip
// beside Inspect offers it. Neither takes focus.
const ready = { timeout: 15_000 };
const tip = '.cm-card';
// A first visit: nothing remembered (the suite's other files start with the tip already seen).
test.use({ storageState: { cookies: [], origins: [] } });

test('nothing shows before the visitor does anything', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  await expect(page.locator(tip)).toHaveCount(0);
});

test('after the first interaction it points at Inspect, without taking focus, and only once', async ({
  page,
}) => {
  await page.goto('/about');
  await page.mouse.wheel(0, 300);
  await expect(page.locator(tip)).toBeVisible(ready);
  await expect(page.locator(tip)).toContainText('See how this site is built');
  await expect(page.locator(`${tip} h2`)).not.toBeFocused();
  await expect(page.locator('.cm-ring')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('pm.tips'))).toBe('1');
  await page.getByRole('button', { name: 'Not now' }).click();
  await expect(page.locator(tip)).toHaveCount(0);

  await page.goto('/work');
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(3000);
  await expect(page.locator(tip)).toHaveCount(0);
});

test('on the home page the walkthrough starts on its own, quietly, and can be skipped', async ({ page }) => {
  await page.goto('/');
  await page.mouse.wheel(0, 120);
  await expect(page.locator(tip)).toContainText('1 of 7', ready);
  await expect(page.locator('.cm-ring')).toHaveCount(1);
  await expect(page.locator(`${tip} h2`)).not.toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('pm.tips'))).toBe('1');
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator(tip)).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('pm.walkthrough'))).toBeNull();
});

test('"Take the walkthrough" starts it at its first stop', async ({ page }) => {
  await page.goto('/work');
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Take the walkthrough' }).click(ready);
  await expect(page.locator(tip)).toContainText('1 of 7', ready);
  await expect(page.locator(`${tip} h2`)).toHaveText('The figure is the interface');
});

test('the tip has no axe violations, in Spanish too', async ({ page }) => {
  await page.goto('/es/about');
  await page.mouse.wheel(0, 200);
  await expect(page.locator(tip)).toContainText('Mira cómo está hecho este sitio', ready);
  // Measure the card as it rests, not while it unfolds in.
  await page
    .locator(tip)
    .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
  const results = await new AxeBuilder({ page })
    .include(tip)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
