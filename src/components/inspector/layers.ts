/**
 * The 3D layer view (decision 44, M2b), as a pop-up book (portfolio-discovery/30-inspector-3d-plan.md):
 * while inspecting, the page tilts, then every inspectable part inside <main> rises to its own
 * depth (one level per nesting of parts), one after another in reading order. Each part leaves its
 * footprint on the level below, the dashed outline it was cut from, as a kirigami cut-out does,
 * and the model turns a few degrees with the pointer. It stays real HTML moved by CSS 3D
 * (inspector.css), so text stays sharp, selectable and accessible.
 *
 * Flat on phones and under reduced motion: there, M2a's outline is the whole view.
 */

const CURRENT = 'is-inspected';
/** How long the parts take to settle back after closing (inspector.css): the footprints go then. */
const SETTLE_MS = 1400;

/** Whether this visit gets the 3D view at all. */
export const layersEnabled = () =>
  matchMedia('(min-width: 721px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Each part's footprint, and what was added to make room for it, so closing takes it all back. */
const leaveFootprints = (lifted: HTMLElement[]) => {
  const prints: HTMLElement[] = [];
  const anchored: HTMLElement[] = [];
  lifted.forEach((el, order) => {
    el.style.setProperty('--pop-order', String(order));
    // The footprint is drawn inside the part; a static part becomes its containing block.
    if (getComputedStyle(el).position === 'static') {
      el.classList.add('layer-anchor');
      anchored.push(el);
    }
    const print = document.createElement('span');
    print.className = 'layer-print';
    print.setAttribute('aria-hidden', 'true');
    el.append(print);
    prints.push(print);
  });
  return () => {
    prints.forEach((p) => p.remove());
    anchored.forEach((el) => el.classList.remove('layer-anchor'));
  };
};
/** The footprints of the last close, waiting for the parts to settle; reopening clears them first. */
let settling: { timer: ReturnType<typeof setTimeout>; clear: () => void } | null = null;
const clearSettling = () => {
  if (!settling) return;
  clearTimeout(settling.timer);
  settling.clear();
  settling = null;
};

/**
 * The model turns a little with the pointer (--turn-x and --turn-y, from -1 to 1; at most 2° and
 * 1.5°, inspector.css), and always slowly: the turn chases the pointer, covering a small share of
 * the way each frame, so a quick swing of the mouse becomes a slow, small sway and never a jolt.
 */
const followPointer = (main: HTMLElement) => {
  const target = { x: 0, y: 0 };
  const turn = { x: 0, y: 0 };
  let frame = 0;
  const step = () => {
    turn.x += (target.x - turn.x) * 0.06;
    turn.y += (target.y - turn.y) * 0.06;
    main.style.setProperty('--turn-x', turn.x.toFixed(3));
    main.style.setProperty('--turn-y', turn.y.toFixed(3));
    frame =
      Math.abs(target.x - turn.x) + Math.abs(target.y - turn.y) > 0.002 ? requestAnimationFrame(step) : 0;
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    target.x = (e.clientX / innerWidth) * 2 - 1;
    target.y = (e.clientY / innerHeight) * 2 - 1;
    frame ||= requestAnimationFrame(step);
  };
  addEventListener('pointermove', move, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('pointermove', move);
    main.style.removeProperty('--turn-x');
    main.style.removeProperty('--turn-y');
  };
};

/**
 * Tilts the page and lifts its parts. Returns the function that puts everything back; the CSS
 * transitions run both ways, so closing settles the layers instead of snapping them.
 */
export const explode = (parts: HTMLElement[]): (() => void) => {
  const main = document.querySelector<HTMLElement>('main');
  if (!main) return () => {};
  const root = document.documentElement;
  const paths = new Set<HTMLElement>();
  const lifted = parts.filter((el) => main.contains(el));
  clearSettling();

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
  // Reading order: the order the parts rise in.
  lifted.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const clearFootprints = leaveFootprints(lifted);
  const stopFollowing = followPointer(main);

  // Tilt around the middle of the viewport, so what the visitor was reading stays in front. The
  // pivot moves only once the scroll stops, and glides there (inspector.css): following every
  // frame of a fast scroll would swing the whole page under the reader's eyes.
  const mainTop = main.getBoundingClientRect().top + scrollY;
  const center = () => main.style.setProperty('--tilt-origin', `${scrollY + innerHeight / 2 - mainTop}px`);
  let still: ReturnType<typeof setTimeout> | undefined;
  const pivot = () => {
    clearTimeout(still);
    still = setTimeout(center, 160);
  };
  center();
  addEventListener('scroll', pivot, { passive: true });
  root.classList.add('inspector-3d');
  // Once the page has tilted, only the pointer moves it, at its own slow pace (followPointer).
  const settled = setTimeout(() => root.classList.add('layers-settled'), 760);

  return () => {
    clearTimeout(still);
    clearTimeout(settled);
    root.classList.remove('layers-settled');
    removeEventListener('scroll', pivot);
    stopFollowing();
    clearSettling();
    settling = { timer: setTimeout(clearSettling, SETTLE_MS), clear: clearFootprints };
    root.classList.remove('inspector-3d');
    paths.forEach((node) => node.classList.remove('layer-path'));
    lifted.forEach((el) => el.classList.remove(CURRENT));
    // Leave --layer-depth, --pop-order and --tilt-origin in place: the closing transition reads them.
  };
};

/** Raises the hovered or pinned part above the others, so the panel and the model agree. */
export const markCurrent = (parts: HTMLElement[], current: HTMLElement | null) => {
  for (const el of parts) el.classList.toggle(CURRENT, el === current);
};
