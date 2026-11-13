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
import { inspector as t } from '../../content/copy/en.json';
// Imported as text, not as a stylesheet: a CSS import here would make Astro add it to every
// page's <head> as render-blocking CSS. It is adopted only when the Inspector opens.
import inspectorStyles from './inspector.css?inline';

export interface InspectorHandle {
  close(): void;
}

let styles: CSSStyleSheet | null = null;

/** Adopts the Inspector's styles once; kept after closing so the layers can settle back. */
function adoptStyles() {
  if (styles) return;
  styles = new CSSStyleSheet();
  styles.replaceSync(inspectorStyles);
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

export async function openInspector(
  trigger: HTMLElement | null,
  onClosed: () => void,
): Promise<InspectorHandle> {
  const manifest = await loadManifest();
  adoptStyles();
  const host = document.createElement('aside');
  host.id = 'inspector';
  host.setAttribute('aria-label', t.title);
  document.body.append(host);
  document.documentElement.classList.add('inspecting');

  let app: App | null = createApp(InspectorPanel, {
    manifest,
    openedAt: performance.now(),
    onClose: () => handle.close(),
  });
  app.mount(host);

  const handle: InspectorHandle = {
    close() {
      if (!app) return;
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
