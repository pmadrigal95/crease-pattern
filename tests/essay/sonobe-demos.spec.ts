import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { themes } from '../../src/config/quality';
import { allVisualDirections } from '../../src/config/visual-direction';

// Crease No. 003's demos (acts 1 and 3), on the preview build where the draft exists.
const post = '/precrease/one-unit-thirty-shapes';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/stats/one-unit-thirty-shapes', (route) =>
    route.fulfill({ json: { views: 0, reads: 0, helped: 0 } }),
  );
  await page.route('**/api/stats/one-unit-thirty-shapes/*', (route) => route.fulfill({ status: 204 }));
});

test('the unit folds one stage at a time and highlights the props each stage is about', async ({ page }) => {
  await page.goto(post);
  const demo = page.locator('[data-unit-fold]');
  await expect(demo.locator('.stage:visible')).toHaveCount(1);
  await expect(demo.locator('[data-prev]')).toBeDisabled();
  await demo.locator('[data-next]').click();
  await expect(demo.locator('[data-status]')).toHaveText('Stage 2 of 5');
  await expect(demo.locator('.line.on')).toHaveText(['post: PostSummary;']);
  for (let i = 0; i < 3; i++) await demo.locator('[data-next]').click();
  await expect(demo.locator('[data-next]')).toBeDisabled();
  await expect(demo.locator('.line.on')).toHaveCount(2);
});

test("the props shown are PostCard's own, with a link to its file", async ({ page }) => {
  await page.goto(post);
  const demo = page.locator('[data-unit-fold]');
  await expect(demo.locator('pre')).toContainText('interface Props');
  await expect(demo.getByRole('link', { name: 'PostCard.astro on GitHub' })).toHaveAttribute(
    'href',
    /\/blob\/main\/src\/components\/precrease\/PostCard\.astro$/,
  );
});

test('the scale demo shows one model at a time; the designed count stays at 1', async ({ page }) => {
  await page.goto(post);
  const demo = page.locator('[data-sonobe-scale]');
  await expect(demo.locator('.model:visible')).toHaveCount(1);
  await demo.getByRole('button', { name: '30 units' }).click();
  await expect(demo.getByRole('button', { name: '30 units' })).toHaveAttribute('aria-pressed', 'true');
  await expect(demo.locator('[data-folded]')).toHaveText('30');
  await expect(demo.locator('.counts dd').first()).toHaveText('1');
  const before = await demo.locator('.model.current polygon').first().getAttribute('points');
  await demo.locator('[data-turn]').fill('120');
  await expect(demo.locator('.model.current polygon').first()).not.toHaveAttribute('points', before!);
});

test('without JavaScript every stage and every model is on the page', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(post);
  await expect(page.locator('[data-unit-fold] .stage:visible')).toHaveCount(5);
  await expect(page.locator('[data-sonobe-scale] .model:visible')).toHaveCount(3);
  await expect(page.locator('[data-unit-fold] .controls')).toBeHidden();
  await context.close();
});

test('the demos cause no layout shift while the page loads', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(post);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.01);
});

for (const direction of allVisualDirections) {
  for (const theme of themes) {
    test(`no axe violations · ${direction} · ${theme}`, async ({ page }) => {
      await page.addInitScript(
        ([d, t]) => {
          localStorage.setItem('pm.direction', d);
          localStorage.setItem('pm.theme', t);
        },
        [direction, theme] as const,
      );
      await page.goto(post);
      await expect(page.locator('html')).toHaveAttribute('data-direction', direction);
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
}

test('no horizontal overflow on a 375px phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(post);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('no Content Security Policy violations while the demos run', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto(post);
  await page.locator('[data-unit-fold] [data-next]').click();
  await page.locator('[data-sonobe-scale]').getByRole('button', { name: '12 units' }).click();
  await page.locator('[data-sonobe-scale] [data-turn]').fill('200');
  expect(violations).toEqual([]);
});
