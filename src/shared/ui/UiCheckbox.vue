<script setup vapor lang="ts">
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { disabled: false })
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="ui-checkbox" :class="{ 'is-disabled': disabled }">
    <input v-model="model" type="checkbox" :disabled="disabled" />
    <span class="ui-checkbox__box">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
    </span>
    <span v-if="label">{{ label }}</span>
  </label>
</template>

<style scoped>
.ui-checkbox { position: relative; display: inline-flex; align-items: center; gap: var(--space-2); cursor: pointer; user-select: none; }
.ui-checkbox.is-disabled { opacity: 0.4; cursor: not-allowed; }
.ui-checkbox input { position: absolute; opacity: 0; pointer-events: none; }
.ui-checkbox__box {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border-strong);
  transition: background var(--duration) var(--ease), border-color var(--duration) var(--ease);
}
.ui-checkbox__box svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #0b0b14;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  opacity: 0;
}
.ui-checkbox input:checked + .ui-checkbox__box { background: var(--accent-gradient); border-color: transparent; }
.ui-checkbox input:checked + .ui-checkbox__box svg { opacity: 1; }
.ui-checkbox input:focus-visible + .ui-checkbox__box { box-shadow: var(--focus-ring); }
</style>
