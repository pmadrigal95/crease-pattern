/**
 * Mounts the Inspector on demand. Loaded with a dynamic import the first time a visitor opens it,
 * so reading the site never downloads Vue. Returns a handle the launcher uses to close it.
 */
import { createApp, type App } from 'vue';
import InspectorPanel, { type Manifest } from './InspectorPanel.vue';
import manifest from '../../generated/inspector.json';
import { inspector as t } from '../../content/copy/en.json';
import './inspector.css';

export interface InspectorHandle {
  close(): void;
}

export function openInspector(trigger: HTMLElement | null, onClosed: () => void): InspectorHandle {
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
