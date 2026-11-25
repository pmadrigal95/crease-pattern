import { expect, test } from '@playwright/test';

// The masthead holds one row at every width: from 375 px up, the logo, the whole menu, the language
// and Inspect fit inside the page's margins; below that, only the menu scrolls sideways. Spanish has
// the longer menu, so it's the one that breaks first. Each width leaves a few pixels of room, since
// fonts render slightly wider on some systems (Linux in CI).

const widths = [320, 360, 375, 390, 430, 475, 570, 640, 725, 740, 768, 820, 1024];

for (const path of ['/es/about', '/about']) {
  test(`the masthead never widens ${path}`, async ({ page }) => {
    for (const width of widths) {
      await page.setViewportSize({ width, height: 700 });
      await page.goto(path);
      const fit = await page.evaluate(() => {
        const row = document.querySelector('.mast .wrap');
        if (!row) throw new Error('No masthead');
        const inRow = [...row.children].filter((e) => getComputedStyle(e).position !== 'fixed');
        const menu = row.querySelector('nav');
        if (!menu) throw new Error('No menu');
        return {
          page: document.documentElement.scrollWidth,
          menuHidden: menu.scrollWidth - menu.clientWidth,
          rowEnd: Math.max(...inRow.map((e) => e.getBoundingClientRect().right)),
        };
      });
      expect(fit.page, `page width at ${width}px`).toBeLessThanOrEqual(width);
      if (width < 375) continue;
      expect(fit.rowEnd, `masthead at ${width}px`).toBeLessThanOrEqual(width - 16);
      expect(fit.menuHidden, `menu cut off at ${width}px`).toBe(0);
    }
  });
}
