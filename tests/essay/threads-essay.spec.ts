import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { themes } from '../../src/config/quality';
import { allVisualDirections } from '../../src/config/visual-direction';

// Crease No. 002 end to end, on a preview build (drafts included) served with public/_headers, so
// the page is cross-origin isolated as in production and the demos run real Web Workers.
const essay = '/precrease/when-threads-pay-off';

// The reader counts come from the site's Worker, which this static server doesn't run; answer as it
// would, so a missing API isn't reported as a page error (tests/unit/reader-stats.test.ts covers it).
test.beforeEach(async ({ page }) => {
  await page.route('**/api/stats/when-threads-pay-off', (route) =>
    route.fulfill({ json: { views: 0, reads: 0, helped: 0 } }),
  );
  await page.route('**/api/stats/when-threads-pay-off/*', (route) => route.fulfill({ status: 204 }));
});

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

test('the page is cross-origin isolated, so shared memory is available', async ({ page }) => {
  await page.goto(essay);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});

test('before any run, the opening demo shows the times measured on the desktop', async ({ page }) => {
  await page.goto(essay);
  const demo = page.locator('[data-threads-run]');
  await expect(demo.locator('[data-readout]')).toHaveText(/^On my desktop: .+× faster than one worker\.$/);
  await expect(demo.locator('li[data-model] [data-time]')).toHaveCount(4);
  await expect(demo.locator('[data-note]')).toContainText('i7-12700K');
});

test('every demo runs on real workers without errors', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.goto(essay);

  for (const selector of ['[data-threads-run]', '[data-gustafson]']) {
    const demo = page.locator(selector);
    await demo.locator('[data-run]').click();
    await expect(demo.locator('[data-run]')).toHaveText('Run again', { timeout: 90_000 });
  }

  const opening = page.locator('[data-threads-run]');
  await expect(opening.locator('[data-readout]')).toHaveText(
    /^Fastest on this device: .+× faster than one worker\.$/,
  );
  // All four models ran: shared memory is allowed on this page.
  for (const model of ['serial', 'messages', 'fork-join', 'shared'])
    await expect(opening.locator(`li[data-model="${model}"] [data-speed]`)).toHaveText(/^\d+(\.\d+)?×$/);
  await expect(opening.locator('.cell.chosen')).toHaveCount(4);
  await expect(page.locator('[data-gustafson] li[data-depth="4"] [data-speed]')).toHaveText(/^\d+(\.\d+)?×$/);

  expect(errors).toEqual([]);
});

test('without JavaScript, the measured figures and the 2022 table still read', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(essay);
  await expect(page.locator('[data-threads-run] [data-readout]')).toContainText('On my desktop');
  await expect(page.getByRole('table')).toContainText('0.036 s');
  await context.close();
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
      await page.goto(essay);
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
  await page.goto(essay);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('no Content Security Policy violations, demos included', async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp ??= [];
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy/i.test(msg.text())) violations.push(msg.text());
  });
  await page.goto(essay);
  await page.locator('[data-threads-run] [data-run]').click();
  await expect(page.locator('[data-threads-run] [data-run]')).toHaveText('Run again', { timeout: 90_000 });
  violations.push(...(await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])));
  expect(violations).toEqual([]);
});

test('the essay cites Amdahl and Gustafson as sources', async ({ page }) => {
  await page.goto(essay);
  const refs = page.getByRole('region', { name: 'References' });
  await expect(refs.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(refs.getByRole('link', { name: "Reevaluating Amdahl's law" })).toHaveAttribute(
    'href',
    'https://doi.org/10.1145/42411.42415',
  );
});
