/**
 * The hero's figure in 3D: when it loads, and who shares it.
 *
 * - Only on a page with the hero, and only on a device that can run it: WebGL 2, enough memory, no
 *   request for reduced motion (src/lib/scene3d-support.ts), and no data saver.
 * - Only after the visitor moves: a pointer moving, a scroll, a touch or a key. The SVG is the
 *   first frame and stays the whole picture until then, so the first load, its LCP and Lighthouse
 *   never pay for three.js.
 * - One scene per page: the Inspector takes it apart instead of building another
 *   (src/components/inspector/mount.ts).
 * - If the device can't keep a smooth frame rate, the scene hands the square back to the SVG for
 *   the rest of the visit to this page.
 *
 * Started by the hero's own script (src/components/site/HeroFold.astro), so only the home page
 * loads it; three.js is a chunk of its own (scene3d), loaded on demand.
 */
import { canRun3D, detectDevice } from '../lib/scene3d-support';
import type { FigureScene } from '../components/inspector/scene3d';

const FIRST_MOVES = ['pointermove', 'wheel', 'scroll', 'touchstart', 'keydown'] as const;

let scene: Promise<FigureScene | null> | null = null;
let gaveUp = false;

const stage = () => document.querySelector<HTMLElement>('[data-hero-fold] [data-stage]');

const allowed = (): boolean => {
  if (gaveUp || !stage()) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !connection?.saveData && canRun3D(detectDevice());
};

/** The hero's scene, mounted the first time it's asked for; null where 3D doesn't belong. */
export const heroScene = (): Promise<FigureScene | null> => {
  if (scene) return scene;
  if (!allowed()) return Promise.resolve(null);
  scene = import('../components/inspector/scene3d')
    .then(({ mountFigureScene }) => {
      const mounted = mountFigureScene(stage()!, () => {
        // Too slow here: the SVG takes the square back, and stays.
        gaveUp = true;
        mounted.dispose();
        scene = Promise.resolve(null);
      });
      return mounted;
    })
    .catch((error: unknown) => {
      // Offline, or no WebGL context after all: the SVG figure stays, a complete picture.
      console.warn('3D scene unavailable; the SVG figure stays', error);
      return null;
    });
  return scene;
};

/** Mounts the hero's scene at the visitor's first move, on pages that have the hero. */
export const initHero3d = (): void => {
  if (!stage()) return;
  const go = (event: Event) => {
    // The browser sends a pointermove with no movement when the page changes under a pointer that
    // is resting on it; that isn't the visitor moving. (A page's very first pointermove also reports
    // none; the next one, a few milliseconds later, counts.)
    if (event instanceof PointerEvent && event.type === 'pointermove' && !event.movementX && !event.movementY)
      return;
    for (const type of FIRST_MOVES) removeEventListener(type, go);
    void heroScene();
  };
  for (const type of FIRST_MOVES) addEventListener(type, go, { passive: true });
};
