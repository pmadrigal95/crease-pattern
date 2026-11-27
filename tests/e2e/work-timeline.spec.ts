import { expect, test } from '@playwright/test';

// The earlier roles on /work (src/components/work/EarlierWork.astro, doc 36): a timeline of ribbons
// over strips that unfold; NICE Actimize named as the company it was; the plans while inspecting.
const section = '[data-earlier]';

test('the timeline names each company, NICE Actimize on a lane of its own, and runs on into Buo', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/work');
  const chart = page.locator(`${section} .chart`);
  await expect(chart).toBeVisible();
  await expect(chart.locator('.name')).toHaveText([
    'MDG Developers Group',
    'Jardines del Recuerdo',
    'MDG Developers Group',
    'NICE Actimize',
  ]);
  await expect(chart.locator('.next-name')).toHaveText('Buo →');
  await expect(page.locator(`${section} [data-strip="1.1.0"] .org`)).toHaveText(
    'NICE Actimize · via MDG Developers Group',
  );
});

test('a ribbon opens its strip, and the strip unfolds to its lines', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/work');
  const strip = page.locator(`${section} [data-strip="1.0.0"]`);
  await expect(strip.locator('details')).not.toHaveAttribute('open');
  await page.locator(`${section} [data-ribbon="1.0.0"]`).click();
  await expect(strip.locator('details')).toHaveAttribute('open', '');
  await expect(strip.locator('.panel p').first()).toBeVisible();
});

test('the strips work by keyboard, and phones get the strips without the chart', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/work');
  await expect(page.locator(`${section} .chart`)).toBeHidden();
  const summary = page.locator(`${section} [data-strip="1.1.0"] summary`);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`${section} [data-strip="1.1.0"] details`)).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('inspecting shows the plans: dimensions on ribbons and strips, and what each case card is drawn from', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/work');
  const dims = page.locator(`${section} .long .dim`);
  await expect(dims.first()).toBeHidden();
  await page.locator('[data-inspector-toggle]').click();
  await expect(dims.first()).toBeVisible();
  await expect(page.locator(`${section} [data-strip="1.0.0"] .long .dim`)).toHaveText(
    'Sep 2019 → Jul 2022 · 35 months',
  );
  await expect(page.locator('.case-card .plan').first()).toBeVisible();
  await expect(page.locator('.case-card .plan').first()).toContainText('CaseCard');
});
