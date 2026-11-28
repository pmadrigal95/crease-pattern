/*
 * Inlined first thing in <body> (BaseLayout.astro, CSP hash in scripts/csp-hashes.ts), so it runs
 * before the first frame. Block comments only and every statement ended by a semicolon: the
 * inliner joins the lines (scripts/inline-script.ts).
 *
 * A first visit: the entrance (.intro). Between two pages (doc 39, src/styles/transitions.css):
 * the transition's type, from where the visitor goes, and a card's place when one opens a page.
 * - pageswap, on the page being left: if the link followed sits in a card (a case, a post) that is
 *   on screen, its place is kept in sessionStorage for the page it opens.
 * - pagereveal, on the page arriving: the type (open, close, in, back, next, prev, lang) and, for
 *   open or close, the card's place as four insets the page grows from or closes into.
 * No element is named for the card, so no two view-transition names can ever clash.
 */
(() => {
  const r = document.documentElement;
  const KEY = 'pm.vt.card';
  const SECTIONS = ['', 'work', 'changelog', 'precrease', 'about'];
  let done = false;

  interface Entry {
    url: string | null;
    index: number;
  }
  interface Activation {
    from: Entry | null;
    entry: Entry;
    navigationType: string;
  }
  interface Place {
    lang: string;
    segs: string[];
    path: string;
  }

  /* A site path without its language prefix, and the language. */
  const place = (url: string): Place => {
    const segs = new URL(url, location.href).pathname.replace(/\.html$/, '').split('/').filter(Boolean);
    const lang = segs[0] === 'es' ? 'es' : 'en';
    if (lang === 'es') segs.shift();
    return { lang, segs, path: '/' + segs.join('/') };
  };

  /* Between two sections of the menu: next or prev, in the menu's order; a page outside it goes in. */
  const across = (sa: string, sb: string): string => {
    const ia = SECTIONS.indexOf(sa);
    const ib = SECTIONS.indexOf(sb);
    if (ia < 0 || ib < 0) return 'in';
    return ib > ia ? 'next' : 'prev';
  };

  /* Between two places: the same page in another language, deeper, shallower, or across. */
  const between = (from: Place, to: Place): string => {
    if (from.path === to.path) return from.lang === to.lang ? 'in' : 'lang';
    const sa = from.segs[0] ?? '';
    const sb = to.segs[0] ?? '';
    if (sa === sb || sa === '' || sb === '') return to.segs.length >= from.segs.length ? 'in' : 'back';
    return across(sa, sb);
  };

  /* Where the visitor goes, as the transition's type. The browser's back is always back. */
  const typeOf = (a: Activation | null | undefined): string => {
    if (!a || !a.from || !a.from.url || !a.entry.url) return 'in';
    const back = a.navigationType === 'traverse' && a.entry.index < a.from.index;
    const type = between(place(a.from.url), place(a.entry.url));
    return back && type !== 'lang' ? 'back' : type;
  };

  /* The card on this page that links to `url`, if it is on screen. */
  const cardTo = (url: string): DOMRect | null => {
    const want = place(url);
    for (const link of document.querySelectorAll<HTMLAnchorElement>('main a[href]')) {
      const p = place(link.href);
      if (p.path !== want.path || p.lang !== want.lang) continue;
      const card = link.closest('.case-card, .post-card');
      if (!card) continue;
      const box = card.getBoundingClientRect();
      if (box.bottom > 0 && box.top < innerHeight) return box;
    }
    return null;
  };

  const INSETS = ['--vt-t', '--vt-r', '--vt-b', '--vt-l'];
  const inset = (top: number, right: number, bottom: number, left: number): void => {
    [top, innerWidth - right, innerHeight - bottom, left].forEach((v, i) =>
      r.style.setProperty(INSETS[i] ?? '', Math.round(v) + 'px'),
    );
  };

  const enter = (): void => {
    let same = false;
    try {
      same = !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch {
      /* unreadable referrer: treat as a first visit */
    }
    if (!same) r.classList.add('intro');
  };

  /* The card's place, kept for the page it opens, or null. */
  const kept = (): { to: string; t: number; r: number; b: number; l: number } | null => {
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
      sessionStorage.removeItem(KEY);
      return v && v.to === place(location.href).path ? v : null;
    } catch {
      return null;
    }
  };

  /* A card opening this page, or the card this page closes into: the type, and its place set. */
  const card = (type: string, a: Activation | null | undefined): string => {
    const opening = type === 'in' ? kept() : null;
    if (opening) {
      inset(opening.t, opening.r, opening.b, opening.l);
      return 'open';
    }
    const from = type === 'back' && a && a.from ? a.from.url : null;
    const closing = from ? cardTo(from) : null;
    if (!closing) return type;
    inset(closing.top, closing.right, closing.bottom, closing.left);
    return 'close';
  };

  const reveal = (e: { viewTransition?: ViewTransition | null } | null): void => {
    if (done) return;
    done = true;
    const t = e && e.viewTransition;
    if (!t) {
      enter();
      return;
    }
    const a = (window as unknown as { navigation?: { activation?: Activation } }).navigation?.activation;
    (t as ViewTransition & { types?: Set<string> }).types?.add(card(typeOf(a), a));
    r.classList.add('vt-fold');
    t.finished.finally(() => {
      r.classList.remove('vt-fold');
      INSETS.forEach((k) => r.style.removeProperty(k));
    });
  };

  addEventListener('pageswap', (e) => {
    const s = e as Event & { viewTransition?: ViewTransition | null; activation?: Activation | null };
    const to = s.activation && s.activation.entry.url;
    const box = s.viewTransition && to && typeOf(s.activation) === 'in' ? cardTo(to) : null;
    try {
      if (box && to) sessionStorage.setItem(KEY, JSON.stringify({ to: place(to).path, t: box.top, r: box.right, b: box.bottom, l: box.left }));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: the page simply rises */
    }
  });

  if ('onpagereveal' in window) {
    addEventListener('pagereveal', reveal as EventListener);
    /* pagereveal can fire before this script when the page streams in; the first frame catches that */
    requestAnimationFrame(() => {
      reveal(null);
    });
  } else enter();
})();
