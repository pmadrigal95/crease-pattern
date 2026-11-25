import type { APIRoute } from 'astro';
import { copyFor } from '../../i18n/dictionary';
import { langOf, localeStaticPaths } from '../../i18n/routing';

/**
 * The walkthrough's words, one file per language (/walkthrough.json, /es/walkthrough.json), fetched
 * with its code when a visitor starts it (src/components/site/walkthrough.ts). Kept out of the
 * pages' HTML, like the Inspector's: most visits never take it.
 */
export const getStaticPaths = localeStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(copyFor(langOf(params.locale)).walkthrough), {
    headers: { 'Content-Type': 'application/json' },
  });
