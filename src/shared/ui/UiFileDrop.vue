<script setup vapor lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ accept?: string; disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ select: [file: File] }>()

const dragging = ref(false)
const input = ref<HTMLInputElement>()

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file) emit('select', file)
}
function onChange(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  if (file) emit('select', file)
  el.value = ''
}
</script>

<template>
  <div
    class="ui-file-drop"
    :class="{ 'is-dragging': dragging, 'is-disabled': disabled }"
    role="button"
    tabindex="0"
    @click="!disabled && input?.click()"
    @keydown.enter.space.prevent="!disabled && input?.click()"
    @dragover.prevent="dragging = !disabled"
    @dragleave="dragging = false"
    @drop.prevent="!disabled && onDrop($event)"
  >
    <slot />
    <input ref="input" type="file" :accept="accept" hidden @change="onChange" />
  </div>
</template>

<style scoped>
.ui-file-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-5);
  text-align: center;
  border: 1.5px dashed var(--glass-border-strong);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  outline: none;
  transition: background var(--duration) var(--ease), border-color var(--duration) var(--ease);
}
.ui-file-drop:hover,
.ui-file-drop:focus-visible { background: var(--glass-bg); border-color: rgba(255, 255, 255, 0.35); }
.ui-file-drop:focus-visible { box-shadow: var(--focus-ring); }
.ui-file-drop.is-dragging { background: rgba(139, 123, 255, 0.12); border-color: var(--accent); }
.ui-file-drop.is-disabled { opacity: 0.5; cursor: not-allowed; }
</style>
