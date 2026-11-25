/**
 * What the hero's pointer effects share (src/scripts/hero-pointer.ts loads them): the contract the
 * loader drives, a canvas laid under the hero's text, WebGL 2 programs, the page's colors and a
 * frame loop that sleeps whenever there's nothing left to draw.
 */

/** One pointer effect, mounted on the hero. Positions are in CSS pixels from the hero's corner. */
export interface PointerLayer {
  move(x: number, y: number): void;
  leave(): void;
  /** Re-reads colors (and the surface's texture) after a change of identity or theme. */
  refresh(): void;
  dispose(): void;
}

/**
 * A canvas behind the hero's content, where the still surface sits (the hero's ::before). Styled
 * through the CSS object model, which the Content Security Policy allows (an inline style attribute
 * it would not); `mask` keeps ink off the left half, where the text is.
 */
export const layerCanvas = (hero: HTMLElement, kind: 'surface' | 'ink'): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.className = `pointer-layer ${kind}`;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    zIndex: '-1',
    pointerEvents: 'none',
  });
  if (kind === 'ink') canvas.style.maskImage = 'linear-gradient(to left, #000 30%, transparent 72%)';
  hero.prepend(canvas);
  return canvas;
};

/** Sizes the canvas to the hero at up to `maxDpr` device pixels per CSS pixel. */
export const fit = (canvas: HTMLCanvasElement, hero: HTMLElement, maxDpr: number): number => {
  const box = hero.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  canvas.width = Math.max(2, Math.round(box.width * dpr));
  canvas.height = Math.max(2, Math.round(box.height * dpr));
  return dpr;
};

export const program = (gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram => {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('No shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader');
    return shader;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.bindAttribLocation(p, 0, 'aPosition');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'Program');
  return p;
};

let probe: CanvasRenderingContext2D | null = null;
/** A CSS color (any syntax the browser accepts) as linear-free 0–1 RGB, read on `el`. */
export const colorOf = (el: Element, property: string): [number, number, number] => {
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!probe) return [0, 0, 0];
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = getComputedStyle(el).getPropertyValue(property).trim() || '#000';
  probe.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
};

/**
 * A requestAnimationFrame loop that runs only while `frame` returns true, and wakes again on
 * `wake()`. Effects call wake() from move(); at rest, nothing runs.
 */
export const sleepyLoop = (frame: (now: number) => boolean) => {
  let running = false;
  let handle = 0;
  const tick = (now: number) => {
    if (!running) return;
    if (frame(now)) handle = requestAnimationFrame(tick);
    else running = false;
  };
  return {
    wake: () => {
      if (running) return;
      running = true;
      handle = requestAnimationFrame(tick);
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
};
