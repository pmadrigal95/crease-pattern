/**
 * Mounts the Inspector on demand. Loaded with a dynamic import the first time a visitor opens it,
 * so reading the site never downloads Vue. Returns a handle the launcher uses to close it.
 */
import { createApp, type App } from 'vue';
import InspectorPanel, { type Manifest } from './InspectorPanel.vue';
import manifest from '../../generated/inspector.json';
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

export function openInspector(trigger: HTMLElement | null, onClosed: () => void): InspectorHandle {
  adoptStyles();
  const host = document.createElement('aside');
  host.id = 'inspector';
  host.setAttribute('aria-label', t.title);
  document.body.append(host);
  document.documentElement.classList.add('inspecting');

  let app: App | null = createApp(InspectorPanel, {
    manifest: manifest as Manifest,
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
