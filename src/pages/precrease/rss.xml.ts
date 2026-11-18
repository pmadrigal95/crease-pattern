import type { APIRoute } from 'astro';
import { copyFor } from '../../i18n/dictionary';
import { DEFAULT_LANG } from '../../i18n/routing';
import { getPosts } from '../../lib/precrease';
import { blogTitle, feed } from '../../lib/precrease-feed';

export const GET: APIRoute = async () =>
  feed(await getPosts(), blogTitle, copyFor(DEFAULT_LANG).precrease.description);
