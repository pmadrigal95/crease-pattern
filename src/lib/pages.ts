import { getEntry } from 'astro:content';
import { langOf } from '../i18n/routing';

export type PageId = 'about' | 'colophon' | 'privacy';

/**
 * A standalone page in a page's language: src/content/pages/<lang>/<id>.mdx. A missing
 * translation fails the build instead of showing another language.
 */
export async function getPage(id: PageId, locale?: string | null) {
  const path = `${langOf(locale)}/${id}`;
  const entry = await getEntry('pages', path);
  if (!entry) throw new Error(`src/content/pages/${path}.mdx is missing.`);
  return entry;
}
