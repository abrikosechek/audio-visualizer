<script setup vapor lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'glass' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    /** Renders a link styled as a button (extra attrs like `download` pass through). */
    href?: string
  }>(),
  { variant: 'glass', size: 'md', disabled: false },
)
</script>

<template>
  <a v-if="href" class="ui-button" :class="[`ui-button--${variant}`, `ui-button--${size}`]" :href="href">
    <slot />
  </a>
  <button v-else class="ui-button" :class="[`ui-button--${variant}`, `ui-button--${size}`]" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  font-weight: 500;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background var(--duration) var(--ease),
    border-color var(--duration) var(--ease),
    transform var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease);
}
.ui-button:active:not(:disabled) { transform: scale(0.97); }
.ui-button:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ui-button:disabled { opacity: 0.4; cursor: not-allowed; }

.ui-button--sm { height: 28px; padding: 0 var(--space-3); font-size: 12px; }
.ui-button--md { height: 36px; padding: 0 var(--space-4); }
.ui-button--lg { height: 44px; padding: 0 var(--space-5); font-size: 15px; }

.ui-button--glass {
  background: var(--glass-bg);
  box-shadow: var(--glass-highlight);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}
.ui-button--glass:hover:not(:disabled) { background: var(--glass-bg-hover); border-color: var(--glass-border-strong); }

.ui-button--primary {
  background: var(--accent-gradient);
  border-color: transparent;
  color: #0b0b14;
  box-shadow: 0 4px 20px rgba(139, 123, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.ui-button--primary:hover:not(:disabled) {
  box-shadow: 0 6px 28px rgba(139, 123, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.ui-button--ghost { background: transparent; border-color: transparent; }
.ui-button--ghost:hover:not(:disabled) { background: var(--glass-bg); }

.ui-button--danger {
  background: rgba(248, 113, 113, 0.14);
  border-color: rgba(248, 113, 113, 0.35);
  color: var(--danger);
}
.ui-button--danger:hover:not(:disabled) { background: rgba(248, 113, 113, 0.24); }
</style>
