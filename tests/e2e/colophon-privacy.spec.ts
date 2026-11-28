import { expect, test } from '@playwright/test';

// The colophon as a technical sheet and the privacy page as "what travels" (doc 40).
const inspect = async (page: import('@playwright/test').Page) => {
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#pm-inspector')).toBeVisible();
};

test('the colophon is a numbered set of sheets with a title block, a plan and its instruments', async ({
  page,
}) => {
  await page.goto('/colophon');
  const block = page.getByRole('region', { name: 'About this build' });
  // Filled after the build (scripts/stamp-site-metrics.ts): a dash must never ship.
  await expect(block.locator('[data-metric="html-pages"]')).toHaveText(/^\d+$/);
  await expect(page.locator('[data-sheet]')).toHaveCount(7);
  const plan = page.getByRole('complementary', { name: /plan of this page/ });
  await expect(plan.locator('a')).toHaveCount(7);
  await expect(plan.locator('a').first()).toHaveAttribute('href', '#architecture');
  const gauges = page.locator('.gauges li');
  await expect(gauges).toHaveCount(6);
  await expect(gauges.nth(4)).toContainText(/\d+ ms/);
  await expect(page.locator('.measured')).toContainText(/median of \d+ runs/);
});

test('picking an identity on the colophon switches the site to it', async ({ page }) => {
  await page.goto('/colophon');
  await page.locator('[data-identity="washi-asagi"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-direction', 'washi-asagi');
  await expect(page.locator('[data-identity="washi-asagi"]')).toHaveAttribute('aria-pressed', 'true');
});

test('inspecting turns every sheet over to show the files that build it', async ({ page }) => {
  await page.goto('/colophon');
  await expect(page.locator('.sheet .back .file').first()).toHaveText('astro.config.ts');
  await inspect(page);
  await expect
    .poll(() =>
      page
        .locator('.sheet')
        .nth(1)
        .locator('.back')
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .toMatch(
      /^(none|matrix\(1, 0, 0, 1, 0, 0\)|matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\))$/,
    );
  await expect(page.locator('.sheet .back [data-metric="first-load-js"]').first()).toHaveText(/^\d+\.\d$/);
});

test('privacy: stamps, every route, each paragraph tagged, and the check done in the browser', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.locator('.stamp')).toHaveCount(5);
  await expect(page.getByRole('img', { name: /where data can travel/ })).toBeVisible();
  await expect(page.locator('.routes svg [data-place]')).toHaveCount(6);
  await expect(page.locator('.route-tag')).toHaveCount(7);
  const live = page.locator('.live');
  await expect(live).toBeVisible();
  await expect(live.locator('[data-check="cookies"] b')).toHaveText('0');
});

test('inspecting the privacy page lays its requests over the routes it declares', async ({ page }) => {
  await page.goto('/es/privacy');
  await inspect(page);
  const audit = page.locator('.routes .audit');
  await expect(audit).toContainText(/\d+ peticiones desde esta página, todas por una ruta declarada/);
  await expect(page.locator('.routes')).not.toHaveClass(/elsewhere/);
  await expect(page.locator('.routes svg [data-seen="site"]')).toHaveText(/\d+ ✓/);
});

test('on a phone the routes are a list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy');
  await expect(page.locator('.routes svg')).toBeHidden();
  await expect(page.locator('.routes .list li')).toHaveCount(6);
});

// Every word on the map and the plan reads whole: inside its box with room to spare, measured
// with the real fonts, in both languages (as the case figures are, work-figures.spec.ts).
for (const [path, group, box] of [
  ['/privacy', '.routes svg .place', 'rect'],
  ['/es/privacy', '.routes svg .place', 'rect'],
  ['/colophon', '.plan svg a', 'rect.edge'],
  ['/es/colophon', '.plan svg a', 'rect.edge'],
] as const) {
  test(`${path}: every word on the drawing fits its box`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const loose = await page.evaluate(
      ([g, b]) =>
        [...document.querySelectorAll<SVGGElement>(g)].flatMap((el) => {
          const r = el.querySelector<SVGGraphicsElement>(b)?.getBBox();
          if (!r) return [];
          return [...el.querySelectorAll<SVGTextElement>(':scope > text')]
            .map((t) => ({ w: t.textContent ?? '', bb: t.getBBox() }))
            .filter(({ bb }) => bb.x < r.x + 4 || bb.x + bb.width > r.x + r.width - 4)
            .map(({ w, bb }) => `"${w}" (${Math.round(bb.width)} in ${Math.round(r.width)})`);
        }),
      [group, box] as const,
    );
    expect(loose).toEqual([]);
  });
}
