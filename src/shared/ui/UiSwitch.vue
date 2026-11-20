<script setup vapor lang="ts">
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { disabled: false })
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="ui-switch" :class="{ 'is-disabled': disabled }">
    <input v-model="model" type="checkbox" role="switch" :disabled="disabled" />
    <span class="ui-switch__track"><span class="ui-switch__thumb" /></span>
    <span v-if="label">{{ label }}</span>
  </label>
</template>

<style scoped>
.ui-switch { position: relative; display: inline-flex; align-items: center; gap: var(--space-3); cursor: pointer; user-select: none; }
.ui-switch.is-disabled { opacity: 0.4; cursor: not-allowed; }
.ui-switch input { position: absolute; opacity: 0; pointer-events: none; }
.ui-switch__track {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid var(--glass-border);
  transition: background var(--duration) var(--ease);
}
.ui-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  transition: transform var(--duration) var(--ease);
}
.ui-switch input:checked + .ui-switch__track { background: var(--accent-gradient); border-color: transparent; }
.ui-switch input:checked + .ui-switch__track .ui-switch__thumb { transform: translateX(18px); }
.ui-switch input:focus-visible + .ui-switch__track { box-shadow: var(--focus-ring); }
</style>
