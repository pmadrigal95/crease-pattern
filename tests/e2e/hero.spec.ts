import { expect, test } from '@playwright/test';

// The home hero's figure (decision 50): one fold value, reachable by keyboard, and the hero's
// "See how this page is built" opens the same Inspector as the masthead.
test('the fold slider moves with the keyboard and says which side it is on', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Unfold the figure into its crease pattern' });
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

test('the caption says what the end the figure is at means, and switches with the fold', async ({ page }) => {
  await page.goto('/');
  const folded = page.locator('[data-hero-fold] figcaption .folded-say');
  const unfolded = page.locator('[data-hero-fold] figcaption .unfolded-say');
  await expect(folded).toHaveText('What you see on screen.');
  await expect(folded).toHaveCSS('opacity', '1');
  await expect(unfolded).toHaveCSS('opacity', '0');
  await page.getByRole('slider', { name: 'Unfold the figure into its crease pattern' }).focus();
  await page.keyboard.press('End');
  await expect(unfolded).toHaveText('The folds that shape it.');
  await expect(unfolded).toHaveCSS('opacity', '1');
  await expect(folded).toHaveCSS('opacity', '0');
});

test("the byline names the country and links the city's coordinates to a map", async ({ page }) => {
  await page.goto('/es');
  const who = page.locator('.hero .who');
  await expect(who.locator('.name')).toHaveText('Pablo Madrigal');
  await expect(who).toContainText('Costa Rica');
  const city = who.getByRole('link', { name: 'Ver 9.86° N · 83.92° O en un mapa' });
  await expect(city).toHaveAttribute(
    'href',
    /^https:\/\/www\.openstreetmap\.org\/\?mlat=9\.86&mlon=-83\.92#/,
  );
  await expect(city).toHaveAttribute('rel', 'noopener noreferrer');
  expect((await city.boundingBox())?.height).toBeGreaterThanOrEqual(24);
});

test('"See how this page is built" opens the Inspector, which unfolds the figure', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See how this page is built' }).click();
  await expect(page.locator('html')).toHaveClass(/inspecting/);
});

for (const home of ['/', '/es']) {
  test(`${home}: the measured figures are filled in by the build, never left as a placeholder`, async ({
    page,
  }) => {
    await page.goto(home);
    await expect(page.locator('[data-metric="first-load-js"]')).toHaveText(/^\d+\.\d$/);
  });
}
