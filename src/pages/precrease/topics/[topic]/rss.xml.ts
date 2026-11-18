import type { APIRoute, GetStaticPaths } from 'astro';
import { topicsFor } from '../../../../lib/taxonomy';
import { DEFAULT_LANG } from '../../../../i18n/routing';

import { getPosts } from '../../../../lib/precrease';
import { blogTitle, feed } from '../../../../lib/precrease-feed';
import { postsUnder } from '../../../../lib/precrease-tree';

export const getStaticPaths = (() =>
  topicsFor(DEFAULT_LANG).map((topic) => ({
    params: { topic: topic.id },
    props: { topic },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: ReturnType<typeof topicsFor>[number] };
  const posts = postsUnder(topicsFor(DEFAULT_LANG), await getPosts(), topic.id);
  return feed(posts, `${blogTitle}: ${topic.label}`, topic.intro);
};
