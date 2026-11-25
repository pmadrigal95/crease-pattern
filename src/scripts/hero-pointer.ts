/**
 * Loads the hero's pointer effect (src/lib/pointer-effect.ts) the first time a mouse really moves
 * over the hero, never before: the page's first load, its LCP and Lighthouse don't pay for it.
 * Each effect is a chunk of its own (budget heroPointer). Nothing runs on touch screens, without
 * WebGL 2, while the Inspector is open or while the hero is off screen; each effect also sleeps
 * when the pointer rests (src/components/site/pointer-layer.ts).
 *
 * Started by the home page's hero script, next to the 3D figure's loader, at that first real move.
 */
import { POINTER_EVENT, pointerEffect, type PointerEffect } from '../lib/pointer-effect';
import type { PointerLayer } from '../components/site/pointer-layer';

const load = (effect: Exclude<PointerEffect, 'off'>) =>
  effect === 'ink' ? import('../components/site/pointer-ink') : import('../components/site/pointer-surface');

export const initHeroPointer = (): void => {
  const hero = document.querySelector<HTMLElement>('.hero');
  if (!hero || matchMedia('(pointer: coarse)').matches || !('WebGL2RenderingContext' in window)) return;
  const root = document.documentElement;
  let choice = pointerEffect();
  let layer: PointerLayer | null = null;
  let loading: PointerEffect | null = null;
  let onScreen = true;

  const mount = async (effect: Exclude<PointerEffect, 'off'>) => {
    loading = effect;
    try {
      const { mountPointerLayer } = await load(effect);
      if (choice === effect && !layer) layer = mountPointerLayer(hero);
    } catch (error: unknown) {
      // Offline, or no WebGL context after all: the still surface stays, a complete picture.
      console.warn('Pointer effect unavailable', error);
    } finally {
      loading = null;
    }
  };

  hero.addEventListener(
    'pointermove',
    (e) => {
      // A pointermove with no movement is the page changing under a resting pointer (src/scripts/hero3d.ts).
      if (e.pointerType === 'touch' || (!e.movementX && !e.movementY)) return;
      if (!onScreen || root.classList.contains('inspecting') || choice === 'off') return;
      if (!layer) {
        if (!loading) void mount(choice);
        return;
      }
      const box = hero.getBoundingClientRect();
      layer.move(e.clientX - box.left, e.clientY - box.top);
    },
    { passive: true },
  );
  hero.addEventListener('pointerleave', () => layer?.leave());
  addEventListener(POINTER_EVENT, (e) => {
    choice = (e as CustomEvent<PointerEffect>).detail;
    layer?.dispose();
    layer = null;
  });
  // A new identity or theme brings new colors, and for the surface a new texture.
  const refresh = () => layer?.refresh();
  new MutationObserver(refresh).observe(root, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
  }).observe(hero);
  // The move that brought this script here was the visitor's: the effect starts now, without
  // waiting for another one (on a slow connection the hand may have stopped by the time it arrives).
  if (choice !== 'off' && !root.classList.contains('inspecting')) void mount(choice);
};
