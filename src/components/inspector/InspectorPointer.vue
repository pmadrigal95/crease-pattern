<script setup lang="ts">
/**
 * The Inspector's control for the hero's pointer effect (src/lib/pointer-effect.ts): off, surface
 * or ink. Shown only on a page with the hero (the home page) and a mouse to move it: anywhere else
 * the control would do nothing. The choice is kept, so it holds the next time the home page opens.
 */
import { ref } from 'vue';
import type { InspectorStrings } from './InspectorPanel.vue';
import {
  POINTER_EFFECTS,
  pointerEffect,
  setPointerEffect,
  type PointerEffect,
} from '../../lib/pointer-effect';

defineProps<{ t: InspectorStrings }>();
const shown =
  !matchMedia('(pointer: coarse)').matches && document.querySelector('.hero [data-hero-fold]') !== null;
const pointer = ref<PointerEffect>(pointerEffect());
const choose = (value: PointerEffect) => {
  pointer.value = value;
  setPointerEffect(value);
};
</script>

<template>
  <template v-if="shown">
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
</template>
