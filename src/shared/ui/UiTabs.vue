<script setup vapor lang="ts">
import type { UiOption } from './types'

defineProps<{ tabs: UiOption[] }>()
const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="ui-tabs glass" role="tablist">
    <button
      v-for="t in tabs"
      :key="t.value"
      class="ui-tabs__tab"
      :class="{ 'is-active': model === t.value }"
      role="tab"
      :aria-selected="model === t.value"
      @click="model = t.value"
    >
      {{ t.label }}
    </button>
  </div>
</template>

<style scoped>
.ui-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  box-shadow: var(--glass-highlight);
}
.ui-tabs__tab {
  height: 30px;
  padding: 0 var(--space-4);
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--duration) var(--ease), color var(--duration) var(--ease);
}
.ui-tabs__tab:hover { color: var(--text); }
.ui-tabs__tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ui-tabs__tab.is-active {
  background: rgba(255, 255, 255, 0.14);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 2px 8px rgba(0, 0, 0, 0.25);
}
</style>
