// Client for the local visualizer bridge (server/visualizer-api.ts → scripts/visualizer/render.mjs).

export type BarsMode = 'bottom' | 'center'
export type VisualizerType = 'bars' | 'vinyl'

export interface RenderSettings {
  type: VisualizerType
  /** bars only */
  mode: BarsMode
  /** bars count, or grooves count for vinyl */
  bars: number
  sensitivity: number
  /** 0–1: calms bar jitter with a centered (zero-delay) average over neighbouring frames */
  smoothing: number
  /** '#rrggbb', or null for a transparent background */
  background: string | null
  /** Bar colors: one = solid, two = left → right gradient */
  colors: string[]
}

/** A chunk of per-frame bar levels from the local analyzer: data[(frame - start) * bars + bar], 0–255. */
export interface LevelsChunk {
  start: number
  frames: number
  totalFrames: number
  bars: number
  fps: number
  data: Uint8Array
}

export interface AudioInfo {
  id: string
  name: string
  duration: number
  sampleRate: number
  channels: number
  bitsPerSample: number
  float: boolean
  /** Built-in demo loop: preview only, cannot be exported */
  demo?: boolean
}

export type RenderEvent =
  | { type: 'stage'; stage: 'reading' | 'finalizing' }
  | { type: 'start'; totalFrames: number; duration: number; width: number; height: number; fps: number }
  | { type: 'progress'; frame: number; total: number; fps: number; eta: number }
  | { type: 'done'; filename: string; seconds: number }
  | { type: 'error'; message: string }
  | { type: 'cancelled' }

export const VIDEO_OUTPUT = { width: 2560, height: 1440, fps: 30 } as const

/** Output container/codec chosen from the background: alpha needs ProRes 4444. */
export function outputFormat(background: string | null) {
  return background === null
    ? { ext: 'mov', label: 'MOV · ProRes 4444', note: 'with alpha channel, large files' }
    : { ext: 'mp4', label: 'MP4 · H.264', note: 'plays everywhere' }
}

/** Uploads a WAV with progress (XHR, since fetch has no upload progress). */
export function uploadAudio(file: File, onProgress: (ratio: number) => void): Promise<AudioInfo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/audio')
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      const data = safeJson(xhr.responseText)
      if (xhr.status === 200) resolve(data as AudioInfo)
      else reject(new Error(data?.error ?? `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed: local server not reachable'))
    xhr.send(file)
  })
}

/** Built-in demo loop (synthesized by the local script): info + the WAV as a Blob for playback. */
export async function fetchDemo(): Promise<{ info: AudioInfo; blob: Blob }> {
  const [infoRes, audioRes] = await Promise.all([fetch('/api/demo'), fetch('/api/demo/audio')])
  if (!infoRes.ok || !audioRes.ok) throw new Error('Demo sound unavailable: local server not reachable')
  return { info: (await infoRes.json()) as AudioInfo, blob: await audioRes.blob() }
}

/** Analyzes frames [start, start + count) with the local analyzer (identical to the export's analysis). */
export async function fetchLevelsChunk(
  params: { audioId: string; bars: number; sensitivity: number; smoothing: number; start: number; count: number },
  signal: AbortSignal,
): Promise<LevelsChunk> {
  const res = await fetch('/api/levels', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Analysis failed')
  const h = (name: string) => Number(res.headers.get(name))
  return {
    start: h('x-start'),
    frames: h('x-frames'),
    totalFrames: h('x-total-frames'),
    bars: h('x-bars'),
    fps: h('x-fps'),
    data: new Uint8Array(await res.arrayBuffer()),
  }
}

export async function startRender(audioId: string, settings: RenderSettings): Promise<string> {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ audioId, settings }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? 'Could not start render')
  return data.jobId as string
}

/** Subscribes to render events. Returns an unsubscribe function. */
export function subscribeRender(jobId: string, onEvent: (ev: RenderEvent) => void, onLost: () => void) {
  const es = new EventSource(`/api/render/${jobId}/events`)
  let finished = false
  es.onmessage = (m) => {
    const ev = JSON.parse(m.data) as RenderEvent
    if (ev.type === 'done' || ev.type === 'error' || ev.type === 'cancelled') {
      finished = true
      es.close()
    }
    onEvent(ev)
  }
  es.onerror = () => {
    if (finished) return
    es.close()
    onLost()
  }
  return () => es.close()
}

export function cancelRender(jobId: string) {
  return fetch(`/api/render/${jobId}/cancel`, { method: 'POST' })
}

export function renderDownloadUrl(jobId: string) {
  return `/api/render/${jobId}/download`
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
