/** Precrease's RSS feeds: the whole blog and one per topic (subtree included). */
import rss from '@astrojs/rss';
import site from '../../site.config';
import { copyFor } from '../i18n/dictionary';
import { DEFAULT_LANG } from '../i18n/routing';
import { creaseNumber, postHref, type PostSummary } from './precrease';

export const feed = (posts: PostSummary[], title: string, description: string) => {
  return rss({
    title,
    description,
    site: site.url,
    items: posts.map((p) => ({
      title: `${creaseNumber(p.number)} · ${p.entry.data.title}`,
      description: p.entry.data.description,
      pubDate: p.entry.data.date,
      link: postHref(p.id),
      categories: p.entry.data.topics,
    })),
    customData: `<language>en</language>`,
  });
};

export const blogTitle = copyFor(DEFAULT_LANG).precrease.name;
