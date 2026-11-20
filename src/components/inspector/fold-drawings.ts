/**
 * What the folded views draw over the page (fold.ts), in screen space:
 *
 * - Folded: each section's name just left of its panel with a short leader, and a round handle on
 *   every crease to open it flat or close it again.
 * - Pattern: the page's crease pattern drawn over the flat page, as a pen would, fold by fold:
 *   the sheet, each component boxed and shaded by how much code it is, the creases (mountain
 *   solid, valley dashed), names and real heights in the margins. Components answer the pointer.
 * - The same pattern as a standalone SVG file, to print and fold.
 *
 * Built with the DOM APIs (no inline style attributes: the Content Security Policy forbids them).
 */
import type { Crease } from './fold-pose';

export interface Facts {
  lines?: number | undefined;
  tokens: number;
  date?: string | undefined;
}

export interface FoldHooks {
  name: (el: HTMLElement) => string;
  facts: (el: HTMLElement) => Facts;
  /** The pointer is over a component of the pattern (or left it). */
  onHover: (el: HTMLElement | null) => void;
  onPick: (el: HTMLElement) => void;
  strings: {
    openCrease: string;
    closeCrease: string;
    lines: string;
    tokens: string;
    mountain: string;
    valley: string;
  };
}

const SVG = 'http://www.w3.org/2000/svg';
/** The label column ends this far left of the panel it names. */
const GAP = 28;
const LABEL_W = 180;

const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  cls?: string,
) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (cls) n.setAttribute('class', cls);
  return n;
};

/** Reuses one node per key across frames, so hover, focus and clicks survive redraws. */
const keyed = (layer: HTMLElement) => {
  const nodes = new Map<string, HTMLElement>();
  const seen = new Set<string>();
  return {
    get<T extends HTMLElement>(key: string, make: () => T): T {
      seen.add(key);
      let n = nodes.get(key);
      if (!n) {
        n = make();
        nodes.set(key, n);
        layer.append(n);
      }
      return n as T;
    },
    /** Removes whatever this frame didn't draw. */
    sweep() {
      for (const [key, n] of nodes)
        if (!seen.has(key)) {
          n.remove();
          nodes.delete(key);
        }
      seen.clear();
    },
    clear() {
      for (const n of nodes.values()) n.remove();
      nodes.clear();
    },
  };
};
export type Keyed = ReturnType<typeof keyed>;
export { keyed };

const place = (n: HTMLElement, x: number, y: number) => (n.style.transform = `translate(${x}px, ${y}px)`);

/** The folded page's names and crease handles. `only`: the one section in focus, if any. */
export const drawFold = (
  ink: SVGSVGElement,
  nodes: Keyed,
  page: {
    sections: HTMLElement[];
    creases: Crease[];
    only: number | null;
    hooks: FoldHooks;
    toggle: (i: number) => void;
  },
) => {
  const { sections, creases, only, hooks } = page;
  const items = sections
    // Each section carries a point at the middle of its left edge (fold.ts): the leader lands there.
    .map((el, i) => ({ i, r: (el.querySelector(':scope > .fold-anchor') ?? el).getBoundingClientRect() }))
    .filter(({ i }) => only === null || i === only)
    .map(({ i, r }) => ({ i, ax: r.left, ay: r.top, y: r.top }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < items.length; k++) items[k]!.y = Math.max(items[k]!.y, items[k - 1]!.y + 22);
  ink.replaceChildren();
  for (const it of items) {
    const n = nodes.get(`label-${it.i}`, () =>
      Object.assign(document.createElement('div'), { className: 'fold-label' }),
    );
    n.textContent = hooks.name(sections[it.i]!);
    n.classList.toggle('on', only === it.i);
    const end = it.ax - GAP;
    place(n, end - LABEL_W, it.y - 8);
    ink.append(
      svgEl('path', { d: `M${end + 4} ${it.y} L${it.ax} ${it.ay}` }),
      svgEl('circle', { cx: it.ax, cy: it.ay, r: 2.5 }),
    );
  }
  if (only !== null) return;
  // A handle on each crease, on the hinge line, to open it flat or close it.
  creases.forEach((kind, i) => {
    const hinge = sections[i]!.querySelector<HTMLElement>(':scope > .fold-hinge');
    if (!hinge) return;
    const r = hinge.getBoundingClientRect();
    const b = nodes.get(`crease-${i}`, () => {
      const button = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'fold-crease',
      });
      button.addEventListener('click', () => page.toggle(i));
      return button;
    });
    b.classList.toggle('open', kind === 'open');
    b.setAttribute(
      'aria-label',
      `${kind === 'open' ? hooks.strings.closeCrease : hooks.strings.openCrease}: ${hooks.name(sections[i]!)}`,
    );
    // Alternately at a third and two thirds of the hinge: two short sections' handles never touch.
    const along = i % 2 ? 0.65 : 0.35;
    place(b, r.left + r.width * along - 12, r.top + r.height * along - 12);
  });
};

/** One component's line: its name and real numbers, for the tag that follows the pointer. */
const describe = (el: HTMLElement, hooks: FoldHooks) => {
  const f = hooks.facts(el);
  const bits = [hooks.name(el)];
  if (f.lines) bits.push(`${f.lines} ${hooks.strings.lines}`);
  if (f.tokens) bits.push(`${f.tokens} ${hooks.strings.tokens}`);
  if (f.date) bits.push(f.date);
  return bits.join(' · ');
};

/**
 * The crease pattern over the flat page, built once when it settles so it draws itself in: the
 * sheet, then the components, then the creases in folding order, then the margins.
 */
export const drawPattern = (
  ink: SVGSVGElement,
  nodes: Keyed,
  page: { sections: HTMLElement[]; heights: number[]; hooks: FoldHooks; tag: HTMLElement },
) => {
  const { sections, heights, hooks, tag } = page;
  const rects = sections.map((el) => el.getBoundingClientRect());
  const sheet = {
    left: Math.min(...rects.map((r) => r.left)),
    right: Math.max(...rects.map((r) => r.right)),
    top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  };
  ink.replaceChildren(
    svgEl(
      'rect',
      { x: sheet.left, y: sheet.top, width: sheet.right - sheet.left, height: sheet.bottom - sheet.top },
      'sheet draw',
    ),
  );
  ink.append(...structure(sections));
  const parts = sections.flatMap((s) => [...s.querySelectorAll<HTMLElement>('[data-inspect]')]);
  const heaviest = Math.max(1, ...parts.map((p) => hooks.facts(p).lines ?? 0));
  // Every box read first, then drawn: reads and writes interleaved would force a layout per part.
  const boxes = parts.map((part) => ({ part, p: part.getBoundingClientRect() }));
  boxes.forEach(({ part, p }, k) => {
    if (p.height < 4) return;
    const box = svgEl('rect', { x: p.left, y: p.top, width: p.width, height: p.height }, 'part draw');
    // Shaded by how much code it is: the plan shows where the complexity lives.
    box.style.fillOpacity = String(0.05 + 0.3 * ((hooks.facts(part).lines ?? 0) / heaviest));
    box.style.animationDelay = `${200 + k * 60}ms`;
    box.addEventListener('pointerenter', () => {
      tag.textContent = describe(part, hooks);
      tag.classList.add('on');
      hooks.onHover(part);
    });
    box.addEventListener('pointermove', (e) => place(tag, e.clientX + 14, e.clientY + 14));
    box.addEventListener('pointerleave', () => {
      tag.classList.remove('on');
      hooks.onHover(null);
    });
    box.addEventListener('click', () => hooks.onPick(part));
    ink.append(box);
    // Its name inside the box, where it fits: the plan reads without the pointer.
    if (p.height > 18 && p.width > 56) {
      const name = svgEl('text', { x: p.left + 6, y: p.top + 13 }, 'part-name draw');
      name.textContent = hooks.name(part);
      name.style.animationDelay = `${300 + k * 60}ms`;
      ink.append(name);
    }
  });
  rects.forEach((r, i) => {
    if (i < rects.length - 1) {
      const line = svgEl(
        'line',
        { x1: sheet.left, y1: r.bottom, x2: sheet.right, y2: r.bottom },
        `${i % 2 ? 'valley' : 'mountain'} draw`,
      );
      line.style.animationDelay = `${500 + i * 110}ms`;
      ink.append(line);
    }
    const x = sheet.right + 14;
    const dim = svgEl('g', {}, 'dim draw');
    dim.style.animationDelay = `${1100 + i * 50}ms`;
    dim.append(
      svgEl('line', { x1: x, y1: r.top + 2, x2: x, y2: r.bottom - 2 }),
      svgEl('line', { x1: x - 3, y1: r.top + 2, x2: x + 3, y2: r.top + 2 }),
      svgEl('line', { x1: x - 3, y1: r.bottom - 2, x2: x + 3, y2: r.bottom - 2 }),
    );
    ink.append(dim);
    const label = nodes.get(`plabel-${i}`, () =>
      Object.assign(document.createElement('div'), { className: 'fold-label late' }),
    );
    label.textContent = hooks.name(sections[i]!);
    place(label, sheet.left - 16 - LABEL_W, r.top + (r.height > 18 ? r.height / 2 : 0) - 8);
    const h = nodes.get(`pdim-${i}`, () =>
      Object.assign(document.createElement('div'), { className: 'fold-dim late' }),
    );
    h.textContent = `${Math.round(heights[i]!)} px`;
    place(h, x + 8, r.top + r.height / 2 - 7);
  });
  ink.append(legend(sheet.left, sheet.bottom + 26, hooks));
};

/** How to read the creases, under the names: mountain solid, valley dashed. */
const legend = (x: number, y: number, hooks: FoldHooks) => {
  const g = svgEl('g', {}, 'legend draw');
  g.style.animationDelay = '1300ms';
  const m = svgEl('text', { x: x + 26, y: y + 4 }, 'legend-text');
  m.textContent = hooks.strings.mountain;
  const vx = x + 34 + hooks.strings.mountain.length * 7;
  const v = svgEl('text', { x: vx + 26, y: y + 4 }, 'legend-text');
  v.textContent = hooks.strings.valley;
  g.append(
    svgEl('line', { x1: x, y1: y, x2: x + 20, y2: y }, 'mountain'),
    m,
    svgEl('line', { x1: vx, y1: y, x2: vx + 20, y2: y }, 'valley'),
    v,
  );
  return g;
};

/** What each section is made of, drawn as an architect would: headings, text, media, controls. */
const KINDS: [selector: string, kind: 'head' | 'text' | 'media' | 'control'][] = [
  ['h1, h2, h3, h4', 'head'],
  ['p, li, dd, dt, blockquote, figcaption, label', 'text'],
  ['img, picture, video, canvas, figure > svg, [data-stage]', 'media'],
  ['button, a.button, a[class*="cta"], input, select, textarea', 'control'],
];
const structure = (sections: HTMLElement[]) => {
  const shapes: SVGElement[] = [];
  for (const [selector, kind] of KINDS)
    for (const el of sections.flatMap((s) => [...s.querySelectorAll<HTMLElement>(selector)])) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 3) continue;
      const at = { x: r.left, y: r.top, width: r.width, height: r.height };
      if (kind === 'media') {
        // The plan's sign for an image: a box with its diagonals.
        const g = svgEl('g', {}, 'sk-media draw');
        g.append(
          svgEl('rect', at),
          svgEl('line', { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom }),
          svgEl('line', { x1: r.right, y1: r.top, x2: r.left, y2: r.bottom }),
        );
        shapes.push(g);
      } else shapes.push(svgEl('rect', { ...at, rx: kind === 'control' ? 3 : 1 }, `sk-${kind} draw`));
    }
  return shapes;
};

/** A CSS colour as #rrggbb, whatever syntax the page uses (oklch, color-mix…): every viewer reads hex. */
const hex = (css: string) => {
  const probe = document.createElement('span');
  probe.style.color = css;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return {
    // 256 + n is three hex digits, the last two always n's: no padding needed.
    hex: `#${[r, g, b].map((n) => (256 + n).toString(16).slice(1)).join('')}`,
    light: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
  };
};

/**
 * The pattern on screen as a standalone SVG file, printed the way paper is: dark ink on light
 * paper in any theme, the identity's accent for the creases (deepened if the theme made it light),
 * plain hex colours every viewer reads, names and heights in the margins.
 */
export const patternFile = (ink: SVGSVGElement, labels: HTMLElement, title: string): string => {
  const sheet = ink.querySelector('.sheet')!.getBoundingClientRect();
  const accent =
    [hex('var(--color-accent-ui)'), hex('var(--color-accent)')].find((c) => c.light < 0.5)?.hex ?? '#2f5f86';
  const print = { paper: '#ffffff', sheet: '#fbfaf6', ink: '#1c1f1d', mute: '#6b716d', accent };
  const [ox, oy] = [sheet.left - 230, sheet.top - 60];
  const width = sheet.width + 360;
  const height = sheet.height + 110;
  const shift = (n: Element) => {
    const c = n.cloneNode(true) as SVGElement;
    c.removeAttribute('style');
    c.querySelectorAll('[style]').forEach((d) => d.removeAttribute('style'));
    c.setAttribute('transform', `translate(${-ox} ${-oy})`);
    return c.outerHTML;
  };
  const shapes = [...ink.children].map(shift).join('');
  const texts = [...labels.querySelectorAll<HTMLElement>('.fold-label, .fold-dim')]
    .map((n) => {
      const r = n.getBoundingClientRect();
      const right = n.classList.contains('fold-label');
      const x = (right ? r.right : r.left) - ox;
      const text = (n.textContent ?? '').replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
      return `<text x="${x}" y="${r.top - oy + 11}" text-anchor="${right ? 'end' : 'start'}">${text}</text>`;
    })
    .join('');
  return `<svg xmlns="${SVG}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<title>${title}</title>
<style>rect,line{fill:none;stroke-width:1}.sheet{fill:${print.sheet};stroke:${print.ink}}
.part{stroke:${print.accent};fill:${print.accent};fill-opacity:.06}.mountain,.valley{stroke:${print.accent};stroke-width:1.5}
.valley{stroke-dasharray:6 4}.dim line{stroke:${print.mute}}text{font:12px ui-monospace,Menlo,Consolas,monospace;fill:${print.ink}}
.part-name{font-size:11px;fill:${print.accent}}.legend-text{font-size:11px;fill:${print.mute}}
.sk-head{fill:${print.ink};fill-opacity:.55;stroke:none}.sk-text{fill:${print.ink};fill-opacity:.12;stroke:none}
.sk-media rect,.sk-media line{stroke:${print.mute};stroke-width:.75}.sk-control{stroke:${print.ink};stroke-opacity:.6}</style>
<rect x="0" y="0" width="${width}" height="${height}" fill="${print.paper}" stroke="none"/>${shapes}${texts}</svg>`;
};
