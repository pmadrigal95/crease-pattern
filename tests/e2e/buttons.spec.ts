import { expect, test, type Page } from '@playwright/test';

// One button system (src/styles/buttons.css): three roles, one structure, and the identity's
// material. Contrast is axe's job (a11y.spec.ts, every identity and theme); this checks that each
// role takes its identity's shape and line, and keeps its size and its shortcut.
const as = async (page: Page, direction: string, path: string) => {
  await page.addInitScript((d) => localStorage.setItem('pm.direction', d), direction);
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-direction', direction);
};

const materials = [
  { direction: 'basalt-glacier', radius: '10px', underline: 'solid' },
  { direction: 'washi-asagi', radius: '999px', underline: 'dashed' },
  { direction: 'contour-lines', radius: '999px', underline: 'wavy' },
];

for (const { direction, radius, underline } of materials) {
  test(`${direction}: every role takes the identity's shape and line`, async ({ page }) => {
    await as(page, direction, '/');
    const primary = page.locator('.hero .btn-primary');
    await expect(primary).toHaveCSS('border-radius', radius);
    await expect(page.locator('.mast .btn-primary')).toHaveCSS('border-radius', radius);
    await expect(page.locator('.copy-text .btn-secondary')).toHaveCSS('border-radius', radius);
    for (const action of await page.locator('.action').all())
      await expect(action).toHaveCSS('text-decoration-style', underline);
    for (const button of [
      primary,
      page.locator('.copy-text .btn-secondary'),
      ...(await page.locator('.action').all()),
    ])
      await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
}

test("the hero's Inspect names its shortcut in the tooltip, with no chip on the button", async ({ page }) => {
  await page.goto('/');
  const inspect = page.getByRole('button', { name: 'See how this page is built' });
  await expect(inspect).toHaveAttribute('aria-keyshortcuts', 'Shift+I');
  await expect(inspect).toHaveAttribute('title', 'See how this page is built (Shift I)');
  await expect(inspect.locator('kbd')).toHaveCount(0);
});

test("an action's arrow is decoration, never read out", async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Read the release notes', exact: true })).toBeVisible();
  for (const arrow of await page.locator('.action .arrow').all())
    await expect(arrow).toHaveAttribute('aria-hidden', 'true');
});

test('Washi folds its crease into a button on hover', async ({ page }) => {
  await as(page, 'washi-asagi', '/');
  const primary = page.locator('.hero .btn-primary');
  const crease = () => primary.evaluate((el) => getComputedStyle(el, '::after').transform);
  expect(await crease()).toBe('matrix(0, 0, 0, 1, 0, 0)');
  await primary.hover();
  await expect.poll(crease).toBe('matrix(1, 0, 0, 1, 0, 0)');
});
