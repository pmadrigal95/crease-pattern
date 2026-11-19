/** Every origami figure as symbols, built once (src/lib/origami/sprite.ts). */
import type { APIRoute } from 'astro';
import { spriteSvg } from '../lib/origami/sprite';

export const GET: APIRoute = () =>
  new Response(spriteSvg(), { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
