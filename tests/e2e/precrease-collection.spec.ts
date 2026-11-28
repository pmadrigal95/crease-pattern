import { expect, test, type Page } from '@playwright/test';

// Precrease as a collection, a sheet of topics and the feed as it arrives (doc 41). Posts are
// placed by their branch of the topic tree, never by a bare number (doc 32, the decision of #125).
const inspect = async (page: Page) => {
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#pm-inspector')).toBeVisible();
};

test('the latest posts say their order in words and place each post by its branch', async ({ page }) => {
  await page.goto('/precrease');
  await expect(page.locator('.series')).toContainText('Newest first');
  const pieces = page.locator('.collection > li');
  expect(await pieces.count()).toBeGreaterThan(0);
  for (const piece of await pieces.all()) {
    await expect(piece.locator('.post-branches li').first()).toBeVisible();
    // The number only ever shows with its label.
    await expect(piece.locator('.facts')).toContainText(/Crease No\. \d{3}/);
  }
  await expect(page.locator('.post-branches', { hasText: 'Systems' })).toContainText('Concurrency');
});

test('inspecting shows where each pattern comes from, fold for fold', async ({ page }) => {
  await page.goto('/precrease');
  await inspect(page);
  await expect(page.locator('.origin-note')).toBeVisible();
  const matches = await page.locator('.collection > li').evaluateAll((pieces) =>
    pieces.map((piece) => {
      const drawn = [...piece.querySelectorAll('.post-thumb svg path')].slice(0, 16).map((path) => {
        const [x1, , x2] = (path.getAttribute('d') ?? '').match(/[\d.]+/g)?.map(Number) ?? [];
        return `${path.hasAttribute('stroke-dasharray') ? 'v' : 'm'}${(x2 ?? 0) > (x1 ?? 0) ? '╲' : '╱'}`;
      });
      const listed = [...piece.querySelectorAll('.origin .cells span')].map(
        (cell) => `${cell.classList.contains('valley') ? 'v' : 'm'}${cell.textContent?.trim()}`,
      );
      return listed.length === 16 && drawn.join() === listed.join();
    }),
  );
  expect(matches.every(Boolean)).toBe(true);
});

test('the topic map is one sheet: a region per topic, each a link named by its branch', async ({ page }) => {
  await page.goto('/precrease/map');
  const sheet = page.getByRole('region', { name: /topics as one sheet/ });
  await expect(sheet.locator('.region')).toHaveCount(7);
  await expect(sheet.getByRole('link', { name: 'Systems › Concurrency, 1 post' })).toHaveAttribute(
    'href',
    '/precrease/topics/concurrency',
  );
  await expect(sheet.getByRole('link', { name: /^Delivery, to be folded$/ })).toBeVisible();
  await expect(sheet).toContainText(/7 topics · \d+ posts · \d+ still to be folded/);
  // The list stays, for every reader.
  await expect(page.locator('.tree > li')).toHaveCount(7);
});

test('every word on the topic sheet fits its region, in both languages', async ({ page }) => {
  for (const path of ['/precrease/map', '/es/precrease/map']) {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const loose = await page.locator('.topic-sheet svg').evaluate((svg) =>
      [...svg.querySelectorAll('a')].flatMap((a) => {
        const r = a.querySelector('rect')!.getBBox();
        return [...a.querySelectorAll(':scope > text')]
          .map((t) => ({ w: t.textContent, b: (t as SVGTextElement).getBBox() }))
          .filter(({ b }) => b.x + b.width > r.x + r.width - 4)
          .map(({ w }) => w);
      }),
    );
    expect(loose, path).toEqual([]);
  }
});

test('subscribe: the feed as a ticket, what arrives, and each topic’s own feed', async ({
  page,
  request,
}) => {
  await page.goto('/precrease/subscribe');
  await expect(page.getByRole('region', { name: 'Your feed' })).toContainText('/precrease/rss.xml');
  const rss = await (await request.get('/precrease/rss.xml')).text();
  const titles = [...rss.matchAll(/<item><title>([^<]+)<\/title>/g)].slice(0, 3).map(([, t]) => t ?? '');
  await expect(page.locator('.reader li b')).toHaveText(titles);
  await expect(page.getByRole('button', { name: 'Copy the Concurrency feed' })).toBeVisible();
  await expect(page.locator('.xml')).toBeHidden();
  await inspect(page);
  await expect(page.locator('.xml')).toContainText(titles[0] ?? '');
});

test('on a phone the topic list stands alone and the posts keep their branches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/precrease/map');
  await expect(page.locator('.topic-sheet')).toBeHidden();
  await expect(page.locator('.tree > li')).toHaveCount(7);
  await page.goto('/precrease');
  await expect(page.locator('.collection .post-branches').first()).toBeVisible();
});
