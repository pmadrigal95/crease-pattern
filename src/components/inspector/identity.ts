/**
 * Switching identity and theme (decision 44, M2c). The choice is applied to <html> and remembered
 * in localStorage (pm.direction, pm.theme), only because the visitor made it; /privacy says so and
 * src/scripts/restore-identity.js reads it back before the next page paints.
 *
 * The identity change is the contour-lines transition of decision 42: the new paper rises like
 * terrain from the swatch the visitor picked (styles in inspector.css).
 */
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';

export type Theme = 'system' | 'light' | 'dark';

const root = document.documentElement;

export const currentDirection = () => root.getAttribute('data-direction') as VisualDirection;
export const currentTheme = (): Theme => (root.getAttribute('data-theme') as Theme | null) ?? 'system';

function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
}

/** Runs a change of colors as the contour transition, rising from `from`; instantly when it can't. */
function transition(change: () => void, from: { x: number; y: number }) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }
  root.style.setProperty('--vx', `${from.x}px`);
  root.style.setProperty('--vy', `${from.y}px`);
  root.classList.add('vt-identity');
  const rings = document.createElement('div');
  rings.className = 'topo-rings';
  rings.setAttribute('aria-hidden', 'true');
  const t = document.startViewTransition(() => {
    change();
    document.body.append(rings);
  });
  void t.finished.finally(() => {
    root.classList.remove('vt-identity');
    rings.remove();
  });
}

export function setDirection(direction: VisualDirection, from: { x: number; y: number }) {
  if (!allVisualDirections.includes(direction) || direction === currentDirection()) return;
  transition(() => {
    root.setAttribute('data-direction', direction);
    remember('pm.direction', direction);
  }, from);
}

export function setTheme(theme: Theme, from: { x: number; y: number }) {
  if (theme === currentTheme()) return;
  transition(() => {
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    remember('pm.theme', theme === 'system' ? null : theme);
  }, from);
}
