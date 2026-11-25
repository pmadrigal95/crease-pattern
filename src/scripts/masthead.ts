// The masthead's behavior, on every page (src/components/site/Masthead.astro imports it, so it ships
// as that page script, with no request of its own).
// The language switch, here and in the footer, and the suggestion to read in the other
// language (M5). Imported only here, so it joins this script instead of adding a request.
import { initLanguage } from './lang';
initLanguage();
// The next page loads when a link shows intent (src/scripts/prefetch.ts), in this same script.
import { initPrefetch } from './prefetch';
initPrefetch();
// A walkthrough under way continues on this page (src/components/site/walkthrough.ts). Otherwise,
// on a first visit, help shows on its own: the walkthrough on the home page, a tip beside Inspect
// elsewhere (src/components/site/first-tip.ts). It comes with the visitor's first interaction (a
// real pointer move counts) or a few seconds after the page has loaded, whichever is first: never
// during the load itself, and never again once it has shown.
try {
  if (sessionStorage.getItem('pm.walkthrough') !== null)
    void import('../components/site/walkthrough').then((m) => m.resumeWalkthrough());
  else if (localStorage.getItem('pm.tips') === null) {
    const firsts = ['scroll', 'pointerdown', 'keydown', 'pointermove'] as const;
    let armed = false;
    const arm = (e?: Event) => {
      // A pointermove with no movement is the page changing under a resting pointer (hero3d.ts).
      if (e instanceof PointerEvent && e.type === 'pointermove' && !e.movementX && !e.movementY) return;
      if (armed) return;
      armed = true;
      for (const type of firsts) removeEventListener(type, arm);
      setTimeout(() => void import('../components/site/first-tip').then((m) => m.showFirstHelp()), 1200);
    };
    for (const type of firsts) addEventListener(type, arm, { passive: true });
    const later = () => setTimeout(arm, 3500);
    if (document.readyState === 'complete') later();
    else addEventListener('load', later, { once: true });
  }
} catch {
  // Storage blocked: nothing to resume, and no tip.
}
// Opens the Inspector (decision 44): the button, any [data-inspector-open], Shift+I or ?inspect. Vue and the
// panel download only now, on first use; hovering the button starts that download early.
type Handle = { close(): void };
// Same rule as isTypingTarget in src/lib/keyboard.ts, kept local: this script runs on every page,
// and importing a helper shared with Precrease search would add a chained request to each one.
const isTypingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
const button = document.querySelector<HTMLButtonElement>('[data-inspector-toggle]');
let handle: Handle | null = null;
let loading = false;
const load = () => import('../components/inspector/mount');

const open = async (trigger: HTMLElement | null) => {
  if (handle || loading) return;
  loading = true;
  try {
    const { openInspector } = await load();
    handle = await openInspector(trigger, () => {
      handle = null;
      button?.setAttribute('aria-expanded', 'false');
    });
    button?.setAttribute('aria-expanded', 'true');
  } catch (error) {
    // Offline, or the manifest didn't arrive: the page stays as it was, and the next try retries.
    console.warn('Inspector could not open', error);
  } finally {
    loading = false;
  }
};
const toggle = (trigger: HTMLElement | null) => (handle ? handle.close() : open(trigger));

button?.addEventListener('click', () => toggle(button));
// Other openers on the page (the home hero's "See how this page is built") share the same panel.
for (const opener of document.querySelectorAll<HTMLElement>('[data-inspector-open]')) {
  opener.addEventListener('click', () => toggle(opener));
  opener.addEventListener('pointerenter', () => void load(), { once: true });
}
button?.addEventListener('pointerenter', () => void load(), { once: true });
// A pointer resting on the hero's figure preloads too: loading the Inspector also starts the 3D
// scene on devices that can run it (decision 50), so it's ready if the visitor opens it.
document
  .querySelector('[data-hero-fold] [data-stage]')
  ?.addEventListener('pointerenter', () => void load(), { once: true });
// The command menu (M4.7): one menu for every page, loaded on first use; hovering its button
// starts the download early. Ctrl+K everywhere, Cmd+K on Apple devices.
const commandButton = document.querySelector<HTMLButtonElement>('[data-command-open]');
const commandMenu = () => import('../components/site/command-menu');
const openCommands = () => {
  const strings = commandButton?.dataset.strings;
  if (!strings) return;
  void commandMenu()
    .then((m) => m.openCommandMenu(JSON.parse(strings) as Parameters<typeof m.openCommandMenu>[0]))
    .catch((error: unknown) => console.warn('Commands could not open', error));
};
commandButton?.addEventListener('click', () => openCommands());
commandButton?.addEventListener('pointerenter', () => void commandMenu(), { once: true });
// The tooltip names the shortcut the visitor's keyboard has.
if (commandButton && /Mac|iPhone|iPad/.test(navigator.platform))
  commandButton.title = commandButton.title.replace('Ctrl K', '⌘ K');
addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'k' || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
  e.preventDefault();
  openCommands();
});
addEventListener('keydown', (e) => {
  if (
    !e.shiftKey ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    e.key.toLowerCase() !== 'i' ||
    isTypingTarget(e.target)
  )
    return;
  e.preventDefault();
  // Focus goes back where it was on close; with nothing focused, to the Inspect button.
  const active = document.activeElement;
  toggle(active instanceof HTMLElement && active !== document.body ? active : button);
});
if (new URLSearchParams(location.search).has('inspect')) void open(button);
// The bar's material answers the scroll (src/styles/masthead.css): data-scrolled once the page has
// moved, and --lift over the first 120 px, which Basalt & glacier's shadow grows with. One update per
// frame at most.
const mast = document.querySelector<HTMLElement>('.mast');
if (mast) {
  let frame = 0;
  const update = () => {
    frame = 0;
    mast.toggleAttribute('data-scrolled', scrollY > 8);
    mast.style.setProperty('--lift', Math.min(1, scrollY / 120).toFixed(2));
  };
  addEventListener('scroll', () => (frame ||= requestAnimationFrame(update)), { passive: true });
  update();
}
