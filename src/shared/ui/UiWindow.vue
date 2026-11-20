<script setup vapor lang="ts">
withDefaults(defineProps<{ title: string; closable?: boolean }>(), { closable: false })
defineEmits<{ close: [] }>()
</script>

<template>
  <div class="ui-window glass glass--strong" role="dialog" :aria-label="title">
    <header class="ui-window__titlebar">
      <span class="ui-window__dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="ui-window__title">{{ title }}</span>
      <button v-if="closable" class="ui-window__close" aria-label="Close" @click="$emit('close')">
        <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" /></svg>
      </button>
      <span v-else class="ui-window__spacer" />
    </header>
    <div class="ui-window__body"><slot /></div>
    <footer v-if="$slots.footer" class="ui-window__footer"><slot name="footer" /></footer>
  </div>
</template>

<style scoped>
.ui-window {
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-width: 280px;
}
.ui-window__titlebar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 40px;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
}
.ui-window__dots { display: flex; gap: 6px; }
.ui-window__dots i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); }
.ui-window__title { flex: 1; font-size: 13px; font-weight: 500; color: var(--text-muted); text-align: center; }
.ui-window__spacer { width: 42px; }
.ui-window__close {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-left: 18px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}
.ui-window__close:hover { background: var(--glass-bg-hover); }
.ui-window__close svg { width: 12px; height: 12px; stroke: var(--text-muted); stroke-width: 1.8; stroke-linecap: round; }
.ui-window__body { padding: var(--space-5); }
.ui-window__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--glass-border);
}
</style>
