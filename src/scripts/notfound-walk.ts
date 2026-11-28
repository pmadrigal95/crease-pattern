/**
 * The 404's figure walks the trail (NotFoundMap.astro, doc 38): down from the summit to the edge
 * where "You are here" stands outside the map, a look to each side, then back up to rest on the
 * summit. Ten seconds a walk, three walks, then it stays on the summit.
 *
 * The figure leans with the trail's slope, bobs a little as it steps and leaves the walked part of
 * the trail drawn solid. The button pauses and resumes it (WCAG 2.2.2) and says which it will do.
 * With reduced motion there is no walk and no button: the figure waits at the edge, by the pin.
 *
 * Moved with SVG attributes (x, y, transform), not inline styles, for the CSP.
 */

/** One stretch of a walk: until when it lasts (s), and where the figure is during it. */
interface Beat {
  until: number;
  /** Position along the trail (0 the summit, 1 the edge) and facing (1 as drawn, -1 mirrored). */
  at: (k: number) => [position: number, facing: 1 | -1];
}

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const BEATS: Beat[] = [
  { until: 3.4, at: (k) => [ease(k), 1] }, // down to the edge
  { until: 4.1, at: () => [1, -1] }, // looks one way
  { until: 4.7, at: () => [1, 1] }, // the other
  { until: 5.3, at: () => [1, -1] }, // turns back
  { until: 8.6, at: (k) => [1 - ease(k), -1] }, // climbs
  { until: 10, at: () => [0, 1] }, // rests on the summit
];
const LOOP = 10;
const WALKS = 3;
/** The steepest lean, in degrees, and how much of the slope it follows. */
const LEAN = 14;
const LEAN_SHARE = 0.25;

/** Where the figure is `seconds` into a walk. */
export const poseAt = (seconds: number): [position: number, facing: 1 | -1] => {
  const t = ((seconds % LOOP) + LOOP) % LOOP;
  let from = 0;
  for (const beat of BEATS) {
    if (t < beat.until) return beat.at((t - from) / (beat.until - from));
    from = beat.until;
  }
  return [0, 1];
};

/** The map's moving parts, or null on a page without them. */
const partsOf = (map: Element | null) => {
  const parts = {
    trail: map?.querySelector<SVGPathElement>('.trail'),
    walked: map?.querySelector<SVGPathElement>('.walked'),
    figure: map?.querySelector<SVGSVGElement>('svg.origami'),
    turn: map?.querySelector<SVGGElement>('.turn'),
    shadow: map?.querySelector<SVGEllipseElement>('.shadow'),
    tag: map?.querySelector<SVGTextElement>('.figure-tag'),
    button: map?.querySelector<HTMLButtonElement>('.pause'),
  };
  return Object.values(parts).every(Boolean)
    ? (parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> })
    : null;
};

export const initNotFoundWalk = (): void => {
  const parts = partsOf(document.querySelector('.nf-map'));
  if (!parts) return;
  const { trail, walked, figure, turn, shadow, tag, button } = parts;

  // The trail is drawn from the pin to the summit: position 0 (the summit) is its far end.
  const length = trail.getTotalLength();
  const size = Number(figure.getAttribute('width'));
  const place = (position: number, facing: 1 | -1) => {
    const along = length * (1 - position);
    const p = trail.getPointAtLength(along);
    const q = trail.getPointAtLength(Math.max(0, along - 2));
    const slope = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const lean = Math.max(-LEAN, Math.min(LEAN, slope * LEAN_SHARE));
    const bob = (1 - Math.cos(position * Math.PI * 24)) * 1.1;
    figure.setAttribute('x', String(p.x - size / 2));
    figure.setAttribute('y', String(p.y - size + 4 - bob));
    shadow.setAttribute('cx', String(p.x));
    shadow.setAttribute('cy', String(p.y + 3));
    // Its name, while inspecting, keeps to its left.
    tag.setAttribute('x', String(p.x - 18));
    tag.setAttribute('y', String(p.y - 6));
    const mirror = facing < 0 ? ` translate(${2 * p.x} 0) scale(-1 1)` : '';
    turn.setAttribute('transform', `rotate(${lean} ${p.x} ${p.y})${mirror}`);
    walked.setAttribute('stroke-dasharray', `0 ${1 - position} ${position} 0`);
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    place(1, -1);
    return;
  }

  let running = true;
  let clock = 0;
  let last = 0;
  let frame = 0;
  const show = () => {
    button.textContent = (running ? button.dataset.pause : button.dataset.play) ?? '';
    button.setAttribute('aria-pressed', String(!running));
  };
  const tick = (now: number) => {
    frame = 0;
    if (!running) return;
    clock += last ? (now - last) / 1000 : 0;
    last = now;
    if (clock >= LOOP * WALKS) {
      running = false;
      place(0, 1);
      show();
      return;
    }
    place(...poseAt(clock));
    frame = requestAnimationFrame(tick);
  };
  button.addEventListener('click', () => {
    running = !running;
    if (running && clock >= LOOP * WALKS) clock = 0;
    last = 0;
    show();
    if (running && !frame) frame = requestAnimationFrame(tick);
  });
  button.hidden = false;
  frame = requestAnimationFrame(tick);
};
