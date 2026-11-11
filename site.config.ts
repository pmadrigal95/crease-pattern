import { VisualDirection } from './src/config/visual-direction';

/**
 * Site behaviour only. Personal data (name, role, contact) lives in
 * src/content/profile.json and is read through src/lib/profile.ts.
 */
export interface SiteConfig {
  /**
   * Canonical origin: canonical links, the sitemap and absolute URLs. It points at the live
   * workers.dev host until pablomadrigal.dev is registered (configured last, before M8); then it
   * moves back here, and the new host joins webAnalytics.hosts. astro.config.mjs reads it too.
   */
  url: string;
  /** Identity rendered by default; visitors can switch it from the inspector. */
  visualDirection: VisualDirection;
  /** The identity switcher is a public feature of the inspector, not a dev flag. */
  showDirectionSwitcher: boolean;
  /**
   * Cloudflare Web Analytics (cookieless). The token is public by design: it ships in every
   * page. The beacon loads only on `hosts`, so local runs and CI never report visits, and
   * never when the browser sends Global Privacy Control or Do Not Track. When the site moves
   * to its own domain, add that host here and to the Web Analytics site in Cloudflare.
   */
  webAnalytics: { token: string; hosts: string[] };
}

const siteConfig: SiteConfig = {
  url: 'https://crease-pattern.pablomadrigal-1995.workers.dev',
  visualDirection: VisualDirection.ContourLines,
  showDirectionSwitcher: true,
  webAnalytics: {
    token: 'a9ae426006c346c190a3e268f0de224b',
    hosts: ['crease-pattern.pablomadrigal-1995.workers.dev'],
  },
};

export default siteConfig;
