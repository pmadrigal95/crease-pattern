<script setup lang="ts">
/**
 * The Inspector panel (decision 44, M2a). Lists the page's inspectable parts, shows where the
 * pinned one comes from (file, last change, tokens), measures its text contrast, and reports the
 * page's accessibility outline and this visit's Web Vitals. Non-modal: the page stays readable.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { inspector as t } from '../../content/copy/en.json';
import {
  GOOD,
  accessibilityOutline,
  lowestTextContrast,
  observeVitals,
  scriptBytes,
  type Vitals,
} from './measure';
import { explode, layersEnabled, markCurrent } from './layers';
import { currentDirection, currentTheme, setDirection, setTheme, type Theme } from './identity';
import {
  allVisualDirections,
  visualDirectionLabels,
  type VisualDirection,
} from '../../config/visual-direction';

/** Built by scripts/build-inspector-manifest.mjs: facts per file, and each part's file. */
export interface Manifest {
  repository: string;
  commit: string;
  files: Record<
    string,
    { tokens: string[]; lastChange: { commit: string; date: string; subject: string } | null }
  >;
  parts: Record<string, string>;
  identities: { tokenCount: number; swatches: Record<string, { light: string[]; dark: string[] }> };
}

const props = defineProps<{ manifest: Manifest; openedAt: number }>();
const emit = defineEmits<{ close: [] }>();

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

const elements = ref<HTMLElement[]>([]);
const pinned = ref<HTMLElement | null>(null);
const hovered = ref<HTMLElement | null>(null);
const vitals = ref<Vitals>({ lcp: null, cls: 0, inp: null });
const outline = ref(accessibilityOutline());
const announce = ref('');
const firstRun = ref(true);
const box = ref<DOMRect | null>(null);
// The 3D layer view (M2b); phones and reduced motion keep the flat outline.
const threeD = layersEnabled();
const direction = ref<VisualDirection>(currentDirection());
const theme = ref<Theme>(currentTheme());
const themes: Theme[] = ['system', 'light', 'dark'];
const dark = () =>
  theme.value === 'dark' || (theme.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
// The point the contour transition rises from: the control the visitor used.
const origin = (e: Event) => {
  const r = (e.target as HTMLElement).closest('label')?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
};
function chooseDirection(id: VisualDirection, e: Event) {
  direction.value = id;
  setDirection(id, origin(e));
}
function chooseTheme(value: Theme, e: Event) {
  theme.value = value;
  setTheme(value, origin(e));
}
const heading = ref<HTMLElement | null>(null);
const layerButtons = ref<HTMLButtonElement[]>([]);
const scripts = scriptBytes(props.openedAt);

const idOf = (el: Element | null) => el?.getAttribute('data-inspect') ?? '';
const part = (el: Element | null) => {
  const id = idOf(el);
  const file = props.manifest.parts[id];
  const facts = file ? props.manifest.files[file] : undefined;
  return file && facts
    ? { id, file, kind: file.startsWith('src/pages/') ? 'section' : 'component', ...facts }
    : undefined;
};
const label = (id: string) => id.replace('#', ' · ');
const current = computed(() => hovered.value ?? pinned.value);
const details = computed(() => {
  const el = current.value;
  const p = part(el);
  if (!el || !p) return null;
  const rect = el.getBoundingClientRect();
  const contrast = lowestTextContrast(el);
  const root = getComputedStyle(document.documentElement);
  return {
    ...p,
    size: `${Math.round(rect.width)} × ${Math.round(rect.height)} px`,
    source: `${props.manifest.repository}/blob/${props.manifest.commit || 'main'}/${p.file}`,
    contrast,
    contrastPasses: contrast ? contrast.ratio >= (contrast.large ? 3 : 4.5) : true,
    tokens: p.tokens.map((name) => ({
      name,
      value: root.getPropertyValue(`--${name}`).trim(),
      color: name.startsWith('color-'),
    })),
  };
});

function place() {
  if (threeD) markCurrent(elements.value, current.value);
  else box.value = current.value ? current.value.getBoundingClientRect() : null;
}

function pin(el: HTMLElement, focusList = false) {
  pinned.value = el;
  firstRun.value = false;
  announce.value = fill(t.selectedAnnouncement, { name: label(idOf(el)) });
  el.scrollIntoView({
    block: 'nearest',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  if (focusList) layerButtons.value[elements.value.indexOf(el)]?.focus();
  requestAnimationFrame(place);
}

function onListKey(e: KeyboardEvent, index: number) {
  const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
  const edge = { Home: 0, End: elements.value.length - 1 }[e.key];
  if (step === undefined && edge === undefined) return;
  e.preventDefault();
  const next = edge ?? (index + (step ?? 0) + elements.value.length) % elements.value.length;
  layerButtons.value[next]?.focus();
  hovered.value = elements.value[next] ?? null;
  place();
}

// Inspect mode on the page itself: hovering previews a part, clicking pins it.
function onPointerOver(e: PointerEvent) {
  const el = (e.target as Element).closest<HTMLElement>('[data-inspect]');
  if (el && !el.closest('#inspector')) {
    hovered.value = el;
    place();
  }
}
function onClick(e: MouseEvent) {
  const el = (e.target as Element).closest<HTMLElement>('[data-inspect]');
  if (!el || el.closest('#inspector')) return;
  e.preventDefault();
  e.stopPropagation();
  hovered.value = null;
  pin(el);
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}

let stopVitals = () => {};
let settle = () => {};
onMounted(async () => {
  elements.value = [...document.querySelectorAll<HTMLElement>('[data-inspect]')];
  stopVitals = observeVitals((v) => (vitals.value = v));
  document.addEventListener('pointerover', onPointerOver);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey);
  addEventListener('scroll', place, { passive: true });
  addEventListener('resize', place);
  if (threeD) settle = explode(elements.value);
  await nextTick();
  heading.value?.focus();
});
onBeforeUnmount(() => {
  stopVitals();
  settle();
  document.removeEventListener('pointerover', onPointerOver);
  document.removeEventListener('click', onClick, true);
  document.removeEventListener('keydown', onKey);
  removeEventListener('scroll', place);
  removeEventListener('resize', place);
});

const ms = (v: number | null) => (v === null ? null : `${Math.round(v)} ms`);
const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const metrics = computed(() => [
  {
    name: 'LCP',
    value: ms(vitals.value.lcp),
    good: vitals.value.lcp !== null && vitals.value.lcp <= GOOD.lcp,
  },
  { name: 'CLS', value: vitals.value.cls.toFixed(3), good: vitals.value.cls <= GOOD.cls },
  {
    name: 'INP',
    value: ms(vitals.value.inp),
    good: vitals.value.inp !== null && vitals.value.inp <= GOOD.inp,
  },
]);
</script>

<template>
  <div class="inspector-panel">
    <header class="top">
      <h2 ref="heading" tabindex="-1">{{ t.title }}</h2>
      <button type="button" class="close" :aria-label="t.close" @click="emit('close')">×</button>
    </header>
    <p v-if="firstRun" class="intro">{{ t.intro }}</p>
    <p class="sr-only" role="status" aria-live="polite">{{ announce }}</p>

    <section aria-labelledby="inspector-identity">
      <h3 id="inspector-identity">{{ t.identity }}</h3>
      <fieldset class="choices">
        <legend class="sr-only">{{ t.identity }}</legend>
        <label v-for="id in allVisualDirections" :key="id" class="choice">
          <input
            type="radio"
            name="inspector-direction"
            :value="id"
            :checked="direction === id"
            @change="chooseDirection(id, $event)"
          />
          <span class="swatches" aria-hidden="true">
            <span
              v-for="(color, i) in manifest.identities.swatches[id]?.[dark() ? 'dark' : 'light']"
              :key="i"
              :style="{ background: color }"
            ></span>
          </span>
          {{ visualDirectionLabels[id].label }}
        </label>
      </fieldset>
      <p class="muted">{{ fill(t.identityNote, { count: manifest.identities.tokenCount }) }}</p>
      <fieldset class="choices themes">
        <legend>{{ t.theme }}</legend>
        <label v-for="value in themes" :key="value" class="choice">
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
    </section>

    <section aria-labelledby="inspector-layers">
      <h3 id="inspector-layers">{{ t.layers }}</h3>
      <ul class="layers">
        <li v-for="(el, i) in elements" :key="idOf(el)">
          <button
            :ref="(b) => (layerButtons[i] = b as HTMLButtonElement)"
            type="button"
            :aria-pressed="pinned === el"
            :tabindex="(pinned ? pinned === el : i === 0) ? 0 : -1"
            @click="pin(el)"
            @keydown="onListKey($event, i)"
            @focus="
              hovered = el;
              place();
            "
            @blur="
              hovered = null;
              place();
            "
          >
            {{ label(idOf(el)) }}
          </button>
        </li>
      </ul>
    </section>

    <section aria-labelledby="inspector-selected">
      <h3 id="inspector-selected">{{ t.selected }}</h3>
      <p v-if="!details" class="muted">{{ t.nothingSelected }}</p>
      <dl v-else class="facts">
        <dt>{{ details.kind === 'component' ? t.component : t.section }}</dt>
        <dd>
          <strong>{{ label(details.id) }}</strong>
          · <a :href="details.source" target="_blank" rel="noopener">{{ t.source }}</a>
        </dd>
        <template v-if="details.lastChange">
          <dt>{{ t.lastChange }}</dt>
          <dd>
            <time :datetime="details.lastChange.date">{{ details.lastChange.date }}</time> ·
            {{ details.lastChange.subject }}
          </dd>
        </template>
        <dt>{{ t.size }}</dt>
        <dd>{{ details.size }}</dd>
        <dt>{{ t.contrast }}</dt>
        <dd>
          <template v-if="details.contrast">
            {{
              fill(details.contrastPasses ? t.contrastPass : t.contrastFail, {
                ratio: details.contrast.ratio.toFixed(1),
              })
            }}
          </template>
          <template v-else>{{ t.noText }}</template>
        </dd>
        <dt>{{ t.tokens }}</dt>
        <dd>
          <ul class="tokens">
            <li v-for="token in details.tokens" :key="token.name">
              <span
                v-if="token.color"
                class="swatch"
                :style="{ background: token.value }"
                aria-hidden="true"
              ></span>
              <code>--{{ token.name }}</code>
            </li>
          </ul>
        </dd>
      </dl>
    </section>

    <section aria-labelledby="inspector-outline">
      <h3 id="inspector-outline">{{ t.outline }}</h3>
      <h4>{{ t.landmarks }}</h4>
      <ul class="plain">
        <li v-for="(item, i) in outline.landmarks" :key="i">{{ item.label }}</li>
      </ul>
      <h4>{{ t.headings }}</h4>
      <ul class="plain">
        <li v-for="(item, i) in outline.headings" :key="i" :class="`h${item.level}`">
          <span class="level">h{{ item.level }}</span> {{ item.label }}
        </li>
      </ul>
    </section>

    <section aria-labelledby="inspector-metrics">
      <h3 id="inspector-metrics">{{ t.metrics }}</h3>
      <p class="muted">{{ t.metricsNote }}</p>
      <dl class="metrics">
        <div v-for="m in metrics" :key="m.name">
          <dt>{{ m.name }}</dt>
          <dd>
            <template v-if="m.value">{{ m.value }} · {{ m.good ? t.pass : t.fail }}</template>
            <template v-else>{{ t.waiting }}</template>
          </dd>
        </div>
        <div>
          <dt>{{ t.scripts }}</dt>
          <dd>{{ kb(scripts) }}</dd>
        </div>
      </dl>
    </section>
  </div>

  <div
    v-if="box"
    class="highlight"
    aria-hidden="true"
    :style="{
      transform: `translate(${box.left}px, ${box.top}px)`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    }"
  >
    <span>{{ label(idOf(current)) }}</span>
  </div>
</template>
