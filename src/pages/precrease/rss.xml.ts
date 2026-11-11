import type { APIRoute } from 'astro';
import { copy } from '../../lib/copy';
import { getPosts } from '../../lib/precrease';
import { blogTitle, feed } from '../../lib/precrease-feed';

export const GET: APIRoute = async () => feed(await getPosts(), blogTitle, copy.precrease.description);
