<script setup vapor lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }>(), {
  tone: 'neutral',
})
</script>

<template>
  <span class="ui-badge" :class="`ui-badge--${tone}`"><slot /></span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}
.ui-badge--neutral { background: var(--glass-bg); border-color: var(--glass-border); color: var(--text-muted); }
.ui-badge--accent { background: rgba(139, 123, 255, 0.15); border-color: rgba(139, 123, 255, 0.4); color: #b9afff; }
.ui-badge--success { background: rgba(74, 222, 128, 0.12); border-color: rgba(74, 222, 128, 0.35); color: var(--success); }
.ui-badge--warning { background: rgba(251, 191, 36, 0.12); border-color: rgba(251, 191, 36, 0.35); color: var(--warning); }
.ui-badge--danger { background: rgba(248, 113, 113, 0.12); border-color: rgba(248, 113, 113, 0.35); color: var(--danger); }
</style>
