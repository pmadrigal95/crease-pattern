<script setup lang="ts">
/**
 * The Inspector's identity controls (decision 44, M2c): the three visual identities, the theme,
 * and what the home page's hero offers (InspectorHero.vue). Changes run as the contour transition
 * of decision 42 (identity.ts).
 */
import { ref } from 'vue';
import type { InspectorStrings, Manifest } from './InspectorPanel.vue';
import { currentDirection, currentTheme, setDirection, setTheme, THEMES, type Theme } from './identity';
import { allVisualDirections, type VisualDirection } from '../../config/visual-direction';
import { fill } from '../../lib/template';
import InspectorHero from './InspectorHero.vue';

defineProps<{ t: InspectorStrings; identities: Manifest['identities'] }>();
const direction = ref<VisualDirection>(currentDirection());
const theme = ref<Theme>(currentTheme());
const dark = () =>
  theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
// The point the contour transition rises from: the control the visitor used.
const origin = (e: Event) => {
  const r = (e.target as HTMLElement).closest('label')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
};
const chooseDirection = (id: VisualDirection, e: Event) => {
  direction.value = id;
  setDirection(id, origin(e));
};
const chooseTheme = (value: Theme, e: Event) => {
  theme.value = value;
  setTheme(value, origin(e));
};
</script>

<template>
  <section aria-labelledby="inspector-identity">
    <h3 id="inspector-identity">{{ t.identity }}</h3>
    <fieldset class="choices">
      <legend class="sr-only">{{ t.identity }}</legend>
      <label v-for="id in allVisualDirections" :key="id" class="choice paper" :data-id="id">
        <input
          type="radio"
          name="inspector-direction"
          :value="id"
          :checked="direction === id"
          @change="chooseDirection(id, $event)"
        />
        <span class="sample" aria-hidden="true">
          <span class="swatches">
            <span
              v-for="(color, i) in identities.swatches[id]?.[dark() ? 'dark' : 'light']"
              :key="i"
              :style="{ background: color }"
            ></span>
          </span>
        </span>
        <span class="name">{{ t.identities[id] }}</span>
      </label>
    </fieldset>
    <p class="muted">{{ fill(t.identityNote, { count: identities.tokenCount }) }}</p>
    <fieldset class="choices themes">
      <legend>{{ t.theme }}</legend>
      <label v-for="value in THEMES" :key="value" class="choice">
        <input
          type="radio"
          name="inspector-theme"
          :value="value"
          :checked="theme === value"
          @change="chooseTheme(value, $event)"
        />
        {{ t.themes[value] }}
      </label>
    </fieldset>
    <InspectorHero :t="t" />
  </section>
</template>
