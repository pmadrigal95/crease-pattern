/** Precrease's RSS feeds: the whole blog and one per topic (subtree included). */
import rss from '@astrojs/rss';
import site from '../../site.config';
import { copy } from './copy';
import { creaseNumber, postHref, type PostSummary } from './precrease';

export function feed(posts: PostSummary[], title: string, description: string) {
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
}

export const blogTitle = copy.precrease.name;
