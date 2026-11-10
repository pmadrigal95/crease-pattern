/**
 * The 3D layer view (decision 44, M2b): while inspecting, the page tilts and every inspectable
 * part inside <main> rises to its own depth, one level per nesting of parts. It stays real HTML
 * moved by CSS 3D (inspector.css), so text stays sharp, selectable and accessible.
 *
 * Flat on phones and under reduced motion: there, M2a's outline is the whole view.
 */

const CURRENT = 'is-inspected';

/** Whether this visit gets the 3D view at all. */
export const layersEnabled = () =>
  matchMedia('(min-width: 721px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tilts the page and lifts its parts. Returns the function that puts everything back; the CSS
 * transitions run both ways, so closing settles the layers instead of snapping them.
 */
export function explode(parts: HTMLElement[]): () => void {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return () => {};
  const root = document.documentElement;
  const paths = new Set<HTMLElement>();
  const lifted = parts.filter((el) => main.contains(el));

  for (const el of lifted) {
    let depth = 1;
    for (let node = el.parentElement; node && node !== main; node = node.parentElement) {
      if (node.hasAttribute('data-inspect')) depth += 1;
      paths.add(node);
    }
    el.style.setProperty('--layer-depth', String(depth));
  }
  // Every ancestor between <main> and a part keeps the 3D space, or the part would flatten.
  paths.forEach((node) => node.classList.add('layer-path'));

  // Tilt around the middle of the viewport, so what the visitor was reading stays in front.
  const mainTop = main.getBoundingClientRect().top + scrollY;
  let frame = 0;
  const pivot = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      main.style.setProperty('--tilt-origin', `${scrollY + innerHeight / 2 - mainTop}px`),
    );
  };
  pivot();
  addEventListener('scroll', pivot, { passive: true });
  root.classList.add('inspector-3d');

  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('scroll', pivot);
    root.classList.remove('inspector-3d');
    paths.forEach((node) => node.classList.remove('layer-path'));
    lifted.forEach((el) => el.classList.remove(CURRENT));
    // Leave --layer-depth and --tilt-origin in place: the closing transition still reads them.
  };
}

/** Raises the hovered or pinned part above the others, so the panel and the model agree. */
export function markCurrent(parts: HTMLElement[], current: HTMLElement | null) {
  for (const el of parts) el.classList.toggle(CURRENT, el === current);
}
