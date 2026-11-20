<script setup vapor lang="ts">
import { computed } from 'vue'
import { useAudioImport } from '@/modules/audio-import'
import { useVideoExport } from '@/modules/video-export'
import { useVisualizerSettings } from '@/modules/visualizer-settings'
import { outputFormat, VIDEO_OUTPUT } from '@/shared/api'
import { formatTime } from '@/shared/lib'
import { UiBadge, UiButton, UiPanel, UiProgress, UiSpinner } from '@/shared/ui'

const { audio } = useAudioImport()
const { renderSettings } = useVisualizerSettings()
const { state, busy, progress, downloadUrl, start, cancel, dismiss } = useVideoExport()

const format = computed(() => outputFormat(renderSettings.value.background))

const statusText = computed(() => {
  switch (state.status) {
    case 'starting': return 'Starting local renderer…'
    case 'reading': return 'Reading audio…'
    case 'rendering': return state.cancelling ? 'Cancelling…' : `Rendering frames · ${state.fps} fps`
    case 'finalizing': return 'Finalizing video file…'
    default: return ''
  }
})

function exportVideo() {
  if (audio.value && !audio.value.demo) start(audio.value.id, audio.value.name, renderSettings.value)
}
</script>

<template>
  <UiPanel title="Export">
    <template #actions>
      <UiBadge v-if="busy" tone="accent">Running</UiBadge>
      <UiBadge v-else-if="state.status === 'done'" tone="success">Done</UiBadge>
      <UiBadge v-else-if="state.status === 'error'" tone="danger">Failed</UiBadge>
      <UiBadge v-else-if="state.status === 'cancelled'" tone="warning">Cancelled</UiBadge>
    </template>

    <dl class="specs">
      <div><dt>Resolution</dt><dd>{{ VIDEO_OUTPUT.width }}×{{ VIDEO_OUTPUT.height }}</dd></div>
      <div><dt>Frame rate</dt><dd>{{ VIDEO_OUTPUT.fps }} fps</dd></div>
      <div class="wide"><dt>Format</dt><dd>{{ format.label }} <span class="note">· {{ format.note }} · no sound</span></dd></div>
    </dl>

    <!-- Running job: progress + cancel. Settings stay editable; the job uses its own snapshot. -->
    <div v-if="busy" class="job">
      <div class="job__row">
        <span class="job__status"><UiSpinner :size="14" /> {{ statusText }}</span>
        <span class="mono">{{ Math.round(progress * 100) }}%</span>
      </div>
      <UiProgress :value="state.status === 'rendering' ? progress : undefined" />
      <div class="job__row muted">
        <span>{{ state.frame }} / {{ state.total || '…' }} frames</span>
        <span v-if="state.status === 'rendering' && state.eta">~{{ formatTime(state.eta) }} left</span>
      </div>
      <p class="muted small">{{ state.sourceName }} → {{ state.formatLabel }}. You can keep adjusting settings meanwhile.</p>
      <UiButton variant="danger" :disabled="state.cancelling" @click="cancel">Cancel</UiButton>
    </div>

    <div v-else-if="state.status === 'done'" class="job">
      <UiProgress :value="1" tone="success" />
      <p class="muted">Rendered in {{ formatTime(state.seconds) }}: <span class="file">{{ state.filename }}</span></p>
      <div class="actions">
        <UiButton variant="ghost" @click="dismiss">Close</UiButton>
        <UiButton variant="primary" :href="downloadUrl ?? undefined" :download="state.filename">Download video</UiButton>
      </div>
    </div>

    <div v-else class="job">
      <p v-if="state.status === 'error'" class="error" role="alert">{{ state.error }}</p>
      <p v-else-if="state.status === 'cancelled'" class="muted">Export cancelled.</p>
      <UiButton variant="primary" size="lg" :disabled="!audio || audio.demo" class="full" @click="exportVideo">
        Export video
      </UiButton>
      <p v-if="!audio" class="muted small center">Import a WAV file first</p>
      <p v-else-if="audio.demo" class="muted small center">The demo sound is preview only — import your WAV to export</p>
    </div>
  </UiPanel>
</template>

<style scoped>
.specs { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4); }
.specs .wide { grid-column: 1 / -1; }
.specs dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.specs dd { margin: 0; }
.note { color: var(--text-faint); font-size: 12px; }
.job { display: flex; flex-direction: column; gap: var(--space-3); }
.job__row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
.job__status { display: inline-flex; align-items: center; gap: var(--space-2); }
.mono { font-family: var(--font-mono); font-size: 12px; }
.muted { color: var(--text-muted); }
.small { font-size: 12px; }
.center { text-align: center; }
.file { color: var(--text); word-break: break-all; }
.error { color: var(--danger); word-break: break-word; }
.actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
.full { width: 100%; }
</style>
