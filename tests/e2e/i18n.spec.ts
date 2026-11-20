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
    // Showing it writes nothing; dismissing it does, so it stays closed.
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
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
  await expect(page.getByRole('link', { name: 'colofón', exact: true })).toHaveAttribute(
    'href',
    '/es/colophon',
  );
  await page.getByRole('button', { name: 'Inspeccionar' }).click();
  await expect(page.locator('#inspector')).toHaveAttribute('aria-label', 'Inspector');
  await expect(page.locator('#inspector')).toContainText('Capas');
  await expect(page.locator('#inspector')).toContainText('Curvas de nivel');
});

test('the Spanish changelog and topic map use Spanish data', async ({ page }) => {
  await page.goto('/es/changelog');
  await expect(page.locator('main')).toContainText('Campamento base');
  await expect(page.locator('main')).toContainText('Arquitecto frontend líder');
  await page.goto('/es/precrease/map');
  await expect(page.locator('main')).toContainText('Arquitectura y diseño');
  await expect(page.getByRole('link', { name: 'Arquitectura y diseño' })).toHaveAttribute(
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
