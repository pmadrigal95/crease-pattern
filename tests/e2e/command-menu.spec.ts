import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The command menu (M4.7): Ctrl/Cmd+K or its button on every page; pages, sections, posts and a
// few actions; full-text post search handed over to Precrease.
const dialog = 'dialog.cmdk';
const input = `${dialog} input[role="combobox"]`;
const active = (page: import('@playwright/test').Page) =>
  page.locator(`${dialog} [role="option"][aria-selected="true"]`);

test('nothing for the menu downloads until it is used', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto('/about');
  await page.waitForLoadState('networkidle');
  expect(requested.filter((u) => /command-menu|commands\.json/.test(u))).toEqual([]);
});

test('Ctrl+K opens it with focus in the box; Escape closes it and gives focus back', async ({ page }) => {
  await page.goto('/about');
  await page.locator('[data-command-open]').focus();
  await page.keyboard.press('Control+K');
  await expect(page.locator(dialog)).toBeVisible();
  await expect(page.locator(input)).toBeFocused();
  await expect(active(page)).toHaveText(/Inspect this page/);
  await page.keyboard.press('Escape');
  await expect(page.locator(dialog)).toBeHidden();
  await expect(page.locator('[data-command-open]')).toBeFocused();
});

test('typing finds a section, arrows move, Enter goes there', async ({ page }) => {
  await page.goto('/about');
  await page.keyboard.press('Control+K');
  await page.locator(input).fill('col qual');
  await expect(active(page)).toContainText('Quality gates');
  await page.keyboard.press('ArrowDown');
  await expect(active(page)).toContainText('Search posts for');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/colophon#quality-gates$/);
});

test('actions run: the dark theme, then searching the posts hands the query to Precrease', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('Control+K');
  await page.locator(input).fill('dark theme');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.keyboard.press('Control+K');
  await page.locator(input).fill('threads');
  await page.getByRole('option', { name: /Search posts for/ }).click();
  await expect(page).toHaveURL(/\/precrease\?q=threads$/);
  await expect(page.locator('#precrease-q')).toHaveValue('threads');
});

test('Precrease keeps "/" for its own box, and Ctrl+K opens the menu there too', async ({ page }) => {
  await page.goto('/precrease');
  await page.keyboard.press('/');
  await expect(page.locator('#precrease-q')).toBeFocused();
  await page.locator('#precrease-q').blur();
  await page.keyboard.press('Control+K');
  await expect(page.locator(dialog)).toBeVisible();
});

test('on phones the button sits in the bottom corner and opens the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Search and commands' });
  await expect(button).toHaveCSS('position', 'fixed');
  const box = (await button.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(844 - 80);
  await button.click();
  await expect(page.locator(dialog)).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the open menu has no axe violations · ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await page.goto('/about');
    await page.keyboard.press('Control+K');
    await page.locator(input).fill('irazu');
    await expect(active(page)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(dialog)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
