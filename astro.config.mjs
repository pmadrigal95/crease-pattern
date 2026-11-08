import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { restoreIdentityScript, sha256 } from './scripts/csp-hashes.mjs';

export default defineConfig({
  site: 'https://pablomadrigal.dev',
  // Static HTML by default. Islands get a framework integration only when one needs it (the
  // Inspector in M2); until then no framework runtime ships.
  output: 'static',
  integrations: [mdx(), sitemap()],
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
        // Cloudflare Web Analytics posts its cookieless beacon here (see /privacy).
        "connect-src 'self' https://cloudflareinsights.com",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
        hashes: [sha256(restoreIdentityScript)],
      },
    },
  },
});
