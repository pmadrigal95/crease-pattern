import { expect, test, type Page } from '@playwright/test';

// Every word of a case figure (src/components/work/figures) reads whole: inside the box it labels,
// with room to spare, inside its drawing, and clear of the other words. Measured in the browser
// with the real fonts, in both languages, in the wide drawing (desktop) and the tall one (phone):
// a longer word once pushed "several threads" through its box's border.
const PAD = 3;

/** Words that don't read whole, as "plate: word …" lines. */
const overflowing = (page: Page, drawing: 'wide' | 'tall') =>
  page.evaluate(
    ([kind, pad]) => {
      type Box = { x: number; y: number; width: number; height: number };
      /** Whether `a` lies within `b`, keeping `margin` from its sides. */
      const within = (a: Box, b: Box, margin: number) =>
        a.x >= b.x + margin &&
        a.y >= b.y - 0.5 &&
        a.x + a.width <= b.x + b.width - margin &&
        a.y + a.height <= b.y + b.height + 0.5;
      const overlaps = (a: Box, b: Box) =>
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      /** The smallest box the point falls in: the one a word labels. */
      const boxAt = (boxes: Box[], x: number, y: number) =>
        boxes
          .filter((b) => x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height)
          .sort((a, b) => a.width * a.height - b.width * b.height)[0];

      const problems: string[] = [];
      for (const svg of document.querySelectorAll<SVGSVGElement>(`.case-figure svg.${kind}`)) {
        const name = svg.closest('[data-plate]')?.id ?? '?';
        const view = svg.viewBox.baseVal;
        const boxes = [...svg.querySelectorAll<SVGGraphicsElement>('.box')].map((b) => b.getBBox());
        const words = [...svg.querySelectorAll<SVGTextElement>('text')].map((x) => ({
          w: x.textContent?.trim() ?? '',
          b: x.getBBox(),
        }));
        for (const { w, b } of words) {
          if (!within(b, view, -0.5)) problems.push(`${name}: "${w}" leaves the drawing`);
          const box = boxAt(boxes, b.x + b.width / 2, b.y + b.height / 2);
          if (box && !within(b, box, pad))
            problems.push(
              `${name}: "${w}" touches its box (${Math.round(b.width)} in ${Math.round(box.width)})`,
            );
        }
        words.forEach((a, i) =>
          words.slice(i + 1).forEach((b) => {
            if (overlaps(a.b, b.b)) problems.push(`${name}: "${a.w}" runs into "${b.w}"`);
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
