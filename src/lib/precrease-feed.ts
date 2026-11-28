/**
 * Precrease's RSS feeds: the whole blog and one per topic (subtree included), one set per language
 * (M5.5): /precrease/rss.xml, /es/precrease/rss.xml… A feed carries only posts written in its
 * language; a reader of the Spanish feed never gets an English item.
 */
import rss from '@astrojs/rss';
import site from '../../site.config';
import { copyFor } from '../i18n/dictionary';
import { LOCALES, localize, type Lang } from '../i18n/routing';
import { creaseNumber, getPosts, postHref, type PostSummary } from './precrease';

/** Where a language's feed lives: the whole blog, or one topic. */
export const feedHref = (lang: Lang, topic?: string): string =>
  localize(topic ? `/precrease/topics/${topic}/rss.xml` : '/precrease/rss.xml', lang);

/** The posts written in `lang`, newest first. */
export const feedPosts = async (lang: Lang): Promise<PostSummary[]> =>
  (await getPosts(lang)).filter((p) => p.lang === lang);

/** One post as a feed item: what a reader app receives (the feed below, and Subscribe's preview). */
export const feedItem = (p: PostSummary, lang: Lang) => ({
  title: `${creaseNumber(p.number, lang)} · ${p.entry.data.title}`,
  description: p.entry.data.description,
  pubDate: p.entry.data.date,
  link: postHref(p),
  categories: p.entry.data.topics,
});

export const feed = (posts: PostSummary[], lang: Lang, title: string, description: string) => {
  return rss({
    title,
    description,
    // The channel links to Precrease in the feed's language; items keep the site's URLs, which
    // never end in a slash (astro.config.ts, trailingSlash).
    site: new URL(localize('/precrease', lang), site.url).href,
    trailingSlash: false,
    items: posts.map((p) => feedItem(p, lang)),
    customData: `<language>${LOCALES[lang].htmlLang}</language>`,
  });
};

export const blogTitle = (lang: Lang) => copyFor(lang).precrease.name;
