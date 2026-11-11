import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import siteConfig from './site.config.ts';
import { pageRevealScript, restoreIdentityScript, sha256 } from './scripts/csp-hashes.mjs';

export default defineConfig({
  site: siteConfig.url,
  // Static HTML by default. Vue powers the Inspector only, loaded when a visitor opens it.
  output: 'static',
  integrations: [vue(), mdx(), sitemap()],
  // The Inspector uses Vue's Composition API only: drop the Options API and devtools hooks from the
  // production runtime to keep the panel inside its 30 KB budget.
  vite: {
    define: {
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
  },
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
        // 'wasm-unsafe-eval' lets Precrease search compile Pagefind's WebAssembly; it does not allow eval().
        resources: ["'self'", "'wasm-unsafe-eval'", 'https://static.cloudflareinsights.com'],
        hashes: [sha256(restoreIdentityScript), sha256(pageRevealScript)],
      },
    },
  },
});
