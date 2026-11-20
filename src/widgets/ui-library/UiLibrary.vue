<script setup vapor lang="ts">
import { ref } from 'vue'
import {
  UiBadge,
  UiButton,
  UiCheckbox,
  UiColorInput,
  UiFileDrop,
  UiInput,
  UiPanel,
  UiProgress,
  UiSelect,
  UiSlider,
  UiSpinner,
  UiSwitch,
  UiTabs,
  UiWindow,
  type UiOption,
} from '@/shared/ui'

const text = ref('')
const volume = ref(60)
const enabled = ref(true)
const checked = ref(true)
const source = ref('mic')
const tab = ref('bars')
const windowOpen = ref(true)
const color = ref('#0b0b14')
const droppedFile = ref('')

const sources: UiOption[] = [
  { label: 'Microphone', value: 'mic' },
  { label: 'Audio file', value: 'file' },
  { label: 'System audio', value: 'system' },
]
const tabs: UiOption[] = [
  { label: 'Bars', value: 'bars' },
  { label: 'Wave', value: 'wave' },
  { label: 'Circle', value: 'circle' },
]
</script>

<template>
  <div class="ui-library">
    <UiPanel title="UiButton">
      <p class="desc">Actions. Variants: primary, glass, ghost, danger. Sizes: sm, md, lg.</p>
      <div class="row">
        <UiButton variant="primary">Primary</UiButton>
        <UiButton>Glass</UiButton>
        <UiButton variant="ghost">Ghost</UiButton>
        <UiButton variant="danger">Danger</UiButton>
      </div>
      <div class="row">
        <UiButton size="sm">Small</UiButton>
        <UiButton size="lg">Large</UiButton>
        <UiButton disabled>Disabled</UiButton>
      </div>
    </UiPanel>

    <UiPanel title="UiInput">
      <p class="desc">Text field with <code>v-model</code>.</p>
      <UiInput v-model="text" placeholder="Type something…" />
      <p class="value">value: {{ text || '—' }}</p>
    </UiPanel>

    <UiPanel title="UiSlider">
      <p class="desc">Range input with gradient fill. Props: min, max, step.</p>
      <UiSlider v-model="volume" />
      <p class="value">value: {{ volume }}</p>
    </UiPanel>

    <UiPanel title="UiSelect">
      <p class="desc">Native select styled as glass. Props: options.</p>
      <UiSelect v-model="source" :options="sources" />
      <p class="value">value: {{ source }}</p>
    </UiPanel>

    <UiPanel title="UiSwitch & UiCheckbox">
      <p class="desc">Boolean toggles with <code>v-model</code>.</p>
      <div class="col">
        <UiSwitch v-model="enabled" label="Enable visualizer" />
        <UiCheckbox v-model="checked" label="Show peaks" />
        <UiSwitch label="Disabled" disabled />
      </div>
    </UiPanel>

    <UiPanel title="UiTabs">
      <p class="desc">Segmented control. Props: tabs.</p>
      <UiTabs v-model="tab" :tabs="tabs" />
      <p class="value">value: {{ tab }}</p>
    </UiPanel>

    <UiPanel title="UiBadge">
      <p class="desc">Status labels. Tones: neutral, accent, success, warning, danger.</p>
      <div class="row">
        <UiBadge>Neutral</UiBadge>
        <UiBadge tone="accent">Accent</UiBadge>
        <UiBadge tone="success">Live</UiBadge>
        <UiBadge tone="warning">Buffering</UiBadge>
        <UiBadge tone="danger">Error</UiBadge>
      </div>
    </UiPanel>

    <UiPanel title="UiPanel">
      <p class="desc">Glass container with optional title and <code>#actions</code> slot. This card is one.</p>
      <UiPanel title="Nested" strong>
        <template #actions><UiBadge tone="accent">strong</UiBadge></template>
        <p class="desc">Panel with <code>strong</code> prop.</p>
      </UiPanel>
    </UiPanel>

    <UiPanel title="UiProgress & UiSpinner">
      <p class="desc">Determinate (<code>value</code> 0–1) or indeterminate (no value). Tones: accent, success, danger.</p>
      <div class="col">
        <UiProgress :value="volume / 100" />
        <UiProgress />
        <UiProgress :value="1" tone="success" />
        <div class="row"><UiSpinner /> <UiSpinner :size="28" /></div>
      </div>
    </UiPanel>

    <UiPanel title="UiColorInput">
      <p class="desc">Color picker with swatch and hex value.</p>
      <div class="row">
        <UiColorInput v-model="color" />
        <UiColorInput model-value="#444444" disabled />
      </div>
    </UiPanel>

    <UiPanel title="UiFileDrop">
      <p class="desc">Drop zone / file picker. Emits <code>select</code> with a File.</p>
      <UiFileDrop @select="droppedFile = $event.name">
        <strong>Drop a file</strong>
        <span class="desc">or click to browse</span>
      </UiFileDrop>
      <p class="value">file: {{ droppedFile || '—' }}</p>
    </UiPanel>

    <UiPanel title="UiWindow" class="wide">
      <p class="desc">Glass window with titlebar, body and <code>#footer</code> slot. Emits <code>close</code>.</p>
      <div class="window-stage">
        <UiWindow v-if="windowOpen" title="Visualizer settings" closable @close="windowOpen = false">
          <div class="col">
            <UiSelect v-model="source" :options="sources" />
            <UiSlider v-model="volume" />
            <UiSwitch v-model="enabled" label="Enabled" />
          </div>
          <template #footer>
            <UiButton variant="ghost" @click="windowOpen = false">Cancel</UiButton>
            <UiButton variant="primary" @click="windowOpen = false">Apply</UiButton>
          </template>
        </UiWindow>
        <UiButton v-else @click="windowOpen = true">Reopen window</UiButton>
      </div>
    </UiPanel>
  </div>
</template>

<style scoped>
.ui-library {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}
.wide { grid-column: 1 / -1; }
.desc { color: var(--text-muted); margin-bottom: var(--space-4); }
.value { margin-top: var(--space-3); font-family: var(--font-mono); font-size: 12px; color: var(--text-faint); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
.row + .row { margin-top: var(--space-3); }
.col { display: flex; flex-direction: column; gap: var(--space-4); }
code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}
.window-stage {
  display: grid;
  place-items: center;
  min-height: 300px;
  padding: var(--space-5);
  border-radius: var(--radius-md);
  background:
    radial-gradient(circle at 30% 40%, rgba(139, 123, 255, 0.5), transparent 40%),
    radial-gradient(circle at 70% 60%, rgba(61, 214, 255, 0.4), transparent 40%);
}
.window-stage :deep(.ui-window) { width: min(380px, 100%); }
</style>
