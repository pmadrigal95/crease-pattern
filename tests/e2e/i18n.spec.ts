import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The Spanish edition's base (M5.1): every page under /es/, hreflang between the pairs, a language
// switch in the masthead, the footer and ⌘K, and a suggestion that never redirects (decision 2).
const switchInMast = '.mast [data-lang-switch]';
const suggestion = '[data-lang-suggest]';

test('/es/about is the Spanish page, and both say where their pair is', async ({ page }) => {
  await page.goto('/es/about');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((l) => `${l.getAttribute('hreflang')} ${new URL(l.getAttribute('href')!).pathname}`),
    );
  expect(alternates).toEqual(['en /about', 'es /es/about', 'x-default /about']);
  await page.goto('/about');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator(switchInMast)).toHaveAttribute('href', '/es/about');
});

test('the 404 page has no pair, so it declares no alternates', async ({ page }) => {
  await page.goto('/this-page-does-not-exist');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
});

test('choosing a language is remembered, and only then does the home page follow it', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/about');
  await page.locator(switchInMast).click();
  await expect(page).toHaveURL(/\/es\/about$/);
  expect(await page.evaluate(() => localStorage.getItem('pm.lang'))).toBe('es');
  await page.goto('/');
  await expect(page).toHaveURL(/\/es$/);
  // A link to another page is never redirected.
  await page.goto('/changelog');
  await expect(page).toHaveURL(/\/changelog$/);
  // Choosing English in the footer undoes it.
  await page.goto('/es/about');
  await page.locator('.foot [data-lang-switch="en"]').click();
  await expect(page).toHaveURL(/\/about$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});

test('⌘K switches the language too', async ({ page }) => {
  await page.goto('/colophon');
  await page.keyboard.press('Control+K');
  await page.locator('dialog.cmdk input[role="combobox"]').fill('español');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/es\/colophon$/);
});

test.describe('a browser that prefers Spanish', () => {
  test.use({ locale: 'es-CR' });

  test('sees the suggestion on an English page, not a redirect, until it dismisses it', async ({ page }) => {
    await page.goto('/about');
    await expect(page).toHaveURL(/\/about$/);
    const hint = page.locator(suggestion);
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('lang', 'es');
    await expect(hint.getByRole('link')).toHaveAttribute('href', '/es/about');
    // Showing it writes nothing; dismissing it does, so it stays closed. (pm.tips is the suite's
    // first-visit tip, seen before the test starts: tests/tip-seen.ts.)
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'pm.tips'))).toEqual([]);
    await hint.getByRole('button').click();
    await expect(hint).toBeHidden();
    await page.reload();
    await expect(page.locator(suggestion)).toBeHidden();
  });

  test('the suggestion passes axe', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator(suggestion)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .include(suggestion)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test('sees no suggestion on the Spanish page itself', async ({ page }) => {
    await page.goto('/es/about');
    await expect(page.locator(suggestion)).toBeHidden();
  });
});

test('an English browser sees no suggestion', async ({ page }) => {
  await page.goto('/about');
  await expect(page.locator(suggestion)).toBeHidden();
});

for (const path of ['/es', '/es/about', '/es/precrease', '/es/precrease/el-trabajo-antes-de-la-forma']) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.timeline instanceof DocumentTimeline)
          // A loop never finishes (the Work star floating, WorkModel.astro): it isn't waited for.
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('the Spanish pages read in Spanish, the Inspector included', async ({ page }) => {
  await page.goto('/es/about');
  await expect(page.locator('main h1')).toHaveText('Ingeniero de sistemas. Arquitecto frontend.');
  await expect(
    page.getByRole('navigation', { name: 'Este sitio' }).getByRole('link', { name: 'Colofón' }),
  ).toHaveAttribute('href', '/es/colophon');
  await page.getByRole('button', { name: 'Inspeccionar' }).click();
  await expect(page.locator('#pm-inspector')).toHaveAttribute('aria-label', 'Inspector');
  await expect(page.locator('#pm-inspector')).toContainText('Capas');
  await expect(page.locator('#pm-inspector')).toContainText('Curvas de nivel');
});

test('the Spanish changelog and topic map use Spanish data', async ({ page }) => {
  await page.goto('/es/changelog');
  await expect(page.locator('main')).toContainText('Campamento base');
  await expect(page.locator('main')).toContainText('Arquitecto frontend líder');
  await page.goto('/es/precrease/map');
  await expect(page.locator('main')).toContainText('Arquitectura y diseño');
  await expect(page.getByRole('link', { name: 'Arquitectura y diseño', exact: true })).toHaveAttribute(
    'href',
    '/es/precrease/topics/architecture',
  );
});

// Posts in Spanish (M5.4): a slug of their own under /es/precrease/, paired with the original by
// `translationOf`, listed on the Spanish pages, and one post with the original for counts and comments.
test('a Spanish edition has its own URL, its pair, and the original’s counts', async ({ page }) => {
  await page.goto('/es/precrease');
  await page.getByRole('link', { name: 'El trabajo antes de la forma' }).first().click();
  await expect(page).toHaveURL(/\/es\/precrease\/el-trabajo-antes-de-la-forma$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((l) => `${l.getAttribute('hreflang')} ${new URL(l.getAttribute('href')!).pathname}`),
    );
  expect(alternates.toSorted()).toEqual([
    'en /precrease/the-work-before-the-shape',
    'es /es/precrease/el-trabajo-antes-de-la-forma',
    'x-default /precrease/the-work-before-the-shape',
  ]);
  await expect(page.locator('.edition')).toContainText(
    'El original, en inglés, salió el 11 de noviembre de 2026.',
  );
  await expect(page.locator('[data-readers]')).toHaveAttribute('data-slug', 'the-work-before-the-shape');
  await expect(page.locator(switchInMast)).toHaveAttribute('href', '/precrease/the-work-before-the-shape');
  await page.goto('/precrease/the-work-before-the-shape');
  await expect(page.locator(switchInMast)).toHaveAttribute(
    'href',
    '/es/precrease/el-trabajo-antes-de-la-forma',
  );
  await expect(page.locator('.edition')).toHaveCount(0);
});

test('the Spanish essay’s demos speak Spanish', async ({ page }) => {
  await page.goto('/es/precrease/cuando-los-hilos-valen-la-pena');
  await expect(page.locator('[data-threads-run]')).toContainText('Ejecutar en este dispositivo');
  await expect(page.locator('[data-threads-run]')).toContainText(
    'Medido en un Intel Core i7-12700K (12 núcleos, 20 hilos)',
  );
});

// Discovery per language (M5.5): each language finds only its own posts.
test('each language has its own feed, with only its own posts', async ({ request }) => {
  const es = await (await request.get('/es/precrease/rss.xml')).text();
  expect(es).toContain('<language>es</language>');
  expect(es).toContain('/es/precrease/el-trabajo-antes-de-la-forma</link>');
  expect(es).not.toContain('/precrease/the-work-before-the-shape');
  const en = await (await request.get('/precrease/rss.xml')).text();
  expect(en).toContain('<language>en</language>');
  expect(en).not.toContain('/es/precrease/');
  const topic = await (await request.get('/es/precrease/topics/concurrency/rss.xml')).text();
  expect(topic).toContain('/es/precrease/cuando-los-hilos-valen-la-pena</link>');
});

test('the Spanish pages point to the Spanish feed', async ({ page }) => {
  await page.goto('/es/precrease/subscribe');
  await expect(page.locator('link[type="application/rss+xml"]').first()).toHaveAttribute(
    'href',
    '/es/precrease/rss.xml',
  );
  await expect(page.locator('main')).toContainText('/es/precrease/rss.xml');
});

test('the sitemap pairs each post with its edition and leaves out noindex pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const entry =
    xml.match(/<url><loc>[^<]*\/es\/precrease\/el-trabajo-antes-de-la-forma<\/loc>.*?<\/url>/)?.[0] ?? '';
  expect(entry).toContain('hreflang="en" href="https://');
  expect(entry).toContain('/precrease/the-work-before-the-shape"');
  expect(xml).not.toContain('/precrease/topics/');
  expect(await (await request.get('/robots.txt')).text()).toMatch(/^Sitemap: https:\/\/.+\/sitemap\.xml$/m);
});

test('⌘K on a Spanish page offers the Spanish pages and posts', async ({ page }) => {
  await page.goto('/es/about');
  await page.keyboard.press('Control+K');
  const input = page.locator('dialog.cmdk input[role="combobox"]');
  await input.fill('hilos');
  const options = page.locator('dialog.cmdk [role="option"]');
  await expect(options.first()).toContainText('Cuando los hilos valen la pena');
  await input.fill('threads pay off');
  await expect(page.locator('dialog.cmdk')).not.toContainText('When threads pay off');
});

test('Precrease search in Spanish finds the Spanish editions', async ({ page }) => {
  await page.goto('/es/precrease');
  await page.getByRole('searchbox').first().fill('hilos');
  const first = page.locator('[data-results] a, .results a').first();
  await expect(first).toHaveAttribute('href', '/es/precrease/cuando-los-hilos-valen-la-pena', {
    timeout: 10_000,
  });
});
