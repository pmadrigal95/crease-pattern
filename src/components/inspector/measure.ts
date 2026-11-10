/**
 * What the Inspector measures in the visitor's own browser: Web Vitals of this visit, the text
 * contrast inside a part, and the page's accessibility outline. Pure DOM and Performance APIs.
 */

export interface Vitals {
  lcp: number | null;
  cls: number;
  inp: number | null;
}

/** Google's "good" thresholds for Core Web Vitals. */
export const GOOD = { lcp: 2500, cls: 0.1, inp: 200 } as const;

/**
 * Starts observing Web Vitals. Buffered entries cover everything since the page loaded, so
 * opening the Inspector late still reports the real LCP and CLS.
 */
export function observeVitals(onChange: (v: Vitals) => void): () => void {
  const vitals: Vitals = { lcp: null, cls: 0, inp: null };
  const observers: PerformanceObserver[] = [];
  const watch = (type: string, handle: (entries: PerformanceEntryList) => void, extra = {}) => {
    if (!PerformanceObserver.supportedEntryTypes?.includes(type)) return;
    const o = new PerformanceObserver((list) => {
      handle(list.getEntries());
      onChange({ ...vitals });
    });
    o.observe({ type, buffered: true, ...extra });
    observers.push(o);
  };

  watch('largest-contentful-paint', (entries) => {
    const last = entries.at(-1);
    if (last) vitals.lcp = last.startTime;
  });
  watch('layout-shift', (entries) => {
    for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!e.hadRecentInput) vitals.cls += e.value;
    }
  });
  watch(
    'event',
    (entries) => {
      for (const e of entries) vitals.inp = Math.max(vitals.inp ?? 0, e.duration);
    },
    { durationThreshold: 16 },
  );

  onChange({ ...vitals });
  return () => observers.forEach((o) => o.disconnect());
}

/** Bytes of JavaScript the page loaded before the Inspector itself. */
export function scriptBytes(before: number): number {
  return performance
    .getEntriesByType('resource')
    .filter((r) => (r as PerformanceResourceTiming).initiatorType === 'script' && r.startTime < before)
    .reduce((sum, r) => sum + ((r as PerformanceResourceTiming).transferSize || 0), 0);
}

const channel = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
const luminance = ([r = 0, g = 0, b = 0]: number[]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** The first opaque background behind an element, walking up the tree. */
function backgroundOf(el: Element | null): number[] {
  for (let node = el; node; node = node.parentElement) {
    const [r, g, b, a = 1] = rgb(getComputedStyle(node).backgroundColor);
    if (a > 0.9 && r !== undefined) return [r, g ?? 0, b ?? 0];
  }
  return [255, 255, 255];
}

/** WCAG contrast of the lowest-contrast visible text inside a part, or null if it has none. */
export function lowestTextContrast(part: Element): { ratio: number; large: boolean } | null {
  let worst: { ratio: number; large: boolean } | null = null;
  const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const el = text.parentElement;
    if (!el || !text.textContent?.trim() || el.closest('.sr-only, [aria-hidden="true"]')) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const [fg, bg] = [luminance(rgb(style.color)), luminance(backgroundOf(el))];
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    const size = parseFloat(style.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    if (!worst || ratio < worst.ratio) worst = { ratio, large };
  }
  return worst;
}

export interface OutlineItem {
  label: string;
  level?: number;
}

/** Landmarks and headings, as a screen reader would list them. */
export function accessibilityOutline(): { landmarks: OutlineItem[]; headings: OutlineItem[] } {
  const roles: Record<string, string> = {
    HEADER: 'banner',
    NAV: 'navigation',
    MAIN: 'main',
    ASIDE: 'complementary',
    FOOTER: 'contentinfo',
  };
  const landmarks = [
    ...document.querySelectorAll('header.mast, nav, main, aside, footer, section[aria-labelledby]'),
  ]
    .filter((el) => !el.closest('#inspector'))
    .map((el) => {
      const named =
        el.getAttribute('aria-label') ??
        document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim();
      return { label: `${roles[el.tagName] ?? 'region'}${named ? ` · ${named}` : ''}` };
    });
  const headings = [...document.querySelectorAll('h1, h2, h3')]
    .filter((el) => !el.closest('#inspector'))
    .map((el) => ({
      label: el.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      level: Number(el.tagName[1]),
    }));
  return { landmarks, headings };
}
