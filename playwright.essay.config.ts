import { defineConfig, devices } from '@playwright/test';

// End-to-end tests for interactive essays (tests/essay). They need two things the main suite's
// server lacks: drafts (a preview build, PRECREASE_PREVIEW=1) and public/_headers applied, so the
// page is cross-origin isolated and real Web Workers share memory (scripts/serve-dist.mjs).
// The build replaces dist/ with the preview one, so CI runs this after Lighthouse.
export default defineConfig({
  testDir: 'tests/essay',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4323' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // npm, not pnpm, as in playwright.config.ts.
    command: 'npm run build && node scripts/serve-dist.mjs 4323',
    env: { PRECREASE_PREVIEW: '1' },
    url: 'http://localhost:4323',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
