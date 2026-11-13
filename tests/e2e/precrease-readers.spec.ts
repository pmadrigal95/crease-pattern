import { expect, test, type Page } from '@playwright/test';

// The end of a post (M3a.3): public counts from the site's own API, "This helped" with the
// folded corner, the share sheet and comments on request. The Worker isn't part of the static
// preview, so the API is simulated here; tests/unit/reader-stats.test.ts covers the API itself.
const post = '/precrease/the-work-before-the-shape';
const api = '**/api/stats/the-work-before-the-shape';

async function fakeApi(page: Page, counts = { views: 1204, reads: 312, helped: 12 }) {
  const events: string[] = [];
  await page.route(api, (route) => route.fulfill({ json: counts }));
  await page.route(`${api}/*`, (route) => {
    events.push(route.request().url().split('/').pop()!);
    return route.fulfill({ status: 204 });
  });
  return events;
}
const readers = (page: Page) => page.getByRole('region', { name: 'Readers' });
// The footer has its own LinkedIn link, so sheet links are looked up inside the sheet.
const sheet = (page: Page) => page.locator('#share-sheet');
const count = (page: Page, key: string) => readers(page).locator(`[data-count="${key}"]`);

test('shows the public counts and counts the view', async ({ page }) => {
  const events = await fakeApi(page);
  await page.goto(post);
  await expect(count(page, 'views')).toHaveText('1,204');
  await expect(count(page, 'reads')).toHaveText('312');
  await expect(count(page, 'helped')).toHaveText('12');
  await expect(readers(page).getByRole('button', { name: /This helped/ })).toBeVisible();
  await expect.poll(() => events).toContain('view');
});

test('"This helped" folds the corner, counts once and is remembered', async ({ page }) => {
  const events = await fakeApi(page);
  await page.goto(post);
  const button = readers(page).locator('[data-helped]');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toContainText('Thanks');
  await expect(count(page, 'helped')).toHaveText('13');
  await expect(readers(page).getByRole('status')).toHaveText(/Thanks/);
  await button.click();
  await expect.poll(() => events.filter((e) => e === 'helped')).toHaveLength(1);

  await page.reload();
  await expect(readers(page).locator('[data-helped]')).toHaveAttribute('aria-pressed', 'true');
});

test('with Global Privacy Control on, nothing is reported, and the totals still show', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
  const events = await fakeApi(page);
  await page.goto(post);
  await expect(count(page, 'views')).toHaveText('1,204');
  await page.waitForTimeout(500);
  expect(events).toEqual([]);
});

test('the share sheet opens beside the button, works with the keyboard and returns focus', async ({
  page,
}) => {
  await fakeApi(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(post);
  const share = readers(page).getByRole('button', { name: 'Share' });
  await share.click();
  const linkedin = sheet(page).getByRole('link', { name: 'LinkedIn' });
  await expect(linkedin).toBeVisible();
  await expect(linkedin).toHaveAttribute(
    'href',
    /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2F.+%2Fprecrease%2Fthe-work-before-the-shape$/,
  );
  await page.keyboard.press('Escape');
  await expect(linkedin).toBeHidden();
  await expect(share).toBeFocused();
});

test('on a phone the share sheet rises from the bottom of the screen', async ({ page }) => {
  await fakeApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(post);
  await readers(page).getByRole('button', { name: 'Share' }).click();
  await expect(sheet(page)).toBeVisible();
  // Measured once the slide-up has finished.
  await expect
    .poll(async () => {
      const box = (await sheet(page).boundingBox())!;
      return Math.round(box.y + box.height);
    })
    .toBe(812);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('if the API is down, the counts and "This helped" stay hidden and sharing still works', async ({
  page,
}) => {
  await page.route(`${api}**`, (route) => route.fulfill({ status: 503 }));
  await page.goto(post);
  await expect(readers(page).locator('[data-helped]')).toBeHidden();
  await expect(readers(page).locator('[data-metrics]')).toBeHidden();
  await readers(page).getByRole('button', { name: 'Share' }).click();
  await expect(sheet(page).getByRole('link', { name: 'Bluesky' })).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('Share still opens, and its links are plain links', async ({ page }) => {
    await page.goto(post);
    await readers(page).getByRole('button', { name: 'Share' }).click();
    for (const name of ['LinkedIn', 'X', 'Bluesky'])
      await expect(sheet(page).getByRole('link', { name })).toBeVisible();
  });
});

test('comments load nothing from giscus until the reader asks', async ({ page }) => {
  const giscus: string[] = [];
  await page.route('https://giscus.app/**', (route) => {
    giscus.push(route.request().url());
    return route.abort();
  });
  await fakeApi(page);
  await page.goto(post);
  await page.waitForLoadState('networkidle');
  expect(giscus).toEqual([]);

  const comments = readers(page).getByRole('button', { name: /^Comments/ });
  await comments.click();
  await expect.poll(() => giscus).toContain('https://giscus.app/client.js');
  await expect(comments).toHaveAttribute('aria-expanded', 'true');
});

test('only post pages allow giscus in their Content Security Policy', async ({ page }) => {
  const csp = async (path: string) => {
    await page.goto(path);
    return page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content');
  };
  expect(await csp(post)).toMatch(/frame-src https:\/\/giscus\.app/);
  expect(await csp(post)).toMatch(/style-src 'self' https:\/\/giscus\.app/);
  expect(await csp('/')).not.toContain('giscus');
});
