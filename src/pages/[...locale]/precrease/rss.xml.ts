import type { APIRoute } from 'astro';
import { copyFor } from '../../../i18n/dictionary';
import { langOf, localeStaticPaths } from '../../../i18n/routing';
import { blogTitle, feed, feedPosts } from '../../../lib/precrease-feed';

/** The whole blog's feed in every language: /precrease/rss.xml, /es/precrease/rss.xml. */
export const getStaticPaths = localeStaticPaths;

export const GET: APIRoute = async ({ params }) => {
  const lang = langOf(params.locale);
  return feed(await feedPosts(lang), lang, blogTitle(lang), copyFor(lang).precrease.description);
};
