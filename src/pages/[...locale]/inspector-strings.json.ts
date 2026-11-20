import type { APIRoute } from 'astro';
import { copyFor } from '../../i18n/dictionary';
import { langOf, localeStaticPaths } from '../../i18n/routing';

/**
 * The Inspector's words, one file per language (/inspector-strings.json, /es/inspector-strings.json),
 * fetched with its code when a visitor opens it (src/components/inspector/mount.ts). They used to
 * ride in every page's HTML, about 1 KB compressed that most visits never use; that pushed
 * /es/about past the first TCP window and cost it a round trip of LCP.
 */
export const getStaticPaths = localeStaticPaths;

export const GET: APIRoute = ({ params }) => {
  const copy = copyFor(langOf(params.locale));
  return new Response(JSON.stringify({ ...copy.inspector, identities: copy.identities }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
