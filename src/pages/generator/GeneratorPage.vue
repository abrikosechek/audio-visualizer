<script setup vapor lang="ts">
import { AudioSource } from '@/widgets/audio-source'
import { ExportPanel } from '@/widgets/export-panel'
import { PreviewStage } from '@/widgets/preview-stage'
import { VisualizerControls } from '@/widgets/visualizer-controls'
</script>

<template>
  <div class="generator">
    <div class="generator__main">
      <PreviewStage />
    </div>
    <aside class="generator__side">
      <AudioSource />
      <VisualizerControls />
      <ExportPanel />
    </aside>
  </div>
</template>

<style scoped>
.generator {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-4);
  align-items: start;
}
.generator__main { position: sticky; top: var(--space-4); }
.generator__side { display: flex; flex-direction: column; gap: var(--space-4); }

@media (max-width: 960px) {
  .generator { grid-template-columns: 1fr; }
  .generator__main { position: static; }
}
</style>
