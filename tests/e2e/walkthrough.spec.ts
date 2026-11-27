import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STOPS } from '../../src/config/walkthrough';

// The walkthrough (src/components/site/walkthrough.ts, src/config/walkthrough.ts): started by the
// visitor only, seven stops across pages, keyboard first, and gone without a trace when it ends.
const ready = { timeout: 15_000 };
const card = '.cm-card';

const start = async (page: Page) => {
  await page.locator('[data-inspector-toggle]').click();
  await page.locator('#pm-inspector .help').click();
  await expect(page.locator(card)).toBeVisible(ready);
};
const stored = (page: Page) => page.evaluate(() => sessionStorage.getItem('pm.walkthrough'));

for (const lang of ['', '/es']) {
  test(`every stop points at something on its page${lang ? ' (es)' : ''}`, async ({ page }) => {
    for (const stop of STOPS) {
      await page.goto(`${lang}${stop.page === null || stop.page === '/' ? '' : stop.page}` || '/');
      await expect(page.locator(stop.anchor).first(), stop.key).toBeAttached();
    }
  });
}

test('nothing starts on its own, and nothing is stored before it does', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator(card)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
});

test('the Inspector starts it; Escape ends it, forgets it and gives focus back', async ({ page }) => {
  await page.goto('/');
  await start(page);
  await expect(page.locator('#pm-inspector')).toBeHidden();
  await expect(page.locator(card)).toContainText('1 of 7');
  await expect(page.locator(`${card} h2`)).toBeFocused(ready);
  expect(await stored(page)).toBe('0');
  await page.keyboard.press('Escape');
  await expect(page.locator(card)).toHaveCount(0);
  await expect(page.locator('.cm-ring')).toHaveCount(0);
  expect(await stored(page)).toBeNull();
});

test('it walks on to the next page and picks up there, in the same language', async ({ page }) => {
  await page.goto('/es');
  await start(page);
  for (let i = 0; i < 3; i++) await page.locator(`${card} .cm-primary`).click();
  await page.waitForURL(/\/es\/work\/buo$/, ready);
  await expect(page.locator(card)).toContainText('4 de 7', ready);
  await page.keyboard.press('ArrowLeft');
  await page.waitForURL(/\/es$/, ready);
  await expect(page.locator(card)).toContainText('3 de 7', ready);
});

test('the last stop finishes it', async ({ page }) => {
  await page.goto('/precrease');
  await page.evaluate(() => sessionStorage.setItem('pm.walkthrough', '6'));
  await page.reload();
  await expect(page.locator(card)).toContainText('7 of 7', ready);
  await page.locator(`${card} .cm-primary`).click();
  await expect(page.locator(card)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the card has no axe violations · ${theme}`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('pm.theme', t), theme);
    await page.goto('/');
    await start(page);
    // Measure the card as it rests, not while it unfolds in.
    await page
      .locator(card)
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
    const results = await new AxeBuilder({ page })
      .include(card)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('the Inspector offers it to first-time users, and any time behind its "?"', async ({ page }) => {
  await page.goto('/about');
  await page.locator('[data-inspector-toggle]').click();
  const panel = page.locator('#pm-inspector');
  await expect(panel.getByRole('button', { name: /New here\? Take the one-minute walkthrough/ })).toBeVisible(
    ready,
  );
  await expect(panel.getByRole('button', { name: 'Take the walkthrough' })).toHaveText('?');
});

test("the coach marks' styles stay out of the pages' HTML", async ({ request }) => {
  // They load with the first coach mark (coachmark.ts); in the HTML they cost every page its first round trip.
  for (const path of ['/', '/about', '/es/about', '/precrease']) {
    expect(await (await request.get(path)).text(), path).not.toContain('.cm-ring');
  }
});
