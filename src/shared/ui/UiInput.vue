<script setup vapor lang="ts">
withDefaults(defineProps<{ placeholder?: string; type?: string; disabled?: boolean }>(), {
  type: 'text',
  disabled: false,
})
const model = defineModel<string>({ default: '' })
</script>

<template>
  <input v-model="model" class="ui-input" :type="type" :placeholder="placeholder" :disabled="disabled" />
</template>

<style scoped>
.ui-input {
  height: 36px;
  width: 100%;
  padding: 0 var(--space-3);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  outline: none;
  transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
}
.ui-input::placeholder { color: var(--text-faint); }
.ui-input:hover:not(:disabled) { border-color: var(--glass-border-strong); }
.ui-input:focus { border-color: var(--accent); box-shadow: var(--focus-ring); }
.ui-input:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
