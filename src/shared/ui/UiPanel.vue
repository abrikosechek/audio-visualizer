<script setup vapor lang="ts">
withDefaults(defineProps<{ title?: string; strong?: boolean }>(), { strong: false })
</script>

<template>
  <section class="ui-panel glass" :class="{ 'glass--strong': strong }">
    <header v-if="title || $slots.actions" class="ui-panel__header">
      <h3 class="ui-panel__title">{{ title }}</h3>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<style scoped>
.ui-panel {
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.ui-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.ui-panel__title { font-size: 15px; font-weight: 600; }
</style>
