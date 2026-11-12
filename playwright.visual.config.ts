import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression, local only: a safety net for refactors that must not change what visitors
 * see. Take baselines before the change (`npm run test:visual -- --update-snapshots`), compare
 * after (`npm run test:visual`). Screenshots depend on the OS's font rendering, so baselines stay
 * on the machine that took them (git-ignored) and CI doesn't run this suite.
 */
export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '.visual-baselines/{arg}{ext}',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4321', reducedMotion: 'reduce' },
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
