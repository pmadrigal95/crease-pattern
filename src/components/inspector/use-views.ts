/**
 * The Inspector's views and the tour (InspectorPanel.vue): the layers, the page folded like a
 * Miura-ori, its crease pattern. The folded views' code (fold.ts) loads the first time a visitor
 * picks one, so the panel never carries it (its budget is inspectorViews, src/config/quality.ts).
 */
import { ref } from 'vue';
import { heroScene } from '../../scripts/hero3d';
import type { FoldHooks, Folded } from './fold';
import type { InspectorStrings } from './InspectorPanel.vue';

export type View = 'layers' | 'fold' | 'pattern';
export const views: View[] = ['layers', 'fold', 'pattern'];

/** How long the tour rests on each section, in ms. */
const STOP_MS = 3200;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The hero's figure comes apart in the layer view; folded, it stays whole until the tour reaches it. */
const figureApart = (on: boolean) => void heroScene().then((scene) => scene?.setInspecting(on));

export const useViews = (deps: {
  /** Turns the layer view on or off (layers.ts). */
  layers: { on: () => void; off: () => void };
  hooks: Omit<FoldHooks, 'strings'>;
  t: InspectorStrings;
  pin: (el: HTMLElement) => void;
  /** The downloaded pattern's title. */
  title: () => string;
}) => {
  const view = ref<View>('layers');
  const touring = ref(false);
  let folded: Folded | null = null;

  const chooseView = async (next: View) => {
    touring.value = false;
    view.value = next;
    if (next === 'layers') {
      await folded?.close();
      folded = null;
      if (view.value === 'layers') deps.layers.on();
      figureApart(true);
      return;
    }
    if (!folded) {
      deps.layers.off();
      figureApart(false);
      const { foldPage } = await import('./fold');
      const keep = [document.querySelector('.inspector-root')].filter((n): n is Element => n !== null);
      const { t } = deps;
      folded = foldPage(keep, {
        ...deps.hooks,
        strings: {
          openCrease: t.openCrease,
          closeCrease: t.closeCrease,
          lines: t.linesUnit,
          tokens: t.tokensUnit,
          mountain: t.mountainFold,
          valley: t.valleyFold,
        },
      });
    }
    folded.show(next);
  };

  /** The tour belongs to the folded views: the camera brings each section of the sheet forward. */
  const tour = async () => {
    if (touring.value) {
      touring.value = false;
      return;
    }
    if (!folded) return;
    touring.value = true;
    for (const el of folded.sections) {
      if (!touring.value) break;
      deps.pin(el);
      // The camera reaches the hero: now its figure comes apart, the one thing moving on screen.
      figureApart(Boolean(el.querySelector('[data-hero-fold]')));
      await wait(STOP_MS);
    }
    folded?.focus(null);
    figureApart(false);
    touring.value = false;
  };

  /** The crease pattern on screen, as an SVG file the visitor can print and fold. */
  const downloadPattern = () => {
    if (!folded) return;
    const page = location.pathname.replace(/^\/|\/$/g, '').replaceAll('/', '-') || 'home';
    const url = URL.createObjectURL(new Blob([folded.patternSvg(deps.title())], { type: 'image/svg+xml' }));
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `crease-pattern-${page}.svg`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Folded, a picked part's section comes to the front; false when the page isn't folded. */
  const bringForward = (el: HTMLElement) => {
    if (!folded) return false;
    const at = folded.sections.findIndex((s) => s.contains(el));
    folded.focus(at < 0 ? null : at);
    return true;
  };

  const close = () => {
    touring.value = false;
    void folded?.close();
  };

  return { view, touring, chooseView, tour, downloadPattern, bringForward, close };
};
