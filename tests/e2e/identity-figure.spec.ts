import { expect, test, type Page } from '@playwright/test';

// A change of identity that brings a new origami figure refolds the marks on every page
// (src/components/inspector/identity.ts, src/styles/origami.css); away from the home page the
// Inspector offers to watch the full figure fold there (InspectorHero.vue, ?fold in HeroFold.astro).
const ready = { timeout: 15_000 };

const openInspector = async (page: Page) => {
  await page.locator('[data-inspector-toggle]').click();
  await expect(page.locator('#pm-inspector')).toBeVisible(ready);
};
const pick = (page: Page, name: string) => page.locator(`input[name="${name}"]`);

test('a new identity refolds the masthead and footer marks', async ({ page }) => {
  await page.goto('/about');
  await openInspector(page);
  // Watch for the marks' own transition layers while the identity changes.
  const seen = page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const names = new Set<string>();
        const look = () => {
          for (const a of document.getAnimations()) {
            const pseudo = (a.effect as KeyframeEffect | null)?.pseudoElement ?? '';
            if (/mark-(head|foot)/.test(pseudo)) names.add(pseudo);
          }
          if (names.size >= 4) resolve([...names].sort());
          else requestAnimationFrame(look);
        };
        look();
        setTimeout(() => resolve([...names].sort()), 3000);
      }),
  );
  await pick(page, 'inspector-direction').and(page.locator('[value="washi-asagi"]')).check({ force: true });
  expect(await seen).toEqual([
    '::view-transition-new(mark-foot)',
    '::view-transition-new(mark-head)',
    '::view-transition-old(mark-foot)',
    '::view-transition-old(mark-head)',
  ]);
});

test('away from home, a new figure brings a link to watch it fold there', async ({ page }) => {
  await page.goto('/work');
  await openInspector(page);
  const link = page
    .locator('#pm-inspector')
    .getByRole('link', { name: 'See the figure fold on the home page →' });
  await expect(link).toHaveCount(0);
  // Contour lines to Basalt & glacier: a new figure, the fox.
  await pick(page, 'inspector-direction')
    .and(page.locator('[value="basalt-glacier"]'))
    .check({ force: true });
  await expect(link).toBeVisible(ready);
  await expect(link).toHaveAttribute('href', '/?fold');
});

test('a theme change that keeps the figure brings no link', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pm.direction', 'basalt-glacier'));
  await page.goto('/es/work');
  await openInspector(page);
  await pick(page, 'inspector-theme').and(page.locator('[value="dark"]')).check({ force: true });
  await page.waitForTimeout(1500);
  await expect(page.locator('#pm-inspector').getByRole('link', { name: /figura doblarse/ })).toHaveCount(0);
});

test('?fold opens the home page with the figure flat, then folds it', async ({ page }) => {
  await page.addInitScript(() => {
    const values: string[] = ((window as unknown as { folds: string[] }).folds = []);
    new MutationObserver((records) => {
      for (const r of records) values.push((r.target as Element).getAttribute('aria-valuenow') ?? '');
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-valuenow'] });
  });
  await page.goto('/?fold');
  const slider = page.getByRole('slider', { name: 'Unfold the figure into its crease pattern' });
  await expect(slider).toHaveAttribute('aria-valuenow', '0', ready);
  const folds = await page.evaluate(() => (window as unknown as { folds: string[] }).folds);
  expect(folds.slice(0, 2)).toEqual(['100', '0']);
});
