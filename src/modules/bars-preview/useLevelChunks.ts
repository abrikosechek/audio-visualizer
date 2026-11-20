import { onScopeDispose, ref, watch, type WatchSource } from 'vue'
import { fetchLevelsChunk, VIDEO_OUTPUT } from '@/shared/api'

export interface LevelsParams {
  audioId: string
  bars: number
  sensitivity: number
  smoothing: number
  /** seconds; defines how many frames exist */
  duration: number
}

const FPS = VIDEO_OUTPUT.fps
const CHUNK_FRAMES = 150 // 5 s per request
const AHEAD = 2 // chunks prefetched past the playhead (10 s)
const MAX_PARALLEL = 2
const MAX_CHUNKS = 48 // ~4 min kept; farthest from the playhead evicted first
const PARAMS_DEBOUNCE_MS = 120

interface Store {
  key: string
  bars: number
  chunks: Map<number, Uint8Array>
}

/**
 * Streams bar levels around the playhead instead of analyzing the whole track:
 * only the chunk being viewed (+ a little ahead) is requested from the local analyzer.
 * Chunks are cached; on bars/sensitivity/smoothing change the old chunks keep displaying until fresh ones arrive.
 */
export function useLevelChunks(params: WatchSource<LevelsParams | null>) {
  /** Bumped whenever new data arrives (drives redraws). */
  const version = ref(0)
  /** True while the chunk under the playhead isn't loaded for the current settings. */
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalFrames = ref(0)

  let current: LevelsParams | null = null
  let store: Store | null = null
  let stale: Store | null = null // previous settings, shown until replaced
  const pending = new Map<number, AbortController>()
  let focus = 0
  let debounce: ReturnType<typeof setTimeout> | undefined

  const keyOf = (p: LevelsParams) => `${p.audioId}|${p.bars}|${p.sensitivity}|${p.smoothing}`

  function abortAll() {
    for (const c of pending.values()) c.abort()
    pending.clear()
  }

  function apply(p: LevelsParams | null) {
    abortAll()
    if (!p) {
      current = store = stale = null
      totalFrames.value = 0
      loading.value = false
      version.value++
      return
    }
    const sameAudio = current?.audioId === p.audioId
    current = p
    totalFrames.value = Math.max(1, Math.ceil(p.duration * FPS))
    // Same track, other settings: keep showing old bars meanwhile. Other track: drop everything.
    stale = sameAudio && store?.chunks.size ? store : sameAudio ? stale : null
    store = { key: keyOf(p), bars: p.bars, chunks: new Map() }
    error.value = null
    schedule()
  }

  /** Chunks wanted now, in priority order: under the playhead first, then ahead. */
  function wanted() {
    const last = Math.floor((totalFrames.value - 1) / CHUNK_FRAMES)
    const list: number[] = []
    for (let i = focus; i <= Math.min(last, focus + AHEAD); i++) list.push(i)
    return list
  }

  function schedule() {
    if (!store || !current) return
    const want = wanted()
    // Seeked far away: requests for chunks we no longer need are cancelled (server drops them if queued).
    for (const [idx, c] of pending) if (!want.includes(idx)) (c.abort(), pending.delete(idx))
    for (const idx of want) {
      if (pending.size >= MAX_PARALLEL) break
      if (!store.chunks.has(idx) && !pending.has(idx)) load(store, current, idx)
    }
    loading.value = !store.chunks.has(focus)
  }

  async function load(target: Store, p: LevelsParams, idx: number) {
    const ctrl = new AbortController()
    pending.set(idx, ctrl)
    try {
      const chunk = await fetchLevelsChunk(
        {
          audioId: p.audioId,
          bars: p.bars,
          sensitivity: p.sensitivity,
          smoothing: p.smoothing,
          start: idx * CHUNK_FRAMES,
          count: CHUNK_FRAMES,
        },
        ctrl.signal,
      )
      if (ctrl.signal.aborted || target !== store) return
      target.chunks.set(idx, chunk.data)
      evict(target)
      if (stale && target.chunks.size && wanted().every((i) => target.chunks.has(i))) stale = null
      version.value++
    } catch (e) {
      if (!ctrl.signal.aborted) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      if (pending.get(idx) === ctrl) pending.delete(idx)
      if (!ctrl.signal.aborted) schedule()
    }
  }

  function evict(s: Store) {
    if (s.chunks.size <= MAX_CHUNKS) return
    const far = [...s.chunks.keys()].sort((a, b) => Math.abs(b - focus) - Math.abs(a - focus))
    for (const idx of far.slice(0, s.chunks.size - MAX_CHUNKS)) s.chunks.delete(idx)
  }

  /** Tell the cache where the viewer is; loads that zone if needed. */
  function setPlayhead(time: number) {
    const idx = Math.floor(Math.max(0, Math.floor(time * FPS)) / CHUNK_FRAMES)
    if (idx === focus && (!store || store.chunks.has(idx) || pending.has(idx))) return
    focus = idx
    schedule()
  }

  /** Levels of the frame shown at `time` (current settings, else previous ones), or null if not loaded yet. */
  function frameAt(time: number): Uint8Array | null {
    if (!totalFrames.value) return null
    const frame = Math.min(totalFrames.value - 1, Math.max(0, Math.floor(time * FPS)))
    const idx = Math.floor(frame / CHUNK_FRAMES)
    for (const s of [store, stale]) {
      const data = s?.chunks.get(idx)
      if (s && data) {
        const at = (frame - idx * CHUNK_FRAMES) * s.bars
        if (at + s.bars <= data.length) return data.subarray(at, at + s.bars)
      }
    }
    return null
  }

  watch(
    params,
    (p) => {
      clearTimeout(debounce)
      const audioChanged = p?.audioId !== current?.audioId
      if (audioChanged || !p) return apply(p)
      if (keyOf(p) === store?.key) return
      loading.value = true // indicator right away, request after the slider settles
      debounce = setTimeout(() => apply(p), PARAMS_DEBOUNCE_MS)
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(() => {
    clearTimeout(debounce)
    abortAll()
  })

  /** Frame index (for skipping redraws when nothing changed). */
  const frameIndex = (time: number) => Math.floor(time * FPS)

  return { version, loading, error, totalFrames, setPlayhead, frameAt, frameIndex }
}
