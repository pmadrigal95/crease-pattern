import type { APIRoute } from 'astro';
import { formatsFor } from '../../../lib/taxonomy';
import { creaseNumber, getEditions } from '../../../lib/precrease';
import { ogImage } from '../../../lib/og-image';

/** One share image per edition, in its own language; the artwork is the post's, seeded by its key. */
export const getStaticPaths = async () => {
  const posts = await getEditions();
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as Awaited<ReturnType<typeof getStaticPaths>>[number]['props'];
  const { data } = post.entry;
  const format = formatsFor(post.lang)[data.format];
  const png = await ogImage({
    slug: post.key,
    family: format.family,
    kicker: `${creaseNumber(data.number, post.lang)} · ${format.label}`,
    title: data.title,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
