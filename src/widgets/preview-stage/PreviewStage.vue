<script setup vapor lang="ts">
import { computed, onMounted, onScopeDispose, ref, useTemplateRef, watch } from 'vue'
import { useAudioImport } from '@/modules/audio-import'
import { drawBars, drawVinyl, useLevelChunks } from '@/modules/bars-preview'
import { useVisualizerSettings } from '@/modules/visualizer-settings'
import { formatTime } from '@/shared/lib'
import { UiButton, UiPanel, UiSlider, UiSpinner } from '@/shared/ui'

const { audio, url } = useAudioImport()
const { settings, renderSettings } = useVisualizerSettings()

// Levels depend only on audio + bars + sensitivity + smoothing, and are streamed in chunks around the playhead.
// Mode / colors / background are applied while drawing, so they change instantly.
const params = computed(() =>
  audio.value
    ? {
        audioId: audio.value.id,
        bars: renderSettings.value.bars, // bars count, or grooves count for vinyl
        sensitivity: settings.sensitivity,
        smoothing: settings.smoothing,
        duration: audio.value.duration,
      }
    : null,
)
const { version, loading, error, setPlayhead, frameAt, frameIndex } = useLevelChunks(params)

const player = useTemplateRef<HTMLAudioElement>('player')
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const playing = ref(false)
const time = ref(0)
const volume = ref(0.8)
const playError = ref<string | null>(null)
const hasFrame = ref(false)

const duration = computed(() => audio.value?.duration ?? 0)

watch(url, () => {
  playing.value = false
  time.value = 0
})
watch(volume, (v) => player.value && (player.value.volume = v))
watch(playing, (p) => p && startLoop())
watch(time, (t) => {
  setPlayhead(t)
  if (!playing.value) invalidate() // while playing, the loop already repaints on frame change
})
watch([version, renderSettings, () => audio.value?.id], invalidate)

async function toggle() {
  const el = player.value
  if (!el || !url.value) return
  playError.value = null
  if (el.paused) {
    if (el.ended || time.value >= duration.value - 0.05) el.currentTime = 0
    await el.play().catch((e: unknown) => (playError.value = e instanceof Error ? e.message : String(e)))
  } else {
    el.pause()
  }
}

function seek(v: number) {
  time.value = v
  if (player.value) player.value.currentTime = v
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (e.code !== 'Space' || !audio.value || t.closest('input, select, textarea, button, [role="button"]')) return
  e.preventDefault()
  toggle()
}

// ── Drawing, on demand ─────────────────────────────────────────────────────────────────────────
// • Paused: nothing runs; a draw is scheduled only when time/settings/data change.
// • Playing: a rAF loop follows the audio clock but repaints only when the 30 fps frame changes.
// • Offscreen (scrolled away / tab hidden): no painting at all.
// • Canvas backing size follows its on-screen size × devicePixelRatio (no oversized buffers).
let raf = 0
let dirty = true
let lastKey = ''
let visible = true

function invalidate() {
  dirty = true
  if (!raf) raf = requestAnimationFrame(tick)
}

function startLoop() {
  if (!raf) raf = requestAnimationFrame(tick)
}

function tick() {
  raf = 0
  const el = player.value
  if (el && !el.paused) {
    // Only touch reactive time when the shown frame changes (30 Hz, not every display refresh).
    if (frameIndex(el.currentTime) !== frameIndex(time.value)) time.value = el.currentTime
    raf = requestAnimationFrame(tick)
  }
  if (visible) paint()
}

function paint() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  const levels = audio.value ? frameAt(time.value) : null
  const key = `${frameIndex(time.value)}|${levels ? 1 : 0}`
  if (!dirty && key === lastKey) return
  dirty = false
  lastKey = key
  hasFrame.value = !!levels
  const s = renderSettings.value
  if (s.type === 'vinyl') drawVinyl(ctx, levels, frameIndex(time.value), s)
  else drawBars(ctx, levels, s)
}

let resizeObs: ResizeObserver | undefined
let visObs: IntersectionObserver | undefined

onMounted(() => {
  const el = canvas.value!
  resizeObs = new ResizeObserver(([entry]) => {
    const w = Math.min(2560, Math.round(entry!.contentRect.width * devicePixelRatio))
    const h = Math.round((w * 9) / 16)
    if (w > 0 && (el.width !== w || el.height !== h)) {
      el.width = w
      el.height = h
      invalidate()
    }
  })
  resizeObs.observe(el)
  visObs = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting
    if (visible) invalidate()
  })
  visObs.observe(el)
  window.addEventListener('keydown', onKey)
  invalidate()
})
onScopeDispose(() => {
  cancelAnimationFrame(raf)
  resizeObs?.disconnect()
  visObs?.disconnect()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <UiPanel class="preview" title="Preview">
    <template #actions>
      <span class="state">
        <template v-if="loading && audio"><UiSpinner :size="14" /> {{ hasFrame ? 'Updating bars…' : 'Loading bars…' }}</template>
        <template v-else-if="audio">{{ playing ? 'Playing' : 'Paused' }} · 30 fps, as exported</template>
      </span>
    </template>

    <div class="stage" :class="{ 'is-transparent': renderSettings.background === null }">
      <canvas ref="canvas" class="canvas" />
      <div v-if="!audio" class="overlay">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M9 20V4M14 20v-7M19 20V8" /></svg>
        <p>Import a WAV file to preview</p>
      </div>
      <div v-else-if="!hasFrame && loading" class="overlay"><UiSpinner :size="28" /><p>Loading bars…</p></div>
      <p v-if="error || playError" class="error" role="alert">{{ error || playError }}</p>
    </div>

    <div class="transport" :class="{ 'is-disabled': !audio }">
      <UiButton
        variant="primary"
        class="play"
        :disabled="!audio"
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="toggle"
      >
        <svg v-if="playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>
      </UiButton>
      <span class="mono">{{ formatTime(time) }}</span>
      <UiSlider
        :model-value="time"
        :min="0"
        :max="duration || 1"
        :step="0.01"
        :disabled="!audio"
        aria-label="Seek"
        @update:model-value="seek"
      />
      <span class="mono">{{ formatTime(duration) }}</span>
      <div class="volume" title="Volume">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7" /></svg>
        <UiSlider v-model="volume" :min="0" :max="1" :step="0.01" aria-label="Volume" />
      </div>
    </div>
    <p class="hint">Space — play / pause</p>

    <audio
      ref="player"
      :src="url ?? undefined"
      preload="auto"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
      @loadedmetadata="player && (player.volume = volume)"
    />
  </UiPanel>
</template>

<style scoped>
.state { display: inline-flex; align-items: center; gap: var(--space-2); font-size: 12px; color: var(--text-muted); min-height: 22px; }
.stage {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid var(--glass-border);
}
.stage.is-transparent {
  background: repeating-conic-gradient(rgba(255, 255, 255, 0.07) 0 25%, transparent 0 50%) 0 0 / 24px 24px, rgba(0, 0, 0, 0.35);
}
.canvas { display: block; width: 100%; height: 100%; }
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  color: var(--text-faint);
  background: rgba(7, 8, 13, 0.4);
}
.overlay svg { width: 40px; height: 40px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.error {
  position: absolute;
  left: var(--space-3);
  right: var(--space-3);
  bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: rgba(248, 113, 113, 0.15);
  color: var(--danger);
  backdrop-filter: var(--glass-blur);
}
.transport { display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); }
.transport.is-disabled .mono { opacity: 0.5; }
.play { width: 40px; height: 40px; padding: 0; border-radius: 50%; flex: none; }
.play svg { width: 18px; height: 18px; fill: currentColor; }
.mono { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); min-width: 36px; text-align: center; }
.volume { display: flex; align-items: center; gap: var(--space-2); width: 120px; flex: none; }
.volume svg { width: 18px; height: 18px; flex: none; fill: none; stroke: var(--text-muted); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.hint { margin-top: var(--space-2); font-size: 11px; color: var(--text-faint); text-align: right; }

@media (max-width: 600px) {
  .volume { display: none; }
}
</style>
