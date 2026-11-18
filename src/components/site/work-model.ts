/**
 * Plays the Work section's Sonobe star (src/components/site/WorkModel.astro). Loaded as the section
 * approaches; its weight has its own budget (workModel, src/config/quality.ts).
 *
 * One controller owns the two inputs (src/lib/sonobe/assemble.ts): assembly `a`, played once when
 * the star comes into view, and Inspect `e`, which follows the Inspector (`.inspecting` on the
 * root). Whatever renderer is active draws them: this file's SVG renderer, or the three.js scene
 * (work3d.ts) on a device that can run it, which takes over mid-assembly from the same state.
 *
 * With reduced motion nothing moves: the star stays assembled and Inspect parts it at once. It
 * renders only while something moves.
 */
import { ASSEMBLE, drawStar, star } from '../../lib/sonobe/assemble';
import { canRun3D, detectDevice } from '../../lib/scene3d-support';

export interface StarRenderer {
  draw(a: number, e: number): void;
  dispose(): void;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The SVG renderer: moves the build-time polygons; each facet keeps its element. */
function svgRenderer(svg: SVGSVGElement): StarRenderer {
  const model = star();
  const ns = 'http://www.w3.org/2000/svg';
  const polygons = model.model.facets.map((f, i) => {
    const existing = svg.querySelector<SVGPolygonElement>(`[data-facet="${i}"]`);
    const polygon = existing ?? document.createElementNS(ns, 'polygon');
    polygon.setAttribute('class', `u${f.unit % 5}`);
    return polygon;
  });
  return {
    draw(a, e) {
      const shown = new Set<number>();
      for (const f of drawStar(model, a, e)) {
        const polygon = polygons[f.index]!;
        polygon.setAttribute('points', f.points.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' '));
        polygon.setAttribute(
          'fill-opacity',
          ((0.6 + 0.4 * f.light) * Math.min(1, f.presence * 3)).toFixed(2),
        );
        svg.append(polygon); // far first, near last: the near ones paint on top
        shown.add(f.index);
      }
      polygons.forEach((polygon, i) => {
        if (!shown.has(i)) polygon.remove();
      });
    },
    dispose() {},
  };
}

export function animateWorkModel(figure: HTMLElement) {
  const stage = figure.querySelector<HTMLElement>('[data-stage]');
  const svg = figure.querySelector<SVGSVGElement>('[data-star]');
  if (!stage || !svg) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  let renderer: StarRenderer = svgRenderer(svg);
  const state = { a: 1, e: root.classList.contains('inspecting') ? 1 : 0 };
  type Tween = { from: number; to: number; start: number; ms: number };
  const tweens: Partial<Record<'a' | 'e', Tween>> = {};

  let running = false;
  function tick() {
    const now = performance.now();
    let moving = false;
    for (const key of ['a', 'e'] as const) {
      const t = tweens[key];
      if (!t) continue;
      const k = t.ms ? clamp01((now - t.start) / t.ms) : 1;
      state[key] = t.from + (t.to - t.from) * k;
      if (k < 1) moving = true;
      else delete tweens[key];
    }
    renderer.draw(state.a, state.e);
    if (moving) requestAnimationFrame(tick);
    else running = false;
  }
  function requestFrame() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }
  function run(key: 'a' | 'e', to: number, ms: number) {
    if (reduced) {
      state[key] = to;
      requestFrame();
      return;
    }
    tweens[key] = { from: state[key], to, start: performance.now(), ms: ms * Math.abs(to - state[key]) };
    requestFrame();
  }

  // The assembly plays once, in view. The loader runs this half a screen early, so while the star
  // is still (mostly) out of sight it takes itself apart; if it's already well in view (a link to
  // #work), it stays assembled rather than vanish and rebuild under the reader's eyes.
  if (!reduced) {
    const box = stage.getBoundingClientRect();
    const seen = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
    if (seen < box.height / 4) {
      state.a = 0;
      renderer.draw(0, state.e);
      new IntersectionObserver(
        ([entry], observer) => {
          if (!entry?.isIntersecting) return;
          observer.disconnect();
          run('a', 1, ASSEMBLE.ms);
        },
        { threshold: 0.35 },
      ).observe(stage);
    }
  }
  if (state.e) renderer.draw(state.a, state.e);

  // Inspect parts the units; closing brings them back.
  new MutationObserver(() => {
    const on = root.classList.contains('inspecting');
    const heading = tweens.e?.to ?? state.e;
    if (on === heading > 0.5) return; // other class changes on the root
    run('e', on ? 1 : 0, on ? ASSEMBLE.inspect.enter : ASSEMBLE.inspect.exit);
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  // On a device that can run it, the three.js scene takes over from the same state.
  if (canRun3D(detectDevice()))
    void import('./work3d')
      .then((m) => {
        const scene = m.mountWorkScene(stage, figure, requestFrame);
        renderer.dispose();
        renderer = scene;
        requestFrame();
      })
      .catch((error: unknown) => console.warn('3D model unavailable; the SVG star stays', error));
}
