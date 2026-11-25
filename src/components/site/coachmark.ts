/**
 * A coach mark: a card beside a part of the page, with an arrow pointing at it and, optionally, a
 * ring that dims the rest. Shared by the walkthrough (walkthrough.ts) and the first-visit tip
 * (first-tip.ts). One card is reused from stop to stop, so it glides instead of blinking; where it
 * goes is src/lib/coachmark-position.ts. Matte paper like the rest of the site: no blur.
 *
 * Accessibility: a non-modal dialog labelled by its title, focus on the title at each stop, Escape
 * closes, and the progress dots have a text twin for screen readers. Built with the DOM API only
 * (no HTML strings), so Trusted Types has nothing to guard.
 */
import './coachmark.css';
import { placeCoachmark } from '../../lib/coachmark-position';

export interface CoachmarkAction {
  label: string;
  primary?: boolean;
  run: () => void;
}
export interface CoachmarkContent {
  title: string;
  body: string;
  /** "Walkthrough, 3 of 7" for screen readers, with dots on screen. */
  progress?: { at: number; total: number; text: string };
  actions: CoachmarkAction[];
}
export interface Coachmark {
  /**
   * Points the card at `target`. The walkthrough scrolls to it and moves focus to the card; the
   * first-visit tip does neither (`quiet`), since the visitor didn't ask for it.
   */
  show: (target: Element, content: CoachmarkContent, quiet?: boolean) => void;
  close: () => void;
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** What the sticky masthead covers at the top of the screen. */
const mastheadBottom = () => document.querySelector('.mast')?.getBoundingClientRect().bottom ?? 0;

const build = (closeLabel: string, onClose: () => void) => {
  const card = node('div', 'cm-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'cm-title');
  card.setAttribute('aria-describedby', 'cm-body');
  const arrow = node('span', 'cm-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  const title = node('h2', 'cm-title');
  title.id = 'cm-title';
  title.tabIndex = -1;
  const body = node('p', 'cm-body');
  body.id = 'cm-body';
  const status = node('span', 'cm-status');
  const dots = node('span', 'cm-dots');
  dots.setAttribute('aria-hidden', 'true');
  const actions = node('div', 'cm-actions');
  const close = node('button', 'cm-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', closeLabel);
  close.addEventListener('click', onClose);
  const footer = node('div', 'cm-footer');
  footer.append(dots, status, actions);
  card.append(arrow, close, title, body, footer);
  return { card, arrow, title, body, status, dots, actions };
};

const fill = (parts: ReturnType<typeof build>, content: CoachmarkContent) => {
  parts.title.textContent = content.title;
  parts.body.textContent = content.body;
  parts.dots.replaceChildren();
  parts.status.textContent = content.progress?.text ?? '';
  if (content.progress) {
    for (let i = 0; i < content.progress.total; i++)
      parts.dots.append(node('span', i === content.progress.at ? 'cm-dot on' : 'cm-dot'));
  }
  parts.actions.replaceChildren(
    ...content.actions.map((action) => {
      const button = node('button', action.primary ? 'cm-primary' : 'cm-secondary', action.label);
      button.type = 'button';
      button.addEventListener('click', action.run);
      return button;
    }),
  );
};

/** Opens an empty coach mark; `show` points it at something. `dim` adds the ring. */
export const openCoachmark = (options: {
  closeLabel: string;
  dim: boolean;
  onClose: () => void;
}): Coachmark => {
  const parts = build(options.closeLabel, options.onClose);
  const ring = node('div', 'cm-ring');
  ring.setAttribute('aria-hidden', 'true');
  if (options.dim) document.body.append(ring);
  document.body.append(parts.card);
  let target: Element | null = null;
  let frame = 0;

  const place = () => {
    if (!target) return;
    const r = target.getBoundingClientRect();
    const { width, height } = parts.card.getBoundingClientRect();
    const p = placeCoachmark(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      { width, height },
      { width: innerWidth, height: innerHeight, top: mastheadBottom() },
    );
    Object.assign(parts.card.style, { left: `${p.x}px`, top: `${p.y}px` });
    parts.card.dataset.side = p.side;
    parts.arrow.style.setProperty('--at', `${p.arrow ?? 0}px`);
    Object.assign(ring.style, {
      left: `${p.ring.x}px`,
      top: `${p.ring.y}px`,
      width: `${p.ring.width}px`,
      height: `${p.ring.height}px`,
    });
  };
  const follow = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') options.onClose();
  };
  addEventListener('scroll', follow, { passive: true });
  addEventListener('resize', follow);
  addEventListener('keydown', keys);

  return {
    show: (next, content, quiet = false) => {
      const first = target === null;
      target = next;
      fill(parts, content);
      // The first stop appears in place; later ones glide there.
      parts.card.classList.toggle('cm-glide', !first && !reduced());
      if (first) parts.card.classList.add('cm-enter');
      if (!quiet) next.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
      place();
      // A smooth scroll moves the target: place again once it settles, then focus the title.
      setTimeout(
        () => {
          place();
          if (!quiet) parts.title.focus({ preventScroll: true });
        },
        reduced() ? 0 : 420,
      );
    },
    close: () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', follow);
      removeEventListener('resize', follow);
      removeEventListener('keydown', keys);
      parts.card.remove();
      ring.remove();
    },
  };
};
