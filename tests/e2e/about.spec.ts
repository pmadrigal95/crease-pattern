import { expect, test, type Page } from '@playwright/test';

// About's folded portrait (FoldedPortrait.astro, doc 35): on a wide screen, reading the story
// unfolds it from the photo to the contour lines; the handle takes it over; reduced motion keeps
// it still at rest.
const handle = (page: Page) => page.getByRole('slider', { name: 'Fold the portrait' });
const fold = async (page: Page) => Number(await handle(page).getAttribute('aria-valuenow'));
const wide = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/about');
};

test('reading the story unfolds the portrait, and the caption reads the split', async ({ page }) => {
  await wide(page);
  await expect(page.locator('[data-folded-portrait]')).toHaveClass(/is-reading/);
  const top = await fold(page);
  await page.mouse.wheel(0, 1600);
  await expect.poll(() => fold(page)).toBeLessThan(top - 20);
  const now = await fold(page);
  await expect(page.locator('[data-fold-value]')).toHaveText(`${now}% photo, ${100 - now}% contour lines`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test('the tab stays inside the portrait from the top of the story to its end', async ({ page }) => {
  await wide(page);
  const frame = (await page.locator('[data-folded-portrait]').boundingBox())!;
  for (const y of [0, 600, 1200, 2400, 6000]) {
    await page.evaluate((to) => scrollTo(0, to), y);
    await page.waitForTimeout(250);
    const tab = (await handle(page).boundingBox())!;
    const box = (await page.locator('[data-folded-portrait]').boundingBox())!;
    expect(tab.x).toBeGreaterThanOrEqual(box.x - 1);
    expect(tab.y).toBeGreaterThanOrEqual(box.y - 1);
    expect(tab.x + tab.width).toBeLessThanOrEqual(box.x + frame.width + 1);
    expect(tab.y + tab.height).toBeLessThanOrEqual(box.y + frame.height + 1);
  }
});

test('the handle takes the fold from the story', async ({ page }) => {
  await wide(page);
  await handle(page).focus();
  await page.keyboard.press('Home');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '15');
  await expect(page.locator('[data-folded-portrait]')).not.toHaveClass(/is-reading/);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(400);
  expect(await fold(page)).toBe(15);
});

test('reduced motion keeps the portrait at rest, and still movable', async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  await page.goto('/about');
  await expect(page.locator('[data-folded-portrait]')).not.toHaveClass(/is-reading/);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(400);
  expect(await fold(page)).toBe(39);
  await handle(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '43');
  await context.close();
});

test('the principles are cards, and Elsewhere is left to the footer', async ({ page }) => {
  await wide(page);
  const story = page.locator('.prose');
  await expect(story.locator('ul > li')).toHaveCount(5);
  await expect(story.getByRole('heading', { name: 'Elsewhere' })).toHaveCount(0);
  await expect(story.locator('.trail h2')).toHaveText('Away from the keyboard');
});

test('once in view the portrait hints at its second layer, then reading takes over', async ({ page }) => {
  await wide(page);
  const portrait = page.locator('[data-folded-portrait]');
  await expect(portrait).toHaveClass(/is-hinting/);
  // Mid-sweep the fold has moved toward the contours.
  await expect
    .poll(async () =>
      Number(await portrait.evaluate((el) => getComputedStyle(el).getPropertyValue('--fold'))),
    )
    .toBeLessThan(70);
  await expect(portrait).toHaveClass(/is-reading/, { timeout: 4000 });
  await expect(portrait).not.toHaveClass(/is-hinting/);
});

test('on a phone the portrait opens when it is reached, not while the page loads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about');
  const portrait = page.locator('[data-folded-portrait]');
  await page.waitForTimeout(600);
  await expect(portrait).not.toHaveClass(/is-opening/);
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toHaveClass(/is-opening/);
  await expect(handle(page)).toHaveAttribute('aria-valuenow', '39', { timeout: 4000 });
});
