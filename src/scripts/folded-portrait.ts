/**
 * The folded portrait's behaviour (src/components/site/FoldedPortrait.astro, doc 35): the tab, the
 * fold that follows the story on wide screens, and the hint that shows the second layer once the
 * portrait is in view.
 *
 * - Reading (wide screens with scroll timelines): the fold waits at 85; once in view a hint sweeps
 *   it toward the contours and back, then the story's scroll timeline (CSS) takes it over, and the
 *   slider and caption follow. Scrolling cuts the hint short.
 * - Elsewhere: the original opening, top to bottom, once the portrait is in view.
 * - The tab (pointer or arrow keys) takes the fold for the rest of the visit, from either.
 * - Reduced motion: no hint, no opening, no reading; the fold rests through the nose and follows
 *   the tab.
 */
const MIN = 15;
const MAX = 85;
const REST = 39;
/** The opening starts with the contours out of sight. */
const CLOSED = 125;

type Portrait = {
  el: HTMLElement;
  handle: HTMLElement;
  /** Shows `fold` on the slider and the caption. */
  show: (fold: number) => void;
  /** The tab sets the fold: the visitor's from now on. */
  set: (value: number) => void;
  taken: () => boolean;
};

/** Runs `play` once the portrait is in view (data-arrive, BaseLayout). */
const onArrival = (el: HTMLElement, play: () => void) => {
  if (el.classList.contains('arrived')) return play();
  const watch = new MutationObserver(() => {
    if (!el.classList.contains('arrived')) return;
    watch.disconnect();
    play();
  });
  watch.observe(el, { attributes: true, attributeFilter: ['class'] });
};

const portrait = (el: HTMLElement, handle: HTMLElement): Portrait => {
  const template = el.dataset.valueTemplate ?? '';
  const caption = el.parentElement?.querySelector<HTMLElement>('[data-fold-value]');
  let taken = false;
  const show = (fold: number) => {
    const text = template.replace('{photo}', String(fold)).replace('{contours}', String(100 - fold));
    handle.setAttribute('aria-valuenow', String(fold));
    handle.setAttribute('aria-valuetext', text);
    if (caption) caption.textContent = text;
  };
  const set = (value: number) => {
    const fold = Math.round(Math.min(MAX, Math.max(MIN, value)));
    taken = true;
    el.classList.remove('is-opening', 'is-hinting', 'is-reading');
    el.style.setProperty('--fold', String(fold));
    show(fold);
  };
  return { el, handle, show, set, taken: () => taken };
};

/** The story drives the fold, after the hint. */
const startReading = ({ el, show, taken }: Portrait) => {
  const follow = () => {
    if (!el.classList.contains('is-reading')) return;
    show(Math.round(Number(getComputedStyle(el).getPropertyValue('--fold')) || REST));
  };
  let queued = false;
  addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        follow();
      });
    },
    { passive: true },
  );
  const read = () => {
    if (taken() || el.classList.contains('is-reading')) return;
    el.classList.remove('is-hinting');
    el.style.removeProperty('--fold');
    el.classList.add('is-reading');
    requestAnimationFrame(follow);
  };
  el.style.setProperty('--fold', String(MAX));
  show(MAX);
  onArrival(el, () => {
    if (taken()) return;
    el.classList.add('is-hinting');
    el.addEventListener('animationend', read, { once: true });
    addEventListener('scroll', read, { once: true, passive: true });
  });
};

/** The original opening, once in view: on phones the portrait sits after the story. */
const startOpening = ({ el, set, taken }: Portrait) => {
  el.style.setProperty('--fold', String(CLOSED));
  onArrival(el, () => {
    if (taken()) return;
    el.classList.add('is-opening');
    el.addEventListener('animationend', () => set(REST), { once: true });
  });
};

/** The tab: dragged along the fold's diagonal, or moved with the keys. */
const wireTab = ({ el, handle, set }: Portrait) => {
  const current = () => Number(handle.getAttribute('aria-valuenow')) || REST;
  let dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointerup', () => (dragging = false));
  handle.addEventListener('pointercancel', () => (dragging = false));
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100 - 50;
    const y = ((e.clientY - r.top) / r.height) * 100 - 50;
    set(50 + (x + y) / 2 / 0.71);
  });
  handle.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = {
      ArrowRight: 4,
      ArrowDown: 4,
      ArrowLeft: -4,
      ArrowUp: -4,
      PageDown: 12,
      PageUp: -12,
    };
    const edges: Record<string, number> = { Home: MIN, End: MAX };
    const step = steps[e.key];
    const edge = edges[e.key];
    if (step === undefined && edge === undefined) return;
    e.preventDefault();
    set(edge ?? current() + (step ?? 0));
  });
};

export const initFoldedPortraits = (): void => {
  for (const el of document.querySelectorAll<HTMLElement>('[data-folded-portrait]')) {
    const handle = el.querySelector<HTMLElement>('.handle');
    if (!handle) continue;
    const p = portrait(el, handle);
    el.classList.add('is-interactive');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reading =
      !still &&
      CSS.supports('animation-timeline: view()') &&
      matchMedia('(min-width: 881px)').matches &&
      Boolean(el.closest('[data-story]'));
    if (reading) startReading(p);
    else if (!still) startOpening(p);
    wireTab(p);
  }
};
