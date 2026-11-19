import type { APIRoute } from 'astro';
import { formatsFor } from '../../../lib/taxonomy';
import { DEFAULT_LANG } from '../../../i18n/routing';
import { creaseNumber, getPosts } from '../../../lib/precrease';
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
    family: formatsFor(DEFAULT_LANG)[data.format].family,
    kicker: `${creaseNumber(data.number)} · ${formatsFor(DEFAULT_LANG)[data.format].label}`,
    title: data.title,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
