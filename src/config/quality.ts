/**
 * The site's quality bar, as data. The accessibility suite audits these pages in these themes,
 * the budget script enforces these limits, and the home page's "This site, measured" reads the
 * same values, so what the site claims and what CI enforces can't drift apart.
 *
 * Dependency-free on purpose: Node scripts import this file directly (type stripping).
 */
export const auditedPages = [
  '/',
  '/changelog',
  '/about',
  '/colophon',
  '/privacy',
  '/precrease',
  '/precrease/map',
  '/precrease/the-work-before-the-shape',
  '/precrease/topics/frontend',
  '/precrease/subscribe',
  '/this-page-does-not-exist',
] as const;

export const themes = ['light', 'dark'] as const;

/** JavaScript budgets in KB, Brotli (decision 44). */
export const jsBudgetKb = {
  /** Every script an HTML page references directly. */
  page: 15,
  /** What those scripts can import later: today the Inspector. */
  onDemand: 32,
  /**
   * The Inspector's manifest (src/generated/inspector.json), fetched when the panel opens. It grows
   * with every inspectable part, so it lives outside the panel's code with a budget of its own:
   * 2.2 KB when this was set (Pablo, 2026-11-13, amending decision 44).
   */
  inspectorData: 4,
  /**
   * The Work section's Sonobe animator (src/components/site/work-model.ts), loaded on the home
   * page as the section approaches: the star's geometry, its two inputs and the SVG renderer.
   */
  workModel: 8,
  /**
   * M4's 3D scenes, the hero's fox and the Work star, which share one three.js. They load only on
   * the home page, on a device that can run them (src/lib/scene3d-support.ts). Set at 180 KB in
   * the M4 plan; about 100 KB at M4.1.
   */
  scene3d: 180,
  /**
   * The 3D scenes' data, fetched with the scene: today the Irazú's height grid from Copernicus
   * GLO-30 (src/assets/scenes/irazu-dem.bin), 28.5 KB. The M4 plan capped it at 150 KB.
   */
  sceneData: 150,
  /**
   * Everything one Precrease post can run, Web Workers included, checked for every post in the
   * build (drafts only exist in preview builds). Set at 45 KB for Crease No. 002, the heaviest
   * (42 KB); widened from interactive essays to every post when No. 003 brought its own demos.
   * It includes the Inspector every page can open (about 30 KB), so a post's own share is the rest.
   */
  post: 45,
} as const;
