/**
 * The next page, ready before the click, in browsers without speculation rules: when the pointer
 * rests on an internal link, it gets focus or a finger touches it, that page downloads with
 * <link rel="prefetch">. Chromium does better on its own, prerendering from the rules every page
 * carries (src/scripts/speculation-rules.ts), so this stays out of its way.
 *
 * Only on that sign of intent, never every link on screen; never with data saver on or on a 2G
 * connection. Imported by the masthead's script, so it adds no request of its own (an extra module
 * in every page's critical chain cost About a round trip of LCP).
 */
const HOVER_MS = 80;
const warmed = new Set<string>();

type Connection = { saveData?: boolean; effectiveType?: string };

function warm(href: string) {
  if (warmed.has(href)) return;
  warmed.add(href);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = href;
  document.head.append(link);
}

/** The page a link leads to, if it's another page of this site worth loading ahead. */
function target(event: Event): string | null {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
  if (!link || link.target === '_blank' || link.hasAttribute('download')) return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.pathname === location.pathname) return null;
  if (url.pathname.startsWith('/api/')) return null;
  url.hash = '';
  return url.href;
}

export function initPrefetch(): void {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  if (HTMLScriptElement.supports?.('speculationrules')) return;
  if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener(
    'pointerover',
    (event) => {
      clearTimeout(timer);
      const href = target(event);
      if (href) timer = setTimeout(() => warm(href), HOVER_MS);
    },
    { passive: true },
  );
  document.addEventListener('pointerout', () => clearTimeout(timer), { passive: true });
  for (const type of ['focusin', 'touchstart'] as const)
    document.addEventListener(
      type,
      (event) => {
        const href = target(event);
        if (href) warm(href);
      },
      { passive: true },
    );
}
