/**
 * Trusted Types (the Content Security Policy's `require-trusted-types-for 'script'`, astro.config.ts).
 * The site writes no HTML strings into the DOM and runs no code built from strings; the one script
 * URL it hands the browser is its own Web Worker (threads/pool.ts). The default policy lets
 * same-origin script URLs through and nothing else: a script from another origin, or HTML or code
 * from a string, is refused even if a library tried. Vue keeps its own policy, "vue".
 *
 * Browsers without Trusted Types ignore all of this.
 */

/** The part of the Trusted Types API this file uses (not yet in TypeScript's DOM library). */
interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL?: (url: string) => string }): unknown;
  defaultPolicy: unknown;
}

/** Creates the default policy once: same-origin script URLs only. */
export const trustSameOriginScripts = (): void => {
  const factory = (globalThis as { trustedTypes?: TrustedTypesFactory }).trustedTypes;
  if (!factory || factory.defaultPolicy) return;
  factory.createPolicy('default', {
    createScriptURL: (url) => {
      if (new URL(url, location.href).origin !== location.origin)
        throw new TypeError(`Trusted Types: script URL from another origin refused: ${url}`);
      return url;
    },
  });
};
