/**
 * The Inspector's folded views (prototype). The page is one sheet of paper:
 *
 * - `fold`: it folds like a Miura-ori, one section per panel, in the space beside the Inspector.
 *   The visitor can close and open the accordion, turn it, and open any crease flat
 *   (fold-gestures.ts); each section's name sits just left of its panel.
 * - `pattern`: it opens flat and its crease pattern draws itself over it (fold-drawings.ts).
 *
 * Real HTML moved by CSS 3D, like the layer view (layers.ts); the geometry is fold-pose.ts.
 * Loaded only when a visitor picks a folded view, so the Inspector's own code doesn't carry it.
 */
import { drawFold, drawPattern, keyed, patternFile, type FoldHooks } from './fold-drawings';
import { foldGestures } from './fold-gestures';
import { foldPoses, modelTurn, restShape, type Box, type Shape } from './fold-pose';

export type FoldView = 'fold' | 'pattern';
export type { FoldHooks } from './fold-drawings';

export interface Folded {
  /** The page's sections, in reading order: the tour's stops. */
  sections: HTMLElement[];
  show: (view: FoldView) => void;
  /** One section at the front, the rest stepped back; null for the whole page. */
  focus: (index: number | null) => void;
  /** The crease pattern as an SVG file's text. */
  patternSvg: (title: string) => string;
  /** Unfolds back to the page, then puts the document back as it was. */
  close: () => Promise<void>;
}

const MS = 1100;
/** The Inspector panel's width, and the margins around the page (labels on the left). */
const PANEL = 400;
const MARGIN = { left: 230, right: 110, top: 48, bottom: 48 };

const div = (cls: string) => Object.assign(document.createElement('div'), { className: cls });

const union = (rects: DOMRect[]) => {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
};

/** The space beside the Inspector where the page stands. */
const room = () => ({
  x: MARGIN.left,
  y: MARGIN.top,
  w: Math.max(240, innerWidth - PANEL - MARGIN.left - MARGIN.right),
  h: innerHeight - MARGIN.top - MARGIN.bottom,
});

/** The page's layout at rest, from offsets: they ignore transforms, so nothing tilted skews it. */
const layoutOf = (sections: HTMLElement[]): Box[] =>
  sections.map((el) => {
    let top = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    return { top, h: el.offsetHeight, w: el.offsetWidth };
  });

/** The stage: the page moves into it; the Inspector and the drawings stay outside. */
const buildStage = (keep: Element[]) => {
  const [stage, cam, fit, persp, model, sheet] = [
    div('fold-stage'),
    div('fold-cam'),
    div('fold-fit'),
    div('fold-persp'),
    div('fold-model'),
    div('fold-sheet'),
  ] as const;
  for (const n of [...document.body.childNodes]) if (!keep.includes(n as Element)) sheet.append(n);
  model.append(sheet);
  persp.append(model);
  fit.append(persp);
  cam.append(fit);
  stage.append(cam);
  document.body.prepend(stage);
  const ink = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ink.classList.add('fold-ink');
  const labels = div('fold-labels');
  const tag = div('fold-tag');
  labels.append(tag);
  document.body.append(ink, labels);
  return { stage, cam, fit, persp, model, sheet, ink, labels, tag };
};
type Stage = ReturnType<typeof buildStage>;

/** Marks the page's sections: a hinge on each one's lower edge, a shade for its valley face. */
const prepare = (sections: HTMLElement[], sheet: HTMLElement) => {
  const restyled: HTMLElement[] = [];
  sections.forEach((el) => {
    el.classList.add('fold-section');
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      restyled.push(el);
    }
    el.append(div('fold-hinge'), div('fold-shade'), div('fold-anchor'));
    for (let n = el.parentElement; n && n !== sheet; n = n.parentElement) n.classList.add('fold-trunk');
  });
  return () => {
    for (const el of sections) {
      el.classList.remove('fold-section', 'fold-dim', 'fold-current');
      el.style.transform = '';
      el.querySelectorAll(':scope > .fold-hinge, :scope > .fold-shade, :scope > .fold-anchor').forEach((n) =>
        n.remove(),
      );
    }
    for (const el of restyled) el.style.position = '';
    document.querySelectorAll('.fold-trunk').forEach((n) => n.classList.remove('fold-trunk'));
  };
};

/** Poses the sections for a view and shape, and marks each crease and valley face. */
const pose = (s: Stage, sections: HTMLElement[], layout: Box[], at: { view: FoldView; shape: Shape }) => {
  if (at.view === 'pattern') {
    s.model.style.transform = 'none';
    for (const el of sections) el.style.transform = 'none';
    return [];
  }
  const { transforms, creases } = foldPoses(layout, at.shape);
  s.model.style.transform = modelTurn(at.shape);
  sections.forEach((el, i) => {
    el.style.transform = transforms[i]!;
    const kind = creases[i];
    el.querySelector(':scope > .fold-hinge')?.setAttribute('class', `fold-hinge ${kind ?? 'end'}`);
    // A face turned away from the light (after a mountain, before the next) is shaded.
    el.classList.toggle('fold-away', i > 0 && creases[i - 1] === 'mountain');
  });
  return creases;
};

/** Fits the posed page into the room, with the eye in front of its middle. `read` measures safely. */
const fitView = (
  s: Stage,
  sections: HTMLElement[],
  posed: () => void,
  read: <T>(p: () => void, r: () => T) => T,
) => {
  const bare = () => {
    posed();
    s.fit.style.transform = 'none';
    s.cam.style.transform = 'none';
  };
  const box = () => union(sections.map((el) => el.getBoundingClientRect()));
  // At the sheet's own middle, thousands of pixels away on a long page, the top would be seen from behind.
  s.persp.style.perspectiveOrigin = '50% 50%';
  const first = read(bare, box);
  s.persp.style.perspectiveOrigin = `${(first.left + first.right) / 2}px ${(first.top + first.bottom) / 2}px`;
  const u = read(bare, box);
  const r = room();
  const k = Math.min(r.w / u.width, r.h / u.height);
  posed();
  s.fit.style.transform = `translate(${r.x + r.w / 2 - (k * (u.left + u.right)) / 2}px, ${r.y + r.h / 2 - (k * (u.top + u.bottom)) / 2}px) scale(${k})`;
  s.cam.style.transform = 'none';
};

/** Reads the page in a pose without showing it: no transition, then everything put back. */
const reader =
  (s: Stage, sections: HTMLElement[]) =>
  <T>(posed: () => void, read: () => T): T => {
    const root = document.documentElement;
    const flush = () => void s.sheet.offsetWidth;
    const all = [s.cam, s.fit, s.model, ...sections];
    root.classList.add('fold-measure');
    flush();
    const before = all.map((n) => n.style.transform);
    posed();
    flush();
    const out = read();
    all.forEach((n, i) => (n.style.transform = before[i] ?? ''));
    flush();
    root.classList.remove('fold-measure');
    flush();
    return out;
  };

/** Points the camera at one section's box (screen space, camera at rest): it fills the room. */
const camOn = (s: Stage, r: DOMRect) => {
  const area = room();
  const k = Math.min(area.w / r.width, area.h / r.height, 4);
  s.cam.style.transform = `translate(${area.x + area.w / 2}px, ${area.y + area.h / 2}px) scale(${k}) translate(${-(r.left + r.width / 2)}px, ${-(r.top + r.height / 2)}px)`;
};

/** In: the stage shows the page exactly as it was on screen, with no transition; the fold follows. */
const enter = (s: Stage, saved: number) => {
  const root = document.documentElement;
  root.classList.add('fold-measure', 'fold-on');
  // The folded page is a model to look at, not to use: its links, a few pixels wide, stay out of
  // reach of the pointer and the keyboard. The panel is how it's explored.
  s.sheet.inert = true;
  s.fit.style.transform = `translate(0px, ${-saved}px)`;
  void s.sheet.offsetWidth;
  root.classList.remove('fold-measure');
  void s.sheet.offsetWidth;
};

/** Unfolds back to the page as the visitor left it, then puts the document back. */
const unfold = (s: Stage, sections: HTMLElement[], saved: number, unprepare: () => void) =>
  new Promise<void>((done) => {
    const root = document.documentElement;
    root.classList.remove('fold-settled', 'fold-pattern', 'fold-live');
    s.ink.replaceChildren();
    for (const el of sections) el.style.transform = '';
    s.model.style.transform = '';
    s.cam.style.transform = 'none';
    s.fit.style.transform = `translate(0px, ${-saved}px)`;
    setTimeout(() => {
      root.classList.add('fold-measure');
      root.classList.remove('fold-on');
      s.sheet.inert = false;
      for (const n of [...s.sheet.childNodes]) document.body.insertBefore(n, s.stage);
      for (const n of [s.stage, s.ink, s.labels]) n.remove();
      unprepare();
      // Instant: the site scrolls smoothly, and the page must be back where it was, not travelling.
      scrollTo({ top: saved, behavior: 'instant' });
      void s.sheet.offsetWidth;
      root.classList.remove('fold-measure');
      done();
    }, MS);
  });

export const foldPage = (keep: Element[], hooks: FoldHooks): Folded => {
  const root = document.documentElement;
  const saved = scrollY;
  const sections = [...document.querySelectorAll<HTMLElement>('[data-inspect]')].filter(
    (el) => !el.parentElement?.closest('[data-inspect]') && !keep.some((k) => k.contains(el)),
  );
  // Measured at the top of the page: a sticky masthead's offset follows the scroll. Nothing paints
  // in between: the stage below shows the page exactly where the visitor left it.
  scrollTo({ top: 0, behavior: 'instant' });
  const layout = layoutOf(sections);
  const s = buildStage(keep);
  const unprepare = prepare(sections, s.sheet);
  const nodes = keyed(s.labels);
  const at = { view: 'fold' as FoldView, shape: restShape(sections.length) };
  let creases = pose(s, sections, layout, at);
  let focused: number | null = null;

  const measured = reader(s, sections);

  // ---------- Drawings, following the page while it moves ----------
  let until = 0;
  const toggle = (i: number) => {
    at.shape.open[i] = !at.shape.open[i];
    refit();
  };
  const drawFolded = () => drawFold(s.ink, nodes, { sections, creases, only: focused, hooks, toggle });
  const follow = () => {
    root.classList.remove('fold-settled');
    const start = performance.now();
    const running = until > start;
    until = Math.max(until, start + MS + 100);
    setTimeout(() => {
      if (performance.now() < until - 200) return;
      root.classList.add('fold-settled');
      // The pattern draws itself once, when the page lies still under it.
      if (at.view === 'pattern' && focused === null) {
        nodes.clear();
        drawPattern(s.ink, nodes, { sections, heights: layout.map((l) => l.h), hooks, tag: s.tag });
      }
    }, MS - 100);
    if (running || at.view === 'pattern') return;
    const tick = () => {
      // A change of view stops the folded drawings: the pattern draws on its own.
      if (at.view !== 'fold') return;
      drawFolded();
      nodes.sweep();
      if (performance.now() < until && root.classList.contains('fold-on')) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const refit = () => {
    fitView(s, sections, () => (creases = pose(s, sections, layout, at)), measured);
    follow();
  };

  const show = (view: FoldView) => {
    at.view = view;
    focused = null;
    root.classList.toggle('fold-pattern', view === 'pattern');
    nodes.clear();
    s.ink.replaceChildren();
    sections.forEach((el) => el.classList.remove('fold-dim', 'fold-current'));
    refit();
  };

  const focus = (index: number | null) => {
    focused = index;
    sections.forEach((el, i) => {
      el.classList.toggle('fold-dim', index !== null && i !== index);
      el.classList.toggle('fold-current', i === index);
    });
    nodes.clear();
    if (index === null) {
      s.cam.style.transform = 'none';
      follow();
      return;
    }
    camOn(
      s,
      measured(
        () => (s.cam.style.transform = 'none'),
        () => sections[index]!.getBoundingClientRect(),
      ),
    );
    follow();
  };

  // A hand on the page: drawn live while it moves, gliding when it lets go.
  const unhand = foldGestures(s.stage, at.shape, (live) => {
    if (at.view !== 'fold' || focused !== null) return;
    root.classList.toggle('fold-live', live);
    if (!live) return refit();
    // Refitted every move (transitions are off while live), so the page never leaves the room.
    fitView(s, sections, () => (creases = pose(s, sections, layout, at)), measured);
    drawFolded();
    nodes.sweep();
  });

  enter(s, saved);
  show('fold');
  const onResize = () => (focused === null ? refit() : focus(focused));
  addEventListener('resize', onResize);

  const close = () => {
    removeEventListener('resize', onResize);
    unhand();
    nodes.clear();
    return unfold(s, sections, saved, unprepare);
  };

  return { sections, show, focus, patternSvg: (title) => patternFile(s.ink, s.labels, title), close };
};
