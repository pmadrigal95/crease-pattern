/**
 * First-visit help, once per visitor, shortly after their first interaction (src/scripts/masthead.ts):
 * - on the home page, with its figure in view: the walkthrough itself (walkthrough.ts), its first
 *   stop quiet (no focus taken, nothing scrolled) and easy to skip. Most visitors have never
 *   inspected a website, so the site shows them how, right where its thesis is;
 * - anywhere else, or once they've scrolled past the figure: a quiet tip (coachmark.ts) beside the
 *   Inspect button, which glows twice, offering the walkthrough. Visitors who arrived for a post or
 *   a case are never taken elsewhere unasked.
 * Either way it's remembered in localStorage (pm.tips, /privacy) the moment it shows, so it never
 * comes back; the walkthrough stays a click away in the Inspector and the command menu.
 */
import { openCoachmark } from './coachmark';
import { walkthroughStrings } from './walkthrough-strings';

export const TIP_SEEN = 'pm.tips';

/** The home page's figure, at least half of it on screen. */
const figureInView = () => {
  const box = document.querySelector('.hero [data-hero-fold] [data-stage]')?.getBoundingClientRect();
  return box !== undefined && box.top + box.height / 2 > 0 && box.top + box.height / 2 < innerHeight;
};
const busy = () =>
  document.documentElement.classList.contains('inspecting') || document.querySelector('.cm-card');

export const showFirstHelp = async (): Promise<void> => {
  const button = document.querySelector<HTMLElement>('[data-inspector-toggle]');
  if (!button || !button.getClientRects().length || busy()) return;
  try {
    localStorage.setItem(TIP_SEEN, '1');
  } catch {
    // Storage blocked: it may show again on another page, which is the lesser harm.
  }
  if (figureInView()) {
    const { startWalkthrough } = await import('./walkthrough');
    if (!busy()) startWalkthrough({ auto: true });
    return;
  }
  const t = await walkthroughStrings();
  // The visitor may have opened the Inspector or the walkthrough while the words loaded.
  if (busy()) return;
  button.classList.add('cm-pulse');
  button.addEventListener('animationend', () => button.classList.remove('cm-pulse'), { once: true });
  const mark = openCoachmark({ closeLabel: t.close, dim: false, onClose: () => mark.close() });
  mark.show(
    button,
    {
      title: t.tip.title,
      body: matchMedia('(pointer: coarse)').matches ? t.tip.touch : t.tip.keys,
      actions: [
        { label: t.tip.later, run: () => mark.close() },
        {
          label: t.tip.start,
          primary: true,
          run: () => {
            mark.close();
            void import('./walkthrough').then((m) => m.startWalkthrough());
          },
        },
      ],
    },
    true,
  );
  // Opening the Inspector answers the tip too.
  button.addEventListener('click', () => mark.close(), { once: true });
};
