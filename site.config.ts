import { VisualDirection } from './src/config/visual-direction';

/**
 * Site behaviour only. Personal data (name, role, contact) lives in
 * src/content/profile.json and is read through src/lib/profile.ts.
 */
export interface SiteConfig {
  url: string;
  /** Identity rendered by default; visitors can switch it from the inspector. */
  visualDirection: VisualDirection;
  /** The identity switcher is a public feature of the inspector, not a dev flag. */
  showDirectionSwitcher: boolean;
}

const siteConfig: SiteConfig = {
  url: 'https://pablomadrigal.dev',
  visualDirection: VisualDirection.ContourLines,
  showDirectionSwitcher: true,
};

export default siteConfig;
