import { expect, test, type Page } from '@playwright/test';

// Every word of a case figure (src/components/work/figures) reads whole: inside the box it labels,
// with room to spare, and inside its drawing. Measured in the browser with the real fonts, in both
// languages, in the wide drawing (desktop) and the tall one (phone): a longer word in one language
// or a wider font once pushed "several threads" through its box's border.
const PAD = 3;

/** Words that overflow, as "figure: word" lines. */
const overflowing = (page: Page, drawing: 'wide' | 'tall') =>
  page.evaluate(
    ([kind, pad]) => {
      const problems: string[] = [];
      for (const svg of document.querySelectorAll<SVGSVGElement>(`.case-figure svg.${kind}`)) {
        const name = svg.closest('[data-plate]')?.id ?? '?';
        const view = svg.viewBox.baseVal;
        const boxes = [...svg.querySelectorAll<SVGGraphicsElement>('.box')].map((b) => b.getBBox());
        for (const text of svg.querySelectorAll<SVGTextElement>('text')) {
          const t = text.getBBox();
          const word = text.textContent?.trim() ?? '';
          if (t.x < view.x - 0.5 || t.y < view.y - 0.5 || t.x + t.width > view.x + view.width + 0.5 || t.y + t.height > view.y + view.height + 0.5)
            problems.push(`${name}: "${word}" leaves the drawing`);
          const cx = t.x + t.width / 2;
          const cy = t.y + t.height / 2;
          // The box this word labels: the smallest one its centre falls in.
          const box = boxes
            .filter((b) => cx > b.x && cx < b.x + b.width && cy > b.y && cy < b.y + b.height)
            .sort((a, b) => a.width * a.height - b.width * b.height)[0];
          if (box && (t.x < box.x + pad || t.x + t.width > box.x + box.width - pad))
            problems.push(`${name}: "${word}" touches its box (${Math.round(t.width)} in ${Math.round(box.width)})`);
        }
        // Words outside boxes must not run into one another.
        const loose = [...svg.querySelectorAll<SVGTextElement>('text')].map((x) => ({ w: x.textContent?.trim(), b: x.getBBox() }));
        loose.forEach((a, i) =>
          loose.slice(i + 1).forEach((b) => {
            const overlap =
              a.b.x < b.b.x + b.b.width && b.b.x < a.b.x + a.b.width && a.b.y < b.b.y + b.b.height && b.b.y < a.b.y + a.b.height;
            if (overlap) problems.push(`${name}: "${a.w}" runs into "${b.w}"`);
          }),
        );
      }
      return problems;
    },
    [drawing, PAD] as const,
  );

for (const path of ['/work/buo', '/work/crease-pattern', '/es/work/buo', '/es/work/crease-pattern']) {
  test(`${path}: every figure's words fit, wide and tall`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    expect(await overflowing(page, 'wide')).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    expect(await overflowing(page, 'tall')).toEqual([]);
  });
}
