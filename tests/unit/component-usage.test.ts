import { describe, expect, test } from 'vitest';
import { buildComponentUsage, componentUsage } from '../../scripts/component-usage.mjs';

const card = 'src/components/precrease/PostCard.astro';
const note = 'src/components/precrease/MarginNote.astro';
const branch = 'src/components/precrease/TopicBranch.astro';
const panel = 'src/components/inspector/InspectorPanel.vue';

describe('componentUsage', () => {
  test('counts each tag, per file that imports the component', () => {
    const { components } = componentUsage(
      [
        {
          path: 'src/pages/index.astro',
          source: `import PostCard from '../components/precrease/PostCard.astro';\n<PostCard a /><PostCard b />`,
        },
        {
          path: 'src/pages/precrease/[slug].astro',
          source: `import PostCard from '../../components/precrease/PostCard.astro';\n<PostCard />`,
        },
      ],
      [card],
    );
    expect(components[0]).toMatchObject({ name: 'PostCard', group: 'precrease', uses: 3 });
    expect(components[0]!.usedIn).toEqual([
      { file: 'src/pages/index.astro', count: 2 },
      { file: 'src/pages/precrease/[slug].astro', count: 1 },
    ]);
  });

  test('a tag that only starts with the name is not a use', () => {
    const { components } = componentUsage(
      [
        {
          path: 'src/pages/index.astro',
          source: `import PostCard from '../components/precrease/PostCard.astro';\n<PostCards /><PostCard>`,
        },
      ],
      [card],
    );
    expect(components[0]!.uses).toBe(1);
  });

  test('components handed to post content count where posts write their tag', () => {
    const { components } = componentUsage(
      [
        {
          path: 'src/pages/precrease/[slug].astro',
          source: `import MarginNote from '../../components/precrease/MarginNote.astro';\n<Content components={{ MarginNote }} />`,
        },
        {
          path: 'src/content/precrease/a.mdx',
          source: 'Text.<MarginNote>one</MarginNote> <MarginNote>two</MarginNote>',
        },
        { path: 'src/content/precrease/b.mdx', source: 'No notes here.' },
      ],
      [note],
    );
    expect(components[0]!.usedIn).toEqual([{ file: 'src/content/precrease/a.mdx', count: 2 }]);
  });

  test('imported without a tag counts once; rendering itself and named imports are handled', () => {
    const { components, totals } = componentUsage(
      [
        {
          path: 'src/components/inspector/mount.ts',
          source: `import InspectorPanel, { type Manifest } from './InspectorPanel.vue';\ncreateApp(InspectorPanel)`,
        },
        { path: branch, source: `<Astro.self branch={child} />` },
        {
          path: 'src/pages/precrease/map.astro',
          source: `import TopicBranch, { type Branch } from '../../components/precrease/TopicBranch.astro';\n<TopicBranch branch={root}></TopicBranch>`,
        },
      ],
      [panel, branch],
    );
    expect(components.map((c) => [c.name, c.uses])).toEqual([
      ['InspectorPanel', 1],
      ['TopicBranch', 1],
    ]);
    expect(totals).toEqual({ components: 2, uses: 2, reused: 0, unused: [] });
  });
});

test('every component of this site is in use', () => {
  const { totals } = buildComponentUsage(process.cwd());
  expect(totals.components).toBeGreaterThan(0);
  expect(totals.unused).toEqual([]);
});
