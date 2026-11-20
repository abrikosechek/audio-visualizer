<script setup vapor lang="ts">
withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const model = defineModel<string>({ default: '#000000' })
</script>

<template>
  <label class="ui-color" :class="{ 'is-disabled': disabled }">
    <span class="ui-color__swatch" :style="{ background: model }" />
    <span class="ui-color__value">{{ model.toUpperCase() }}</span>
    <input v-model="model" type="color" :disabled="disabled" />
  </label>
</template>

<style scoped>
.ui-color {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-3) 0 6px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
}
.ui-color:hover { border-color: var(--glass-border-strong); }
.ui-color:focus-within { border-color: var(--accent); box-shadow: var(--focus-ring); }
.ui-color.is-disabled { opacity: 0.4; cursor: not-allowed; }
.ui-color__swatch {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  border: 1px solid var(--glass-border-strong);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
}
.ui-color__value { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
.ui-color input { position: absolute; inset: 0; opacity: 0; cursor: inherit; width: 100%; height: 100%; }
</style>
