<script setup vapor lang="ts">
import { UiLibrary } from '@/widgets/ui-library'
</script>

<template>
  <div class="page">
    <header class="page__header">
      <h2>UI library</h2>
      <p>Dark glass components from <code>@/shared/ui</code></p>
    </header>
    <UiLibrary />
  </div>
</template>

<style scoped>
.page__header { margin-bottom: var(--space-5); }
.page__header h2 { font-size: 22px; font-weight: 600; }
.page__header p { color: var(--text-muted); }
.page__header code { font-family: var(--font-mono); font-size: 13px; }
</style>
