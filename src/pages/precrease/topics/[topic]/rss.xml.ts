import type { APIRoute, GetStaticPaths } from 'astro';
import { topics } from '../../../../config/precrease';
import { getPosts } from '../../../../lib/precrease';
import { blogTitle, feed } from '../../../../lib/precrease-feed';
import { postsUnder } from '../../../../lib/precrease-tree';

export const getStaticPaths = (() =>
  topics.map((topic) => ({ params: { topic: topic.id }, props: { topic } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { topic } = props as { topic: (typeof topics)[number] };
  const posts = postsUnder(topics, await getPosts(), topic.id);
  return feed(posts, `${blogTitle}: ${topic.label}`, topic.intro);
};
