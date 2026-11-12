import { expect, test } from '@playwright/test';

// The home hero's fox (decision 50): one fold value, reachable by keyboard, and the hero's
// "See how this page is built" opens the same Inspector as the masthead.
test('the fold slider moves with the keyboard and says which side it is on', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Unfold the fox into its crease pattern' });
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '100');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Unfolded: the crease pattern');
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '90');
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Folded: the interface');
});

test('"See how this page is built" opens the Inspector, which unfolds the fox', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See how this page is built' }).click();
  await expect(page.locator('html')).toHaveClass(/inspecting/);
});

test('the measured figures are filled in by the build, never left as a placeholder', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-metric="first-load-js"]')).toHaveText(/^\d+\.\d$/);
});
