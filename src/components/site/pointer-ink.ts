/**
 * Pointer effect "ink": a small fluid in the identity's colors follows the pointer behind the
 * hero's figure (decision 8f; prototype v2.1). Sumi ink that curls in Washi & asagi, a light
 * current in Contour lines, a slow glacier mist in Basalt & glacier. Masked to the hero's right
 * half, so it never runs behind the text; it stops 5 s after the pointer does.
 *
 * Stable fluids on WebGL 2, after Pavel Dobryakov's WebGL Fluid Simulation (MIT,
 * https://github.com/PavelDoGreat/WebGL-Fluid-Simulation).
 */
import { colorOf, fit, layerCanvas, program, sleepyLoop, type PointerLayer } from './pointer-layer';

type Preset = {
  colors: [string, string];
  amount: number;
  radius: number;
  dyeFade: number;
  flowFade: number;
  curl: number;
};
const PRESETS: Record<string, Preset> = {
  'washi-asagi': {
    colors: ['--color-ink', '--color-accent'],
    amount: 0.26,
    radius: 0.0018,
    dyeFade: 0.55,
    flowFade: 0.5,
    curl: 26,
  },
  'contour-lines': {
    colors: ['--color-accent-ui', '--color-accent'],
    amount: 0.22,
    radius: 0.0016,
    dyeFade: 0.95,
    flowFade: 0.4,
    curl: 10,
  },
  'basalt-glacier': {
    colors: ['--color-mute', '--color-accent-ui'],
    amount: 0.12,
    radius: 0.0045,
    dyeFade: 1.4,
    flowFade: 0.3,
    curl: 4,
  },
};
const IDLE_MS = 5000;

const VERTEX =
  '#version 300 es\nprecision highp float;in vec2 aPosition;out vec2 vUv,vL,vR,vT,vB;uniform vec2 texelSize;void main(){vUv=aPosition*.5+.5;vL=vUv-vec2(texelSize.x,0.);vR=vUv+vec2(texelSize.x,0.);vT=vUv+vec2(0.,texelSize.y);vB=vUv-vec2(0.,texelSize.y);gl_Position=vec4(aPosition,0.,1.);}';
const HEAD =
  '#version 300 es\nprecision highp float;precision highp sampler2D;in vec2 vUv,vL,vR,vT,vB;out vec4 o;';
const PASSES = {
  clear: 'uniform sampler2D uTexture;uniform float value;void main(){o=value*texture(uTexture,vUv);}',
  splat:
    'uniform sampler2D uTarget;uniform float aspectRatio,radius;uniform vec4 color;uniform vec2 point;void main(){vec2 p=vUv-point;p.x*=aspectRatio;o=texture(uTarget,vUv)+exp(-dot(p,p)/radius)*color;}',
  advect:
    'uniform sampler2D uVelocity,uSource;uniform vec2 texelSize;uniform float dt,dissipation;void main(){vec2 c=vUv-dt*texture(uVelocity,vUv).xy*texelSize;o=texture(uSource,c)/(1.+dissipation*dt);}',
  divergence:
    'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).x,R=texture(uVelocity,vR).x,T=texture(uVelocity,vT).y,B=texture(uVelocity,vB).y;vec2 C=texture(uVelocity,vUv).xy;if(vL.x<0.)L=-C.x;if(vR.x>1.)R=-C.x;if(vT.y>1.)T=-C.y;if(vB.y<0.)B=-C.y;o=vec4(.5*(R-L+T-B),0.,0.,1.);}',
  curl: 'uniform sampler2D uVelocity;void main(){float L=texture(uVelocity,vL).y,R=texture(uVelocity,vR).y,T=texture(uVelocity,vT).x,B=texture(uVelocity,vB).x;o=vec4(.5*(R-L-T+B),0.,0.,1.);}',
  vorticity:
    'uniform sampler2D uVelocity,uCurl;uniform float curl,dt;void main(){float L=texture(uCurl,vL).x,R=texture(uCurl,vR).x,T=texture(uCurl,vT).x,B=texture(uCurl,vB).x,C=texture(uCurl,vUv).x;vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L));f/=length(f)+.0001;f*=curl*C;f.y*=-1.;vec2 v=texture(uVelocity,vUv).xy+f*dt;o=vec4(clamp(v,-1000.,1000.),0.,1.);}',
  pressure:
    'uniform sampler2D uPressure,uDivergence;void main(){float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x,d=texture(uDivergence,vUv).x;o=vec4((L+R+B+T-d)*.25,0.,0.,1.);}',
  gradient:
    'uniform sampler2D uPressure,uVelocity;void main(){float L=texture(uPressure,vL).x,R=texture(uPressure,vR).x,T=texture(uPressure,vT).x,B=texture(uPressure,vB).x;vec2 v=texture(uVelocity,vUv).xy-vec2(R-L,T-B);o=vec4(v,0.,1.);}',
  display:
    'uniform sampler2D uTexture;uniform float opacity;void main(){vec4 d=texture(uTexture,vUv);float a=clamp(d.a,0.,1.);vec3 c=clamp(d.rgb/max(d.a,.0001),0.,1.);o=vec4(c*a,a)*opacity;}',
};
type Pass = keyof typeof PASSES;

/** A half-float render target: a texture to read and the framebuffer that writes it. */
type Target = { f: WebGLFramebuffer; w: number; h: number; attach: (unit: number) => number };
/** A pass's input: a number, a 2- or 4-component vector, or a target to sample. */
type Uniform = number | number[] | Target;

/** The GPU side: compiled passes, render targets and one call that runs a pass into a target. */
const createGpu = (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) => {
  const passes = Object.fromEntries(
    (Object.keys(PASSES) as Pass[]).map((name) => {
      const p = program(gl, VERTEX, HEAD + PASSES[name]);
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(p, i);
        if (info) uniforms[info.name] = gl.getUniformLocation(p, info.name);
      }
      return [name, { p, uniforms }];
    }),
  ) as Record<Pass, { p: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> }>;
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  const target = (w: number, h: number): Target => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const attach = (unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      return unit;
    };
    return { f, w, h, attach };
  };
  /** Two targets that swap after each write: read the last result, write the next. */
  const pair = (w: number, h: number) => {
    const both = [target(w, h), target(w, h)];
    let i = 0;
    return {
      read: () => both[i]!,
      write: () => both[1 - i]!,
      swap: () => (i = 1 - i),
    };
  };
  /** Runs `name` into `to` (the screen when null) with these uniforms; textures bind in order. */
  const run = (name: Pass, to: Target | null, values: Record<string, Uniform>) => {
    gl.useProgram(passes[name].p);
    let unit = 0;
    for (const [key, value] of Object.entries(values)) {
      const at = passes[name].uniforms[key];
      if (!at) continue;
      if (typeof value === 'number') gl.uniform1f(at, value);
      else if (Array.isArray(value) && value.length === 2) gl.uniform2f(at, value[0]!, value[1]!);
      else if (Array.isArray(value)) gl.uniform4f(at, value[0]!, value[1]!, value[2]!, value[3]!);
      else gl.uniform1i(at, value.attach(unit++));
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.f : null);
    gl.viewport(0, 0, to ? to.w : canvas.width, to ? to.h : canvas.height);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  };
  return { target, pair, run };
};

type Gpu = ReturnType<typeof createGpu>;
type Pair = ReturnType<Gpu['pair']>;

/** The fluid: velocity and dye grids sized to the hero, a splat per stroke, a step per frame. */
const createFluid = (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, hero: HTMLElement) => {
  const gpu = createGpu(gl, canvas);
  let preset = PRESETS['contour-lines']!;
  let palette: number[][] = [];
  let tone = 0;
  let grids!: { cell: number[]; velocity: Pair; dye: Pair; pressure: Pair; divergence: Target; curl: Target };
  /** Grid size for `base` cells on the short side, keeping the hero's aspect. */
  const size = (base: number) => {
    const long = Math.round(base * Math.max(canvas.width / canvas.height, canvas.height / canvas.width));
    return canvas.width > canvas.height ? { w: long, h: base } : { w: base, h: long };
  };
  const build = () => {
    fit(canvas, hero, 1.5);
    const s = size(128);
    const d = size(512);
    grids = {
      cell: [1 / s.w, 1 / s.h],
      velocity: gpu.pair(s.w, s.h),
      dye: gpu.pair(d.w, d.h),
      pressure: gpu.pair(s.w, s.h),
      divergence: gpu.target(s.w, s.h),
      curl: gpu.target(s.w, s.h),
    };
  };
  const readColors = () => {
    preset = PRESETS[document.documentElement.dataset.direction ?? ''] ?? PRESETS['contour-lines']!;
    palette = preset.colors.map((name) => colorOf(hero, name));
  };
  const splat = (x: number, y: number, dx: number, dy: number) => {
    const { velocity, dye } = grids;
    const aspectRatio = canvas.width / canvas.height;
    const at = { aspectRatio, point: [x, y], radius: preset.radius * Math.max(aspectRatio, 1) };
    gpu.run('splat', velocity.write(), { uTarget: velocity.read(), color: [dx, dy, 0, 0], ...at });
    velocity.swap();
    // The two colors take turns, every couple of seconds of drawing.
    const [r = 0, g = 0, b = 0] = palette[(tone = (tone + 1) % 240) < 120 ? 0 : 1] ?? [];
    const a = preset.amount;
    gpu.run('splat', dye.write(), { uTarget: dye.read(), color: [r * a, g * a, b * a, a], ...at });
    dye.swap();
  };
  const step = (dt: number) => {
    const { cell: texelSize, velocity, dye, pressure, divergence, curl } = grids;
    gpu.run('curl', curl, { texelSize, uVelocity: velocity.read() });
    gpu.run('vorticity', velocity.write(), {
      texelSize,
      uVelocity: velocity.read(),
      uCurl: curl,
      curl: preset.curl,
      dt,
    });
    velocity.swap();
    gpu.run('divergence', divergence, { texelSize, uVelocity: velocity.read() });
    gpu.run('clear', pressure.write(), { uTexture: pressure.read(), value: 0.8 });
    pressure.swap();
    for (let i = 0; i < 20; i++) {
      gpu.run('pressure', pressure.write(), {
        texelSize,
        uDivergence: divergence,
        uPressure: pressure.read(),
      });
      pressure.swap();
    }
    gpu.run('gradient', velocity.write(), {
      texelSize,
      uPressure: pressure.read(),
      uVelocity: velocity.read(),
    });
    velocity.swap();
    const flow = (source: Target, dissipation: number) => ({
      texelSize,
      uVelocity: velocity.read(),
      uSource: source,
      dt,
      dissipation,
    });
    gpu.run('advect', velocity.write(), flow(velocity.read(), preset.flowFade));
    velocity.swap();
    gpu.run('advect', dye.write(), flow(dye.read(), preset.dyeFade));
    dye.swap();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gpu.run('display', null, { uTexture: dye.read(), opacity: 0.85 });
  };
  build();
  readColors();
  return { build, readColors, splat, step };
};

export const mountPointerLayer = (hero: HTMLElement): PointerLayer => {
  const canvas = layerCanvas(hero, 'ink');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    canvas.remove();
    throw new Error('No WebGL 2 float targets');
  }
  const fluid = createFluid(gl, canvas, hero);
  let previous: { x: number; y: number } | null = null;
  let lastInput = 0;
  let lastFrame = 0;
  const loop = sleepyLoop((now) => {
    fluid.step(Math.min((now - lastFrame) / 1000 || 0.016, 0.016));
    lastFrame = now;
    return now - lastInput < IDLE_MS;
  });
  const resize = new ResizeObserver(() => fluid.build());
  resize.observe(hero);

  return {
    move: (px, py) => {
      const box = hero.getBoundingClientRect();
      const x = px / box.width;
      const y = 1 - py / box.height;
      if (previous) {
        const dx = (x - previous.x) * 5000 * (canvas.width / canvas.height);
        const dy = (y - previous.y) * 5000;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) fluid.splat(x, y, dx, dy);
      }
      previous = { x, y };
      lastInput = performance.now();
      loop.wake();
    },
    leave: () => {
      previous = null;
    },
    refresh: fluid.readColors,
    dispose: () => {
      loop.stop();
      resize.disconnect();
      canvas.remove();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
};
