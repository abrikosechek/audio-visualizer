<script setup vapor lang="ts">
import type { UiOption } from './types'

withDefaults(defineProps<{ options: UiOption[]; disabled?: boolean }>(), { disabled: false })
const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="ui-select">
    <select v-model="model" :disabled="disabled">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
  </div>
</template>

<style scoped>
.ui-select { position: relative; width: 100%; }
.ui-select select {
  appearance: none;
  width: 100%;
  height: 36px;
  padding: 0 36px 0 var(--space-3);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  outline: none;
  transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
}
.ui-select select:hover:not(:disabled) { border-color: var(--glass-border-strong); }
.ui-select select:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
.ui-select select:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-select option { background: #14151f; color: var(--text); }
.ui-select svg {
  position: absolute;
  right: 12px;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--text-muted);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
</style>
