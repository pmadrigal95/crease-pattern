import { expect, test } from '@playwright/test';
import { auditedPages, themes } from '../../src/config/quality';
import { allVisualDirections } from '../../src/config/visual-direction';

// Every page, in all 3 identities × 2 themes, full length. Canvases (the hero's ink effect) are
// masked: they animate on their own and aren't what a refactor of markup and CSS can break.

for (const path of auditedPages) {
  for (const direction of allVisualDirections) {
    for (const theme of themes) {
      test(`${path} · ${direction} · ${theme}`, async ({ page }, info) => {
        await page.addInitScript(
          ([d, t]) => {
            localStorage.setItem('pm.direction', d);
            localStorage.setItem('pm.theme', t);
          },
          [direction, theme] as const,
        );
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const name = `${info.project.name}${path === '/' ? '/home' : path}-${direction}-${theme}.png`;
        await expect(page).toHaveScreenshot(name.replaceAll('/', '_'), {
          fullPage: true,
          mask: [page.locator('canvas')],
        });
      });
    }
  }
}
