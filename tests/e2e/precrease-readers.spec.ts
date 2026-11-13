import { expect, test, type Page } from '@playwright/test';

// The end of a post (M3a.3): public counts from the site's own API, "This helped", sharing
// without widgets. The Worker isn't part of the static preview, so the API is simulated here;
// tests/unit/reader-stats.test.ts covers the API itself.
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

test('shows the public counts and counts the view', async ({ page }) => {
  const events = await fakeApi(page);
  await page.goto(post);
  const readers = page.getByRole('region', { name: 'Readers' });
  await expect(readers.getByText('1,204 views · 312 read to the end')).toBeVisible();
  await expect(readers.getByRole('button', { name: /This helped/ })).toContainText('12 readers');
  await expect.poll(() => events).toContain('view');
});

test('"This helped" counts once and is remembered', async ({ page }) => {
  const events = await fakeApi(page);
  await page.goto(post);
  const button = page.getByRole('button', { name: /This helped/ });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toContainText('13 readers');
  await expect(page.getByRole('status')).toHaveText(/Thanks/);
  await button.click();
  await expect.poll(() => events.filter((e) => e === 'helped')).toHaveLength(1);

  await page.reload();
  await expect(page.getByRole('button', { name: /This helped/ })).toHaveAttribute('aria-pressed', 'true');
});

test('with Global Privacy Control on, nothing is reported, and the totals still show', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
  const events = await fakeApi(page);
  await page.goto(post);
  await expect(page.getByText('1,204 views · 312 read to the end')).toBeVisible();
  await page.waitForTimeout(500);
  expect(events).toEqual([]);
});

test('if the API is down, the counts stay hidden and sharing still works', async ({ page }) => {
  await page.route(`${api}**`, (route) => route.fulfill({ status: 503 }));
  await page.goto(post);
  const readers = page.getByRole('region', { name: 'Readers' });
  await expect(readers.getByRole('button', { name: /This helped/ })).toBeHidden();
  await expect(readers.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=https%3A%2F%2F.+%2Fprecrease%2Fthe-work-before-the-shape$/,
  );
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the share links are plain links', async ({ page }) => {
    await page.goto(post);
    const readers = page.getByRole('region', { name: 'Readers' });
    for (const name of ['LinkedIn', 'X', 'Bluesky'])
      await expect(readers.getByRole('link', { name })).toBeVisible();
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

  await page.getByRole('button', { name: 'Show comments' }).click();
  await expect.poll(() => giscus).toContain('https://giscus.app/client.js');
  await expect(page.getByRole('button', { name: 'Show comments' })).toBeHidden();
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
