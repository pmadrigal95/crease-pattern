<script setup lang="ts">
/**
 * The Inspector's view controls: layers, folded, pattern; the tour (folded views only); how to
 * handle the fold; the pattern's download. The views themselves are use-views.ts.
 */
import type { InspectorStrings } from './InspectorPanel.vue';
import { views, type View } from './use-views';

defineProps<{ t: InspectorStrings; view: View; touring: boolean }>();
const emit = defineEmits<{ choose: [view: View]; tour: []; download: [] }>();
</script>

<template>
  <section aria-labelledby="inspector-view">
    <h3 id="inspector-view">{{ t.view }}</h3>
    <fieldset class="choices themes">
      <legend class="sr-only">{{ t.view }}</legend>
      <label v-for="value in views" :key="value" class="choice">
        <input
          type="radio"
          name="inspector-view"
          :value="value"
          :checked="view === value"
          @change="emit('choose', value)"
        />
        {{ t.views[value] }}
      </label>
    </fieldset>
    <button
      type="button"
      class="tour"
      :aria-pressed="touring"
      :disabled="view === 'layers'"
      @click="emit('tour')"
    >
      {{ touring ? t.tourStop : t.tour }}
    </button>
    <p v-if="view === 'fold'" class="muted hint">{{ t.foldHint }}</p>
    <button v-if="view === 'pattern'" type="button" class="tour" @click="emit('download')">
      {{ t.downloadPattern }}
    </button>
  </section>
</template>
