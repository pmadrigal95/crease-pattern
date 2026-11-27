import { expect, test, type Page } from '@playwright/test';

// Page transitions (doc 39, src/scripts/page-reveal.ts, src/styles/transitions.css). Here and not
// in the main suite: cross-document View Transitions need the page served as Cloudflare serves it
// (scripts/serve-dist.ts); `astro preview` makes the browser skip them.

/** Records each arriving page's transition type, read after the page's own handler has run. */
const record = (page: Page) =>
  page.addInitScript(() => {
    addEventListener('pagereveal', (e) => {
      const t = (e as Event & { viewTransition?: ViewTransition & { types?: Set<string> } }).viewTransition;
      setTimeout(() =>
        sessionStorage.setItem('test.vt', t ? [...(t.types ?? [])].join(',') || 'untyped' : 'none'),
      );
    });
  });
const arrived = (page: Page) => page.evaluate(() => sessionStorage.getItem('test.vt'));
/** Follows a link once its page has been fetched ahead, as a visitor's pointer resting on it does. */
const follow = async (page: Page, selector: string) => {
  const link = page.locator(selector).first();
  await link.hover();
  await page.waitForTimeout(400);
  await link.click();
  await page.waitForLoadState();
};

test('each way of moving has its transition: a card opens and closes, sections slide, a language fades', async ({
  page,
}) => {
  await record(page);
  await page.goto('/work');
  await follow(page, '.cases .case-card');
  await expect(page).toHaveURL(/\/work\/buo$/);
  await expect.poll(() => arrived(page)).toBe('open');

  await page.goBack();
  await expect.poll(() => arrived(page)).toBe('close');

  await follow(page, '.mast nav a[href="/changelog"]');
  await expect.poll(() => arrived(page)).toBe('next');
  await follow(page, '.mast nav a[href="/work"]');
  await expect.poll(() => arrived(page)).toBe('prev');

  await page.goto('/');
  await follow(page, '.mast nav a[href="/about"]');
  await expect.poll(() => arrived(page)).toBe('in');

  await follow(page, '.mast [data-lang-switch="es"]');
  await expect(page).toHaveURL(/\/es\/about$/);
  await expect.poll(() => arrived(page)).toBe('lang');
});

test('with reduced motion, pages swap at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record(page);
  await page.goto('/work');
  await follow(page, '.cases .case-card');
  await expect.poll(() => arrived(page)).toBe('none');
});

test('every page names each moving part once, and the menu marks only the current section', async ({
  page,
}) => {
  for (const path of ['/', '/work', '/work/buo', '/changelog', '/precrease', '/about', '/es/about']) {
    await page.goto(path);
    const names = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .map((el) => getComputedStyle(el).viewTransitionName)
        .filter((n) => n && n !== 'none'),
    );
    expect(
      names.filter((n, i) => names.indexOf(n) !== i),
      path,
    ).toEqual([]);
    const marks = page.locator('.mast nav .nav-mark');
    await expect(marks).toHaveCount(path === '/' ? 0 : 1);
    if (path !== '/') await expect(page.locator('.mast nav a[aria-current="page"] .nav-mark')).toHaveCount(1);
  }
});
