/**
 * The first-visit tip: once per visitor, shortly after their first interaction, a quiet coach mark
 * (coachmark.ts) points at the Inspect button, which glows twice, and offers the walkthrough. It
 * takes no focus, moves nothing and dims nothing; it closes with its ×, Escape, "Not now" or by
 * starting the walkthrough. Remembered in localStorage (pm.tips, /privacy) the moment it shows,
 * so it never comes back. Started from the masthead's script (src/scripts/masthead.ts).
 */
import { openCoachmark } from './coachmark';
import { walkthroughStrings } from './walkthrough-strings';

export const TIP_SEEN = 'pm.tips';

export const showFirstTip = async (): Promise<void> => {
  const button = document.querySelector<HTMLElement>('[data-inspector-toggle]');
  if (!button || !button.getClientRects().length) return;
  try {
    localStorage.setItem(TIP_SEEN, '1');
  } catch {
    // Storage blocked: it may show again on another page, which is the lesser harm.
  }
  const t = await walkthroughStrings();
  // The visitor may have opened the Inspector or the walkthrough while the words loaded.
  if (document.documentElement.classList.contains('inspecting') || document.querySelector('.cm-card')) return;
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
