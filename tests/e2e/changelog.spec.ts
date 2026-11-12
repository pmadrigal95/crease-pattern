import { expect, test } from '@playwright/test';

// The changelog page (design debt phase 2): the map of the volcanoes is the page's navigation.
// Each summit is a link to its release notes, reachable with the keyboard.
test('each summit on the map goes to its release notes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/changelog');
  const map = page.getByRole('group', { name: 'Map of the volcanoes behind each release' });
  const pins = map.getByRole('link');
  await expect(pins).toHaveCount(4);

  const turrialba = map.getByRole('link', { name: /^v2 Turrialba, 3,340 m, 2021 – 2024\./ });
  await turrialba.focus();
  await expect(turrialba).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#release-2$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Turrialba' })).toBeInViewport();
});

test('on a phone the map keeps every summit and its link', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/changelog');
  const map = page.getByRole('group', { name: 'Map of the volcanoes behind each release' });
  await expect(map.getByRole('link')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
