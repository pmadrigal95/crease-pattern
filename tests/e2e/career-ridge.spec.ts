import { expect, test } from '@playwright/test';

// The home page's changelog as a paper ridge (src/components/site/AltitudeProfile.astro): one
// volcano per release, a route along the skyline, and the release the route is on shown above.
const figure = '[data-ridge]';
const head = (major: number) => `${figure} [data-era="${major}"]`;

test('without JavaScript the ridge is complete: the current release shown, the climb said in words', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator(head(3))).toBeVisible();
  await expect(page.locator(head(3))).toContainText('3,432');
  for (const major of [0, 1, 2]) await expect(page.locator(head(major))).toBeHidden();
  await expect(page.locator(`${figure} svg.wide .peak`)).toHaveCount(4);
  await expect(page.locator(`${figure} svg.wide`)).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator(`${figure} figcaption`)).toContainText('Irazú');
  await context.close();
});

test('the arrow keys walk the route from volcano to volcano, and say where it is', async ({ page }) => {
  await page.goto('/');
  const stage = page.getByRole('group', {
    name: 'My career, volcano by volcano. Use the arrow keys to walk it.',
  });
  await stage.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator(head(2))).toBeVisible();
  await expect(page.locator(head(2))).toContainText('Turrialba');
  await expect(page.locator(head(3))).toBeHidden();
  await expect(page.locator(`${figure} [data-live]`)).toContainText('Turrialba');
  await expect(page.locator(`${figure} svg.wide .peak.on`)).toHaveAttribute('data-major', '2');
  await page.keyboard.press('Home');
  await expect(page.locator(head(0))).toBeVisible();
  await page.keyboard.press('End');
  await expect(page.locator(head(3))).toBeVisible();
});

test('pointing along the route walks it there, and leaving goes back to now', async ({ page }) => {
  await page.goto('/');
  const svg = page.locator(`${figure} svg.wide`);
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  const walked = page.locator(`${figure} svg.wide [data-walked]`);
  const full = Number(await walked.getAttribute('width'));
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
  await expect(page.locator(head(0))).toBeVisible();
  expect(Number(await walked.getAttribute('width'))).toBeLessThan(full / 2);
  await page.mouse.move(box.x + box.width / 2, box.y - 200);
  await expect(page.locator(head(3))).toBeVisible();
  await expect.poll(async () => Number(await walked.getAttribute('width'))).toBeCloseTo(full, 0);
});

test('on a phone the narrow drawing is the one shown, and the page does not widen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.locator(`${figure} svg.narrow`)).toBeVisible();
  await expect(page.locator(`${figure} svg.wide`)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});

test('inspecting shows the ridge as built: every height annotated, every fold and contour', async ({
  page,
}) => {
  await page.goto('/');
  const plan = page.locator(`${figure} svg.wide .plan`);
  await expect(plan).toHaveCSS('opacity', '0');
  await page.keyboard.press('Shift+I');
  await expect(page.locator('html')).toHaveClass(/inspecting/);
  await expect.poll(() => plan.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect(plan.locator('line')).toHaveCount(3); // 1,000, 2,000 and 3,000 m
  await expect(plan.locator('.height')).toHaveText(['1,435 m', '2,708 m', '3,340 m', '3,432 m']);
  await expect(page.locator(`${figure} svg.wide .contours line`).first()).toBeVisible();
});

for (const [direction, ice, snow] of [
  ['basalt-glacier', 2, 0],
  ['washi-asagi', 0, 3],
  ['contour-lines', 0, 0],
] as const) {
  test(`${direction} draws its own landscape over the same volcanoes and heights`, async ({ page }) => {
    await page.addInitScript((d) => localStorage.setItem('pm.direction', d), direction);
    await page.goto('/');
    const svg = page.locator(`${figure} svg.wide`);
    await expect(svg.locator('.ice:visible')).toHaveCount(ice); // glaciers above 3,000 m
    await expect(svg.locator('.snow:visible')).toHaveCount(snow); // a woodblock snow cap
    await expect(svg.locator('.name')).toHaveText(['Base camp', 'Poás', 'Turrialba', 'Irazú']);
    await expect(page.locator(head(3))).toContainText('3,432');
  });
}
