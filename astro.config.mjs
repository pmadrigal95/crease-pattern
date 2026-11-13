import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import siteConfig from './site.config.ts';
import { pageRevealScript, restoreIdentityScript, sha256 } from './scripts/csp-hashes.mjs';
import { devIsolation } from './scripts/dev-isolation.mjs';

export default defineConfig({
  site: siteConfig.url,
  // Static HTML by default. Vue powers the Inspector only, loaded when a visitor opens it.
  output: 'static',
  // Code blocks: GitHub's dark theme, the "default" variant, whose comments pass WCAG AA contrast
  // (the plain variant's grey comments measure 3:1).
  markdown: { shikiConfig: { theme: 'github-dark-default' } },
  integrations: [vue(), mdx(), sitemap()],
  // The Inspector uses Vue's Composition API only: drop the Options API and devtools hooks from the
  // production runtime to keep the panel inside its 30 KB budget.
  vite: {
    build: {
      // A page's own stylesheet (up to 12 KB) goes inline in its HTML, so it doesn't block the first paint
      // with a round trip: in CI, About's and the home page's each cost ~300 ms of render-blocking. The shared stylesheet stays a
      // cached file. Everything else keeps the default 4 KB rule (undefined = default).
      assetsInlineLimit: (file, content) =>
        file.endsWith('.css') && content.length < 12288 ? true : undefined,
    },
    // Development only: the same cross-origin isolation public/_headers gives production, so the
    // Threads essay runs its shared-memory models under `astro dev`.
    plugins: [devIsolation()],
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
      // Declared explicitly so a page can add a source (giscus on posts) without replacing 'self':
      // Astro's insertStyleResource() overrides the default list instead of extending it.
      styleDirective: {
        resources: ["'self'"],
      },
      scriptDirective: {
        // Precrease search adds 'wasm-unsafe-eval' on its own pages only (PrecreaseSearch.astro).
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
        hashes: [sha256(restoreIdentityScript), sha256(pageRevealScript)],
      },
    },
  },
});
