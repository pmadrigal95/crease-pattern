/**
 * Pointer effect "surface": the identity's own texture behind the hero (contour lines, basalt
 * joints, washi fibers; public/textures/) bends around the pointer and settles back within about
 * a second. Contour lines swell like terrain under a lens, basalt joints part as a glacier mist
 * lifts, washi fibers swirl and darken toward ink. At rest it draws exactly the still surface it
 * replaces (the hero's ::before in src/pages/[...locale]/index.astro), hiding it only once its
 * first frame is up, and hands back to it when it goes.
 */
import { colorOf, fit, layerCanvas, program, sleepyLoop, type PointerLayer } from './pointer-layer';

const TILE = 600; // CSS pixels, as the still surface's mask-size.
const MODES: Record<string, number> = { 'contour-lines': 0, 'washi-asagi': 1, 'basalt-glacier': 2 };

const VERTEX = '#version 300 es\nin vec2 aPosition;void main(){gl_Position=vec4(aPosition,0.,1.);}';
const FRAGMENT = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D tile;
uniform vec2 res, lens;
uniform float dpr, energy, mode, strength, time;
uniform vec3 color, ink;
void main() {
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 d = px - lens;
  float r = length(d);
  float fall = exp(-(r * r) / 36100.) * energy; // a 190 px Gaussian
  vec2 dir = r > 0. ? d / r : vec2(0.);
  vec2 off = vec2(0.);
  if (mode < .5) off = -dir * fall * 46. + dir * sin(r * .055 - time * 3.) * 5. * fall;
  else if (mode < 1.5) { float a = fall * 1.1; off = mat2(cos(a), -sin(a), sin(a), cos(a)) * d - d; }
  else off = -dir * fall * 26.;
  float alpha = texture(tile, (px + off) / ${TILE}.).a * strength;
  vec3 c = color;
  if (mode < .5) alpha *= 1. + fall * .9;
  else if (mode < 1.5) { c = mix(color, ink, clamp(fall * .8, 0., 1.)); alpha *= 1. + fall * 1.6; }
  else alpha += fall * .09;
  // The same fade as the still surface: nothing behind the text.
  alpha *= clamp((px.x / (res.x / dpr) - .3) / .45, 0., 1.);
  o = vec4(c * alpha, alpha);
}`;

/** The hero's texture URL, as its CSS custom property names it: url("/textures/contours.svg"). */
const tileUrl = (hero: HTMLElement) =>
  /url\(["']?([^"')]+)["']?\)/.exec(getComputedStyle(hero).getPropertyValue('--surface-tile'))?.[1] ?? '';

/** Shows or hides the still surface: its opacity is --surface-strength (index.astro). */
const stillSurface = (hero: HTMLElement, visible: boolean) => {
  if (visible) hero.style.removeProperty('--surface-strength');
  else hero.style.setProperty('--surface-strength', '0');
};

/** Uploads the tile, rasterized at twice its size so its lines stay crisp on 2x screens. */
const uploadTile = (gl: WebGL2RenderingContext, texture: WebGLTexture, image: HTMLImageElement) => {
  const raster = document.createElement('canvas');
  raster.width = raster.height = TILE * 2;
  raster.getContext('2d')?.drawImage(image, 0, 0, TILE * 2, TILE * 2);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
};

/** The program and the one triangle that covers the canvas; returns a uniform lookup. */
const setUp = (gl: WebGL2RenderingContext) => {
  const p = program(gl, VERTEX, FRAGMENT);
  gl.useProgram(p);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return (name: string) => gl.getUniformLocation(p, name);
};

export const mountPointerLayer = (hero: HTMLElement): PointerLayer => {
  const canvas = layerCanvas(hero, 'surface');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) throw new Error('No WebGL 2');
  const u = setUp(gl);
  const texture = gl.createTexture();
  const look = { mode: 0, strength: 0, color: [0, 0, 0] as number[], ink: [0, 0, 0] as number[] };
  // The lens trails the pointer on a soft spring; energy rises with speed and settles.
  const lens = { x: 0, y: 0, tx: 0, ty: 0, placed: false, energy: 0, target: 0 };
  let last = { x: 0, y: 0, t: 0 };
  let dpr = 1;
  let ready = false;

  const draw = (now: number) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u('res'), canvas.width, canvas.height);
    gl.uniform2f(u('lens'), lens.x, lens.y);
    gl.uniform1f(u('dpr'), dpr);
    gl.uniform1f(u('energy'), lens.energy);
    gl.uniform1f(u('mode'), look.mode);
    gl.uniform1f(u('strength'), look.strength);
    gl.uniform1f(u('time'), now / 1000);
    gl.uniform3fv(u('color'), look.color);
    gl.uniform3fv(u('ink'), look.ink);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = sleepyLoop((now) => {
    lens.x += (lens.tx - lens.x) * 0.14;
    lens.y += (lens.ty - lens.y) * 0.14;
    lens.target *= 0.965;
    lens.energy += (lens.target - lens.energy) * 0.12;
    draw(now);
    return lens.energy > 0.004 || lens.target > 0.004;
  });
  const load = () => {
    ready = false;
    stillSurface(hero, true);
    look.mode = MODES[document.documentElement.dataset.direction ?? ''] ?? 0;
    look.strength = Number(getComputedStyle(hero).getPropertyValue('--surface-strength')) || 0.15;
    look.color = colorOf(hero, '--color-accent-ui');
    look.ink = colorOf(hero, '--color-ink');
    const image = new Image();
    image.addEventListener('load', () => {
      uploadTile(gl, texture, image);
      dpr = fit(canvas, hero, 2);
      draw(performance.now());
      // Only now does the canvas take over from the still surface, so nothing ever blinks.
      stillSurface(hero, false);
      ready = true;
    });
    image.src = tileUrl(hero);
  };
  const resize = new ResizeObserver(() => {
    if (!ready) return;
    dpr = fit(canvas, hero, 2);
    draw(performance.now());
  });
  resize.observe(hero);
  load();

  return {
    move: (x, y) => {
      if (!ready) return;
      const now = performance.now();
      if (!lens.placed) Object.assign(lens, { x, y, placed: true });
      const speed = last.t ? Math.hypot(x - last.x, y - last.y) / Math.max(now - last.t, 1) : 0;
      lens.target = Math.min(1, lens.target + speed * 0.9);
      lens.tx = x;
      lens.ty = y;
      last = { x, y, t: now };
      loop.wake();
    },
    leave: () => {
      last.t = 0;
    },
    refresh: load,
    dispose: () => {
      loop.stop();
      resize.disconnect();
      stillSurface(hero, true);
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
};
