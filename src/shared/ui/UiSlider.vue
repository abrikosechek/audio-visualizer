<script setup vapor lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ min?: number; max?: number; step?: number; disabled?: boolean }>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
})
const model = defineModel<number>({ default: 0 })
const fill = computed(() => `${((model.value - props.min) / (props.max - props.min)) * 100}%`)
</script>

<template>
  <input
    v-model.number="model"
    class="ui-slider"
    type="range"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :style="{ '--fill': fill }"
  />
</template>

<style scoped>
.ui-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: var(--radius-full);
  background:
    linear-gradient(90deg, var(--accent), var(--accent-2)) 0 / var(--fill) 100% no-repeat,
    rgba(255, 255, 255, 0.1);
  cursor: pointer;
  outline: none;
}
.ui-slider:disabled { opacity: 0.4; cursor: not-allowed; }
.ui-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 0 0 4px rgba(139, 123, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.4);
  transition: box-shadow var(--duration) var(--ease);
}
.ui-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  border: none;
  box-shadow: 0 0 0 4px rgba(139, 123, 255, 0.25), 0 2px 8px rgba(0, 0, 0, 0.4);
}
.ui-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 6px rgba(139, 123, 255, 0.5); }
</style>
