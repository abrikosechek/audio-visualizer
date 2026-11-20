<script setup vapor lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 18 })
</script>

<template>
  <span class="ui-spinner" :style="{ width: `${size}px`, height: `${size}px` }" role="status" aria-label="Loading" />
</template>

<style scoped>
.ui-spinner {
  display: inline-block;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--accent-2);
  border-right-color: var(--accent);
  animation: ui-spin 0.7s linear infinite;
}
@keyframes ui-spin {
  to { transform: rotate(360deg); }
}
</style>
