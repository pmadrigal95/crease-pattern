/**
 * Mounts the Inspector on demand. Loaded with a dynamic import the first time a visitor opens it,
 * so reading the site never downloads Vue. Returns a handle the launcher uses to close it.
 */
import { createApp, type App } from 'vue';
import InspectorPanel, { type Manifest } from './InspectorPanel.vue';
// The manifest is a file of its own (Vite emits it hashed under /_astro/), fetched when the panel
// loads, not bundled into it: it grows with every inspectable part, and the panel's code
// shouldn't. Its size has its own budget (src/config/quality.ts, inspectorData).
import manifestUrl from '../../generated/inspector.json?url';
// The panel's styles are a file of their own (Vite emits it hashed under /_astro/), fetched when
// the Inspector loads and adopted as a constructed stylesheet: a CSS import here would make Astro
// add it to every page's <head> as render-blocking CSS, and inlining it in this module would make
// every visual change to the panel weigh on the on-demand JavaScript. Its size has its own budget
// (src/config/quality.ts, inspectorStyles).
import inspectorStylesUrl from './inspector.css?url';
import { canRun3D, detectDevice } from '../../lib/scene3d-support';
import type { FoxScene } from './scene3d';

export interface InspectorHandle {
  close(): void;
}

let styles: CSSStyleSheet | null = null;

let stylesRequest: Promise<string> | null = null;

/** Starts (or reuses) the styles' download; a failed one is forgotten, so the next open retries. */
function loadStyles(): Promise<string> {
  stylesRequest ??= fetch(inspectorStylesUrl)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`inspector styles: ${r.status}`))))
    .catch((error: unknown) => {
      stylesRequest = null;
      throw error;
    });
  return stylesRequest;
}

/** Adopts the Inspector's styles once; kept after closing so the layers can settle back. */
function adoptStyles(css: string) {
  if (styles) return;
  styles = new CSSStyleSheet();
  styles.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
}

let manifestRequest: Promise<Manifest> | null = null;

/** Starts (or reuses) the manifest download; a failed one is forgotten, so the next open retries. */
function loadManifest(): Promise<Manifest> {
  manifestRequest ??= fetch(manifestUrl)
    .then((r) =>
      r.ok ? (r.json() as Promise<Manifest>) : Promise.reject(new Error(`manifest: ${r.status}`)),
    )
    .catch((error: unknown) => {
      manifestRequest = null;
      throw error;
    });
  return manifestRequest;
}
// This module loads when a visitor first reaches for the Inspector (hovering its button counts), so
// start the manifest now, alongside Vue, instead of after it.
void loadManifest().catch(() => undefined);
void loadStyles().catch(() => undefined);

// M4's 3D fox: only on a page with the hero fox, and only on a device that can run it
// (decision 50). Its module is a chunk of its own with its own budget (scene3d), so the panel's
// code never carries three.js. It starts loading alongside Vue, like the manifest.
const heroStage = () => document.querySelector<HTMLElement>('[data-hero-fold] [data-stage]');
let scene3d: Promise<typeof import('./scene3d')> | null = null;
function loadScene3d() {
  if (!heroStage() || !canRun3D(detectDevice())) return null;
  scene3d ??= import('./scene3d').catch((error: unknown) => {
    scene3d = null;
    throw error;
  });
  return scene3d;
}
void loadScene3d()?.catch(() => undefined);

export async function openInspector(
  trigger: HTMLElement | null,
  onClosed: () => void,
): Promise<InspectorHandle> {
  const [manifest, css] = await Promise.all([loadManifest(), loadStyles()]);
  adoptStyles(css);
  // A box-less wrapper: the panel (aside#inspector) and the part's outline render side by side in
  // it, so the outline never sits inside the panel's stacking context and paints over it.
  const host = document.createElement('div');
  host.className = 'inspector-root';
  document.body.append(host);
  document.documentElement.classList.add('inspecting');

  let app: App | null = createApp(InspectorPanel, {
    manifest,
    openedAt: performance.now(),
    onClose: () => handle.close(),
  });
  app.mount(host);

  // The 3D fox takes the hero's square when it's ready; the Inspector never waits for it.
  let scene: FoxScene | null = null;
  let closed = false;
  const stage = heroStage();
  void loadScene3d()
    ?.then((m) => {
      if (closed || !stage) return;
      scene = m.mountFoxScene(stage);
      scene.setInspecting(true);
    })
    // Without the scene (offline, or no WebGL context after all), the SVG fox stays: a complete picture.
    .catch((error: unknown) => console.warn('3D scene unavailable; the SVG fox stays', error));

  const handle: InspectorHandle = {
    close() {
      if (!app) return;
      closed = true;
      scene?.dispose();
      scene = null;
      app.unmount();
      app = null;
      host.remove();
      document.documentElement.classList.remove('inspecting');
      trigger?.focus();
      onClosed();
    },
  };
  return handle;
}
