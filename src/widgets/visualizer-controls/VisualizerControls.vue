<script setup vapor lang="ts">
import { SETTINGS_LIMITS, useVisualizerSettings } from '@/modules/visualizer-settings'
import { UiButton, UiColorInput, UiPanel, UiSlider, UiSwitch, UiTabs, type UiOption } from '@/shared/ui'

const { settings, reset } = useVisualizerSettings()

const types: UiOption[] = [
  { label: 'Bars', value: 'bars' },
  { label: 'Vinyl', value: 'vinyl' },
]
const modes: UiOption[] = [
  { label: 'From bottom', value: 'bottom' },
  { label: 'From center', value: 'center' },
]
</script>

<template>
  <UiPanel title="Visualizer">
    <template #actions>
      <UiButton size="sm" variant="ghost" @click="reset">Reset</UiButton>
    </template>

    <div class="fields">
      <div class="field">
        <span class="label">Type</span>
        <UiTabs v-model="settings.type" :tabs="types" class="full" />
      </div>

      <div v-if="settings.type === 'bars'" class="field">
        <span class="label">Style</span>
        <UiTabs v-model="settings.mode" :tabs="modes" class="full" />
      </div>

      <div class="field">
        <span class="label">{{ settings.type === 'vinyl' ? 'Groove color' : 'Bar color' }}</span>
        <div class="row">
          <div class="colors">
            <UiColorInput v-model="settings.barColor" />
            <template v-if="settings.gradient">
              <svg class="arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
              <UiColorInput v-model="settings.barColor2" />
            </template>
          </div>
          <UiSwitch v-model="settings.gradient" label="Gradient" />
        </div>
        <span
          class="swatch"
          :style="{ background: settings.gradient ? `linear-gradient(90deg, ${settings.barColor}, ${settings.barColor2})` : settings.barColor }"
        />
      </div>

      <div class="field">
        <span class="label">Background</span>
        <div class="row">
          <UiColorInput v-model="settings.color" :disabled="settings.transparent" />
          <UiSwitch v-model="settings.transparent" label="Transparent" />
        </div>
      </div>

      <div class="field">
        <span class="label">{{ settings.type === 'vinyl' ? 'Grooves count' : 'Bars count' }} <b>{{ settings.type === 'vinyl' ? settings.grooves : settings.bars }}</b></span>
        <UiSlider v-if="settings.type === 'vinyl'" v-model="settings.grooves" v-bind="SETTINGS_LIMITS.grooves" />
        <UiSlider v-else v-model="settings.bars" v-bind="SETTINGS_LIMITS.bars" />
      </div>

      <div class="field">
        <span class="label">Sensitivity <b>{{ settings.sensitivity.toFixed(2) }}×</b></span>
        <UiSlider v-model="settings.sensitivity" v-bind="SETTINGS_LIMITS.sensitivity" />
      </div>

      <div class="field">
        <span class="label">Smoothing <b>{{ settings.smoothing ? `${Math.round(settings.smoothing * 100)}%` : 'Off' }}</b></span>
        <UiSlider v-model="settings.smoothing" v-bind="SETTINGS_LIMITS.smoothing" />
        <span class="hint">Calms twitchy bars without delaying them</span>
      </div>
    </div>
  </UiPanel>
</template>

<style scoped>
.fields { display: flex; flex-direction: column; gap: var(--space-5); }
.field { display: flex; flex-direction: column; gap: var(--space-2); }
.label { display: flex; justify-content: space-between; color: var(--text-muted); font-size: 13px; }
.label b { font-family: var(--font-mono); font-weight: 500; color: var(--text); }
.row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.hint { font-size: 11px; color: var(--text-faint); }
.colors { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.arrow { width: 14px; height: 14px; fill: none; stroke: var(--text-faint); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.swatch { height: 6px; border-radius: var(--radius-full); }
.full { display: flex; }
.full :deep(.ui-tabs__tab) { flex: 1; }
</style>
