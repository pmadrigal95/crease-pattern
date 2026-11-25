<script setup lang="ts">
/**
 * What the Inspector offers about the home page's hero, under the identity controls:
 * - on the home page, with a mouse: the hero's pointer effect (src/lib/pointer-effect.ts), off,
 *   surface or ink; the hero swaps it at once and the choice is kept for the next visit;
 * - on any other page, once the visitor's change brought a new origami figure: a quiet link to
 *   watch it fold on the home page (?fold, HeroFold.astro), where the full figure lives.
 */
import { onBeforeUnmount, ref } from 'vue';
import type { InspectorStrings } from './InspectorPanel.vue';
import {
  POINTER_EFFECTS,
  pointerEffect,
  setPointerEffect,
  type PointerEffect,
} from '../../lib/pointer-effect';

defineProps<{ t: InspectorStrings }>();
const onHome = document.querySelector('.hero [data-hero-fold]') !== null;
const finePointer = !matchMedia('(pointer: coarse)').matches;
const pointer = ref<PointerEffect>(pointerEffect());
const choose = (value: PointerEffect) => {
  pointer.value = value;
  setPointerEffect(value);
};

// The figure the masthead's mark shows now (src/styles/origami.css decides which).
const figure = () =>
  [...document.querySelectorAll('.mast .origami-mark use')].find(
    (use) => getComputedStyle(use).display !== 'none',
  )?.classList.value ?? '';
const home = `${document.querySelector('.mast .me')?.getAttribute('href') ?? '/'}?fold`;
const before = figure();
const newFigure = ref(false);
const watch = new MutationObserver(() => {
  newFigure.value = figure() !== before;
});
if (!onHome)
  watch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-direction', 'data-theme'],
  });
onBeforeUnmount(() => watch.disconnect());
</script>

<template>
  <template v-if="onHome && finePointer">
    <fieldset class="choices themes">
      <legend>{{ t.pointer }}</legend>
      <label v-for="value in POINTER_EFFECTS" :key="value" class="choice">
        <input
          type="radio"
          name="inspector-pointer"
          :value="value"
          :checked="pointer === value"
          @change="choose(value)"
        />
        {{ t.pointers[value] }}
      </label>
    </fieldset>
    <p class="muted">{{ t.pointerNote }}</p>
  </template>
  <p v-else-if="newFigure" class="muted">
    <a :href="home">{{ t.watchFold }}</a>
  </p>
</template>
