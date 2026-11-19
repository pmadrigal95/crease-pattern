/**
 * Mounts the Inspector on demand. Loaded with a dynamic import the first time a visitor opens it,
 * so reading the site never downloads Vue. Returns a handle the launcher uses to close it.
 */
import { createApp, type App } from 'vue';
import InspectorPanel, { type InspectorStrings, type Manifest } from './InspectorPanel.vue';
// The manifest is a file of its own (Vite emits it hashed under /_astro/), fetched when the panel
// loads, not bundled into it: it grows with every inspectable part, and the panel's code
// shouldn't. Its size has its own budget (src/config/quality.ts, inspectorData).
import { heroScene } from '../../scripts/hero3d';
import manifestUrl from '../../generated/inspector.json?url';
// The panel's styles are a file of their own (Vite emits it hashed under /_astro/), fetched when
// the Inspector loads and adopted as a constructed stylesheet: a CSS import here would make Astro
// add it to every page's <head> as render-blocking CSS, and inlining it in this module would make
// every visual change to the panel weigh on the on-demand JavaScript. Its size has its own budget
// (src/config/quality.ts, inspectorStyles).
import inspectorStylesUrl from './inspector.css?url';

export interface InspectorHandle {
  close(): void;
}

let styles: CSSStyleSheet | null = null;

let stylesRequest: Promise<string> | null = null;

/** Starts (or reuses) the styles' download; a failed one is forgotten, so the next open retries. */
const loadStyles = (): Promise<string> => {
  stylesRequest ??= fetch(inspectorStylesUrl)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`inspector styles: ${r.status}`))))
    .catch((error: unknown) => {
      stylesRequest = null;
      throw error;
    });
  return stylesRequest;
};

/** Adopts the Inspector's styles once; kept after closing so the layers can settle back. */
const adoptStyles = (css: string) => {
  if (styles) return;
  styles = new CSSStyleSheet();
  styles.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, styles];
};

let manifestRequest: Promise<Manifest> | null = null;

/** Starts (or reuses) the manifest download; a failed one is forgotten, so the next open retries. */
const loadManifest = (): Promise<Manifest> => {
  manifestRequest ??= fetch(manifestUrl)
    .then((r) =>
      r.ok ? (r.json() as Promise<Manifest>) : Promise.reject(new Error(`manifest: ${r.status}`)),
    )
    .catch((error: unknown) => {
      manifestRequest = null;
      throw error;
    });
  return manifestRequest;
};
// This module loads when a visitor first reaches for the Inspector (hovering its button counts), so
// start the manifest now, alongside Vue, instead of after it.
void loadManifest().catch(() => undefined);
void loadStyles().catch(() => undefined);

// The hero's 3D figure is shared with the hero itself (src/scripts/hero3d.ts): if it isn't up yet,
// opening the Inspector brings it up, alongside Vue, like the manifest.
void heroScene();

export const openInspector = async (
  trigger: HTMLElement | null,
  onClosed: () => void,
): Promise<InspectorHandle> => {
  const [manifest, css] = await Promise.all([loadManifest(), loadStyles()]);
  adoptStyles(css);
  // A box-less wrapper: the panel (aside#inspector) and the part's outline render side by side in
  // it, so the outline never sits inside the panel's stacking context and paints over it.
  const host = document.createElement('div');
  host.className = 'inspector-root';
  document.body.append(host);
  document.documentElement.classList.add('inspecting');

  const strings = document.querySelector<HTMLElement>('[data-inspector-toggle]')?.dataset.strings;
  if (!strings) throw new Error('Inspector strings are missing from the Inspect button');
  let app: App | null = createApp(InspectorPanel, {
    manifest,
    strings: JSON.parse(strings) as InspectorStrings,
    openedAt: performance.now(),
    onClose: () => handle.close(),
  });
  app.mount(host);

  // The 3D figure comes apart while inspecting; the Inspector never waits for it.
  let closed = false;
  void heroScene().then((scene) => {
    if (!closed) scene?.setInspecting(true);
  });

  const handle: InspectorHandle = {
    close() {
      if (!app) return;
      closed = true;
      void heroScene().then((scene) => scene?.setInspecting(false));
      app.unmount();
      app = null;
      host.remove();
      document.documentElement.classList.remove('inspecting');
      trigger?.focus();
      onClosed();
    },
  };
  return handle;
};
