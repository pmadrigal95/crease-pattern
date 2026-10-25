import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { restoreIdentityScript, sha256 } from './scripts/csp-hashes.mjs';

export default defineConfig({
  site: 'https://pablomadrigal.dev',
  // Static HTML by default; only islands (inspector, Threads, fluid ink) ship JavaScript.
  output: 'static',
  integrations: [vue(), mdx(), sitemap()],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  // One URL per page, without a trailing slash: pages build to changelog.html, which
  // Cloudflare serves at /changelog directly (no 307 to /changelog/).
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  // Content Security Policy as a <meta> tag per page. Astro hashes every inline
  // script and style it renders, so no 'unsafe-inline' is needed. frame-ancestors
  // can't live in a meta tag; it is sent as a header from public/_headers.
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        // Vite inlines the smallest font subsets as data: URIs.
        "font-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        hashes: [sha256(restoreIdentityScript)],
      },
    },
  },
});
