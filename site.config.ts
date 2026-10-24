import { VisualDirection } from './src/config/visual-direction';

export interface SiteConfig {
  url: string;
  author: string;
  role: string;
  /** Identity rendered by default; visitors can switch it from the inspector. */
  visualDirection: VisualDirection;
  /** The identity switcher is a public feature of the inspector, not a dev flag. */
  showDirectionSwitcher: boolean;
  contact: { email: string; linkedin: string; github: string };
}

const siteConfig: SiteConfig = {
  url: 'https://pablomadrigal.dev',
  author: 'Pablo Madrigal',
  role: 'Lead Frontend Architect',
  visualDirection: VisualDirection.ContourLines,
  showDirectionSwitcher: true,
  contact: {
    email: 'pablomadrigal.1995@gmail.com',
    linkedin: 'https://www.linkedin.com/in/pablomadrigal95/',
    github: 'https://github.com/pmadrigal95',
  },
};

export default siteConfig;
