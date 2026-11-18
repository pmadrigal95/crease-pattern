/**
 * Social preview images for the site's own pages (M4.4): home, About, Changelog and Colophon, each
 * with its title and description. Pages without one of their own use the home card
 * (src/layouts/BaseLayout.astro). Precrease posts have theirs at /precrease/og/<slug>.png.
 */
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { copy } from '../../lib/copy';
import { getProfile } from '../../lib/profile';
import { ogPageImage } from '../../lib/og-image';

export async function getStaticPaths() {
  const profile = await getProfile();
  const page = async (id: 'about' | 'colophon') => {
    const entry = await getEntry('pages', id);
    if (!entry) throw new Error(`src/content/pages/${id}.mdx is missing.`);
    return { kicker: entry.data.title, title: entry.data.description };
  };
  const cards = {
    // The home page's own headline; the name is already the signature.
    home: { kicker: profile.role, title: copy.home.hero.title },
    about: await page('about'),
    changelog: { kicker: copy.changelogPage.title, title: copy.changelogPage.description },
    colophon: await page('colophon'),
  };
  return Object.entries(cards).map(([id, card]) => ({
    params: { page: id },
    props: { ...card, name: profile.name },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { kicker, title, name } = props as { kicker: string; title: string; name: string };
  const png = await ogPageImage({ kicker, title, name });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
