<script setup lang="ts">
/**
 * The Inspector's control for the hero's pointer effect (src/lib/pointer-effect.ts): off, surface
 * or ink. Shown only where there's a mouse to move it; the hero swaps the effect at once.
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
const finePointer = !matchMedia('(pointer: coarse)').matches;
const pointer = ref<PointerEffect>(pointerEffect());
const choose = (value: PointerEffect) => {
  pointer.value = value;
  setPointerEffect(value);
};
</script>

<template>
  <template v-if="finePointer">
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
