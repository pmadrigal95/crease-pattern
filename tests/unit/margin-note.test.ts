import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { expect, test } from 'vitest';
import MarginNote from '../../src/components/precrease/MarginNote.astro';

// Margin notes (decision 48) sit inside a sentence, so everything they render must be phrasing
// content, and the toggle has to work without JavaScript: a labelled checkbox before its marker.
test('a margin note renders phrasing content with a labelled toggle and a stable id', async () => {
  const container = await AstroContainer.create();
  const render = () =>
    container.renderToString(MarginNote, { slots: { default: 'Folders call this <em>precreasing</em>.' } });
  const html = await render();

  expect(html).not.toMatch(/<(div|p|details|section|aside)\b/);
  const id = /<input type="checkbox" id="(margin-note-[a-z0-9]+)"/.exec(html)?.[1];
  expect(id).toBeDefined();
  expect(html).toMatch(new RegExp(`for="${id}"[^>]*>.*Show margin note`));
  expect(html).toContain('<em>precreasing</em>');
  // The same note always gets the same id, so builds are reproducible.
  expect(await render()).toContain(`id="${id}"`);
});
