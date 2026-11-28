import { defineConfig, devices } from '@playwright/test';
import { tipSeen } from './tests/tip-seen';

// E2E_PORT lets a run use a server of its own when another checkout's preview already holds 4321:
// reuseExistingServer would otherwise test that other build.
const port = Number(process.env.E2E_PORT ?? 4321);
const origin = `http://localhost:${port}`;
const softwareGl = /(scene3d|hero-pointer|work-model|changelog3d)\.spec\.ts$/;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: origin, storageState: tipSeen(origin) },
  projects: [
    { name: 'chromium', testIgnore: softwareGl, use: { ...devices['Desktop Chrome'] } },
    // The specs that render WebGL on the CPU (SwiftShader), one at a time: two software scenes at
    // once starve each other, and then the scene rightly hands the square back to the SVG
    // (src/components/inspector/hero-motion.ts, FrameProbe) or a lazy chunk misses its wait.
    { name: 'software-gl', testMatch: softwareGl, workers: 1, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // npm, not pnpm: npm ships with Node, so the suite starts on any machine (pnpm may only exist via corepack).
    command: `npm run build && npm run preview -- --port ${port}`,
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
