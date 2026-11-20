<script setup vapor lang="ts">
import { computed } from 'vue'

/** value in [0, 1]; omit for an indeterminate (unknown duration) bar. */
const props = defineProps<{ value?: number; tone?: 'accent' | 'success' | 'danger' }>()
const width = computed(() => `${Math.round(Math.min(1, Math.max(0, props.value ?? 0)) * 1000) / 10}%`)
</script>

<template>
  <div
    class="ui-progress"
    :class="[`ui-progress--${tone ?? 'accent'}`, { 'is-indeterminate': value === undefined }]"
    role="progressbar"
    :aria-valuenow="value === undefined ? undefined : Math.round(value * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="ui-progress__bar" :style="{ width: value === undefined ? undefined : width }" />
  </div>
</template>

<style scoped>
.ui-progress {
  position: relative;
  height: 6px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.ui-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-gradient);
  box-shadow: 0 0 12px rgba(139, 123, 255, 0.6);
  transition: width 250ms linear;
}
.ui-progress--success .ui-progress__bar { background: var(--success); box-shadow: 0 0 12px rgba(74, 222, 128, 0.5); }
.ui-progress--danger .ui-progress__bar { background: var(--danger); box-shadow: none; }
.is-indeterminate .ui-progress__bar {
  position: absolute;
  width: 35%;
  animation: ui-progress-slide 1.2s var(--ease) infinite;
}
@keyframes ui-progress-slide {
  from { left: -35%; }
  to { left: 100%; }
}
</style>
