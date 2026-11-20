<script setup vapor lang="ts">
import { useAudioImport } from '@/modules/audio-import'
import { formatTime } from '@/shared/lib'
import { onMounted } from 'vue'
import { UiBadge, UiButton, UiFileDrop, UiPanel, UiProgress, UiSpinner } from '@/shared/ui'

const { audio, uploading, progress, pendingName, error, loadingDemo, importFile, loadDemo } = useAudioImport()

// Page open with nothing loaded → the built-in demo loop, so there's something to preview right away.
onMounted(() => {
  if (!audio.value && !uploading.value) loadDemo()
})
</script>

<template>
  <UiPanel title="Audio">
    <template #actions>
      <UiBadge v-if="uploading" tone="accent">Importing…</UiBadge>
      <UiBadge v-else-if="audio?.demo" tone="warning">Demo · preview only</UiBadge>
      <UiBadge v-else-if="audio" tone="success">Ready</UiBadge>
    </template>

    <UiFileDrop accept=".wav,audio/wav" @select="importFile">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
      <strong>{{ audio && !audio.demo ? 'Replace WAV file' : 'Import your WAV file' }}</strong>
      <span class="hint">Drop here or click to browse</span>
    </UiFileDrop>

    <p v-if="loadingDemo" class="status status--inline"><UiSpinner :size="14" /> Generating demo sound…</p>

    <div v-if="uploading" class="status">
      <div class="status__row">
        <span class="name">{{ pendingName }}</span>
        <span class="mono">{{ Math.round(progress * 100) }}%</span>
      </div>
      <!-- After upload completes, the script reads the header: unknown duration → indeterminate. -->
      <UiProgress :value="progress < 1 ? progress : undefined" />
      <span class="hint">{{ progress < 1 ? 'Uploading to local renderer…' : 'Reading audio…' }}</span>
    </div>

    <dl v-if="audio" class="meta">
      <div class="meta__name">
        <dt>File</dt>
        <dd :title="audio.name">{{ audio.name }}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{{ formatTime(audio.duration) }}</dd>
      </div>
      <div>
        <dt>Format</dt>
        <dd>
          {{ (audio.sampleRate / 1000).toFixed(1) }} kHz · {{ audio.bitsPerSample }}-bit{{ audio.float ? ' float' : '' }} ·
          {{ audio.channels === 1 ? 'mono' : audio.channels === 2 ? 'stereo' : `${audio.channels} ch` }}
        </dd>
      </div>
    </dl>

    <p v-if="audio?.demo" class="hint demo-note">
      A generated 15 s loop to try things out. Import your own WAV to export a video.
    </p>
    <UiButton v-else-if="audio && !uploading" size="sm" variant="ghost" class="demo-btn" :disabled="loadingDemo" @click="loadDemo">
      Back to demo sound
    </UiButton>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </UiPanel>
</template>

<style scoped>
.icon { width: 28px; height: 28px; fill: none; stroke: var(--accent-2); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.hint { color: var(--text-faint); font-size: 12px; }
.status { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-4); }
.status--inline { flex-direction: row; align-items: center; color: var(--text-muted); font-size: 13px; }
.demo-note { display: block; margin-top: var(--space-3); }
.demo-btn { margin-top: var(--space-3); }
.status__row { display: flex; justify-content: space-between; gap: var(--space-3); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mono { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-4); }
.meta__name { grid-column: 1 / -1; }
.meta dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
.meta dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.error { margin-top: var(--space-3); color: var(--danger); }
</style>
