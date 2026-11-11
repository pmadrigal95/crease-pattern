import type { APIRoute } from 'astro';
import { formats } from '../../../config/precrease';
import { getPosts } from '../../../lib/precrease';
import { creaseNumber } from '../../../lib/precrease-tree';
import { ogImage } from '../../../lib/og-image';

export async function getStaticPaths() {
  const posts = await getPosts();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as Awaited<ReturnType<typeof getStaticPaths>>[number]['props'];
  const { data } = post.entry;
  const png = await ogImage({
    slug: post.id,
    family: formats[data.format].family,
    kicker: `${creaseNumber(data.number)} · ${formats[data.format].label}`,
    title: data.title,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
