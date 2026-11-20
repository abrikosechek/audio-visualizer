import { computed, reactive, readonly } from 'vue'
import {
  cancelRender,
  outputFormat,
  renderDownloadUrl,
  startRender,
  subscribeRender,
  type RenderSettings,
} from '@/shared/api'

export type ExportStatus = 'idle' | 'starting' | 'reading' | 'rendering' | 'finalizing' | 'done' | 'error' | 'cancelled'

const state = reactive({
  status: 'idle' as ExportStatus,
  jobId: null as string | null,
  frame: 0,
  total: 0,
  fps: 0,
  eta: 0,
  seconds: 0,
  filename: '',
  formatLabel: '',
  sourceName: '',
  error: null as string | null,
  cancelling: false,
})

let unsubscribe: (() => void) | undefined

const busy = computed(() => ['starting', 'reading', 'rendering', 'finalizing'].includes(state.status))
const progress = computed(() => (state.total ? state.frame / state.total : 0))
const downloadUrl = computed(() => (state.status === 'done' && state.jobId ? renderDownloadUrl(state.jobId) : null))

/** Starts a background render with a snapshot of the settings; the UI stays fully usable. */
async function start(audioId: string, sourceName: string, settings: RenderSettings) {
  if (busy.value) return
  unsubscribe?.()
  Object.assign(state, {
    status: 'starting',
    jobId: null,
    frame: 0,
    total: 0,
    fps: 0,
    eta: 0,
    seconds: 0,
    filename: '',
    formatLabel: outputFormat(settings.background).label,
    sourceName,
    error: null,
    cancelling: false,
  })
  try {
    const jobId = await startRender(audioId, { ...settings })
    state.jobId = jobId
    unsubscribe = subscribeRender(
      jobId,
      (ev) => {
        switch (ev.type) {
          case 'stage':
            state.status = ev.stage
            break
          case 'start':
            state.status = 'rendering'
            state.total = ev.totalFrames
            break
          case 'progress':
            state.status = 'rendering'
            Object.assign(state, { frame: ev.frame, total: ev.total, fps: ev.fps, eta: ev.eta })
            break
          case 'done':
            Object.assign(state, { status: 'done', filename: ev.filename, seconds: ev.seconds, frame: state.total })
            break
          case 'error':
            Object.assign(state, { status: 'error', error: ev.message })
            break
          case 'cancelled':
            state.status = 'cancelled'
            break
        }
      },
      () => Object.assign(state, { status: 'error', error: 'Lost connection to the local render server' }),
    )
  } catch (e) {
    Object.assign(state, { status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

async function cancel() {
  if (!state.jobId || !busy.value) return
  state.cancelling = true
  await cancelRender(state.jobId).catch(() => {})
}

function dismiss() {
  if (busy.value) return
  unsubscribe?.()
  state.status = 'idle'
}

export function useVideoExport() {
  return { state: readonly(state), busy, progress, downloadUrl, start, cancel, dismiss }
}
