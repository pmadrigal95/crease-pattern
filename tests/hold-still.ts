import type { Page } from '@playwright/test';

/**
 * Stops the page's drawing loops where they stand, before axe reads the page. On CI the 3D scenes
 * render on the CPU (SwiftShader), and a scene redrawing every frame while axe works through the
 * page can starve the tab until it crashes ("Target crashed") or the test times out: CI's run of
 * main after #150 failed that way while the same code passed everywhere else. The canvases keep
 * their last frame, and axe checks the page's words, roles and colours, never the pixels drawn in
 * a canvas, so the result is the same. CSS animations keep running: an entrance stopped mid-fade
 * would read as low contrast.
 */
export const holdStill = (page: Page): Promise<void> =>
  page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
