/**
 * The Work section's Sonobe star in three.js (M4.3), for devices that can run it
 * (src/lib/scene3d-support.ts). Loaded by work-model.ts, which owns the inputs and asks for frames;
 * this file only draws them. It shares three.js with the hero's 3D fox, so the two cost one
 * download, counted in the scene3d budget (src/config/quality.ts).
 *
 * The same model and the same two inputs as the SVG (src/lib/sonobe/assemble.ts), with what SVG
 * can't do: light, a soft shadow on the floor, and the units across the star seen through the gaps
 * while it's apart. The canvas takes the square once its first frame is drawn.
 */
import {
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { ASSEMBLE, STAR_UNITS, arrived, star, unitOffset } from '../../lib/sonobe/assemble';
import type { StarRenderer } from './work-model';

/** The camera sits a little above the star; the star tips the rest of the way to the SVG's view. */
const CAMERA = { fov: 30, y: 0.8, z: 6.6, lookY: -0.15 };
const FLOOR_Y = -1.6;
const FADE_MS = 300;

/** The canvas over the star's square, its renderer with soft shadows, the camera, lights and floor. */
const createWorkStage = (stage: HTMLElement) => {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // CSSOM, which the Content Security Policy allows; no inline style attribute.
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    opacity: '0',
    transition: `opacity ${FADE_MS}ms ease-out`,
  });
  stage.append(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA.fov, 1, 0.1, 40);
  camera.position.set(0, CAMERA.y, CAMERA.z);
  camera.lookAt(0, CAMERA.lookY, 0);
  scene.add(new HemisphereLight(0xffffff, 0x8a8a8a, 1.4));
  const sun = new DirectionalLight(0xffffff, 1.9);
  sun.position.set(-2.5, 4.5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 6;
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
  scene.add(sun);
  const floorMaterial = new ShadowMaterial({ opacity: 0.16 });
  const floor = new Mesh(new PlaneGeometry(12, 12), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  scene.add(floor);

  return { canvas, renderer, scene, camera };
};

/** The star: one group per unit, so a unit moves as one piece along its direction. */
const buildStar = (scene: Scene) => {
  const { model, directions, rank } = star();
  const holder = new Group();
  // Turned like the SVG (around y, then tipped), less the tilt the camera's height already gives.
  holder.rotation.set(ASSEMBLE.pitch - Math.atan2(CAMERA.y - CAMERA.lookY, CAMERA.z), ASSEMBLE.yaw, 0);
  scene.add(holder);
  const edgeMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.18 });
  const units = Array.from({ length: STAR_UNITS }, (_, unit) => {
    const group = new Group();
    const material = new MeshStandardMaterial({
      flatShading: true,
      roughness: 0.9,
      side: DoubleSide,
      transparent: true,
    });
    for (const f of model.facets) {
      if (f.unit !== unit) continue;
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(f.points.flat(), 3));
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.add(new LineSegments(new EdgesGeometry(geometry), edgeMaterial));
      group.add(mesh);
    }
    holder.add(group);
    return { group, material };
  });

  return { holder, units, directions, rank, edgeMaterial };
};

/**
 * The star at rest is alive (portfolio-discovery/29-work-plan.md): it floats, rising and swaying a
 * little, and a drag turns it, with inertia; let go, it eases back to its pose. A horizontal drag
 * turns it and a vertical one still scrolls the page (touch-action: pan-y). It draws frames only
 * while it's on screen and something moves; with reduced motion, or while the Inspector is open
 * (the star is apart then, showing the count, and the page has its own 3D to draw), it doesn't
 * float, but still turns when the visitor drags it.
 */
const floatAndTurn = (stage: HTMLElement, holder: Group, render: () => void) => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  let still = reduced || root.classList.contains('inspecting');
  const pose = { x: holder.rotation.x, y: holder.rotation.y };
  const turn = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, held: false, x: 0, y: 0, letGo: 0 };
  let visible = false;
  let frame = 0;
  const step = (now: number) => {
    frame = 0;
    const t = now / 1000;
    if (!turn.held) {
      turn.yaw += turn.vYaw;
      turn.pitch += turn.vPitch;
      turn.vYaw *= 0.94;
      turn.vPitch *= 0.94;
      // Back to its pose, slowly, once the spin has died down.
      if (Math.abs(turn.vYaw) + Math.abs(turn.vPitch) < 0.002 && now - turn.letGo > 1600) {
        turn.yaw *= 0.97;
        turn.pitch *= 0.97;
      }
    }
    turn.pitch = Math.max(-0.7, Math.min(0.7, turn.pitch));
    holder.position.y = still ? 0 : Math.sin(t * 0.9) * 0.07;
    holder.rotation.set(
      pose.x + turn.pitch,
      pose.y + turn.yaw + (still ? 0 : Math.sin(t * 0.55) * 0.05),
      still ? 0 : Math.sin(t * 0.7) * 0.025,
    );
    render();
    const turning =
      turn.held ||
      Math.abs(turn.vYaw) + Math.abs(turn.vPitch) + Math.abs(turn.yaw) + Math.abs(turn.pitch) > 0.001;
    if (visible && (!still || turning)) frame = requestAnimationFrame(step);
  };
  const wake = () => {
    if (!frame && visible) frame = requestAnimationFrame(step);
  };
  const seen = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    wake();
  });
  seen.observe(stage);
  const inspecting = new MutationObserver(() => {
    still = reduced || root.classList.contains('inspecting');
    wake();
  });
  inspecting.observe(root, { attributes: true, attributeFilter: ['class'] });

  stage.classList.add('turnable');
  const grab = (e: PointerEvent) => {
    turn.held = true;
    turn.x = e.clientX;
    turn.y = e.clientY;
    stage.setPointerCapture(e.pointerId);
    wake();
  };
  const drag = (e: PointerEvent) => {
    if (!turn.held) return;
    turn.vYaw = (e.clientX - turn.x) * 0.008;
    turn.vPitch = (e.clientY - turn.y) * 0.008;
    turn.yaw += turn.vYaw;
    turn.pitch += turn.vPitch;
    turn.x = e.clientX;
    turn.y = e.clientY;
  };
  const release = () => {
    turn.held = false;
    turn.letGo = performance.now();
    wake();
  };
  stage.addEventListener('pointerdown', grab);
  stage.addEventListener('pointermove', drag);
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  return () => {
    seen.disconnect();
    inspecting.disconnect();
    cancelAnimationFrame(frame);
    stage.classList.remove('turnable');
    stage.removeEventListener('pointerdown', grab);
    stage.removeEventListener('pointermove', drag);
    stage.removeEventListener('pointerup', release);
    stage.removeEventListener('pointercancel', release);
  };
};

export const mountWorkScene = (stage: HTMLElement, figure: HTMLElement, redraw: () => void): StarRenderer => {
  const { canvas, renderer, scene, camera } = createWorkStage(stage);

  // The star: one group per unit, so a unit moves as one piece along its direction.
  const { holder, units, directions, rank, edgeMaterial } = buildStar(scene);

  // Colours: the five papers of Crease No. 003, from the active identity's tokens.
  const css = (name: string) =>
    new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888');
  const paint = () => {
    const accent = css('--color-accent-ui');
    const ink = css('--color-ink');
    const bg = css('--color-bg');
    const papers = [
      accent,
      accent.clone().lerp(ink, 0.45),
      accent.clone().lerp(bg, 0.55),
      ink,
      ink.clone().lerp(bg, 0.55),
    ];
    units.forEach((u, i) => u.material.color.copy(papers[i % 5]!));
    edgeMaterial.color.copy(ink);
    redraw();
  };
  const themeWatch = new MutationObserver(paint);
  themeWatch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme'],
  });
  const schemeQuery = matchMedia('(prefers-color-scheme: dark)');
  schemeQuery.addEventListener('change', paint);

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    redraw();
  };
  const sizeWatch = new ResizeObserver(resize);
  sizeWatch.observe(stage);
  paint();
  resize();

  const stopTurning = floatAndTurn(stage, holder, () => renderer.render(scene, camera));

  let shown = false;
  return {
    draw(a, e) {
      units.forEach((u, unit) => {
        const r = rank[unit]!;
        const d = directions[unit]!;
        const o = unitOffset(r, a, e);
        const presence = arrived(r, a);
        u.group.position.set(d[0] * o, d[1] * o, d[2] * o);
        u.group.visible = presence > 0;
        u.material.opacity = Math.min(1, presence * 3);
      });
      renderer.render(scene, camera);
      if (!shown) {
        // First frame drawn: take the square from the SVG.
        shown = true;
        canvas.style.opacity = '1';
        figure.classList.add('scene-3d');
      }
    },
    dispose() {
      stopTurning();
      themeWatch.disconnect();
      sizeWatch.disconnect();
      schemeQuery.removeEventListener('change', paint);
      figure.classList.remove('scene-3d');
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
};
