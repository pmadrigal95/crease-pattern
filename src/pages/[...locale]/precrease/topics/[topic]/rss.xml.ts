import type { APIRoute } from 'astro';
import { topicsFor, type Topic } from '../../../../../lib/taxonomy';
import { langOf, localeStaticPaths } from '../../../../../i18n/routing';
import { blogTitle, feed, feedPosts } from '../../../../../lib/precrease-feed';
import { postsUnder } from '../../../../../lib/precrease-tree';

/** One feed per topic and language: /precrease/topics/<id>/rss.xml, /es/precrease/topics/<id>/rss.xml. */
export const getStaticPaths = () =>
  localeStaticPaths().flatMap(({ params }) =>
    topicsFor(langOf(params.locale)).map((topic) => ({
      params: { ...params, topic: topic.id },
      props: { topic },
    })),
  );

export const GET: APIRoute = async ({ params, props }) => {
  const lang = langOf(params.locale);
  const { topic } = props as { topic: Topic };
  const posts = postsUnder(topicsFor(lang), await feedPosts(lang), topic.id);
  return feed(posts, lang, `${blogTitle(lang)}: ${topic.label}`, topic.intro);
};
