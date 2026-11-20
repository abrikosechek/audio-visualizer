<script setup vapor lang="ts">
import { onScopeDispose, ref } from 'vue'
import { GeneratorPage } from '@/pages/generator'
import { UiLibraryPage } from '@/pages/ui-library'

// Minimal hash routing: #/ → generator, #/ui → UI library.
const route = ref(location.hash)
const onHash = () => (route.value = location.hash)
window.addEventListener('hashchange', onHash)
onScopeDispose(() => window.removeEventListener('hashchange', onHash))
</script>

<template>
  <div class="shell">
    <header class="topbar glass">
      <a href="#/" class="brand">
        <span class="brand__logo" aria-hidden="true"><i /><i /><i /><i /></span>
        Audio Visualizer
      </a>
      <nav class="nav">
        <a href="#/" :class="{ 'is-active': route !== '#/ui' }">Generator</a>
        <a href="#/ui" :class="{ 'is-active': route === '#/ui' }">UI library</a>
      </nav>
    </header>
    <main>
      <UiLibraryPage v-if="route === '#/ui'" />
      <GeneratorPage v-else />
    </main>
  </div>
</template>

<style scoped>
.shell { max-width: 1400px; margin: 0 auto; padding: var(--space-4); }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  height: 56px;
  padding: 0 var(--space-4);
  margin-bottom: var(--space-4);
  border-radius: var(--radius-lg);
}
.brand { display: inline-flex; align-items: center; gap: var(--space-3); font-weight: 600; font-size: 15px; color: var(--text); text-decoration: none; }
.brand__logo { display: inline-flex; align-items: flex-end; gap: 2px; height: 18px; }
.brand__logo i { width: 4px; border-radius: 2px; background: var(--accent-gradient); }
.brand__logo i:nth-child(1) { height: 50%; }
.brand__logo i:nth-child(2) { height: 100%; }
.brand__logo i:nth-child(3) { height: 70%; }
.brand__logo i:nth-child(4) { height: 35%; }
.nav { display: flex; gap: var(--space-1); }
.nav a {
  padding: 6px var(--space-3);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  text-decoration: none;
  transition: background var(--duration) var(--ease), color var(--duration) var(--ease);
}
.nav a:hover { color: var(--text); background: var(--glass-bg); }
.nav a.is-active { color: var(--text); background: var(--glass-bg-hover); }
</style>
