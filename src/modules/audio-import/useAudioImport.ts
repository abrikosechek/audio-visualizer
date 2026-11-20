import { readonly, ref, shallowRef } from 'vue'
import { fetchDemo, uploadAudio, type AudioInfo } from '@/shared/api'

// App-wide state: one imported audio at a time.
const audio = shallowRef<AudioInfo | null>(null)
/** Local object URL of the imported file, for playback on the page (no re-download). */
const url = ref<string | null>(null)
const uploading = ref(false)
const progress = ref(0)
const pendingName = ref('')
const error = ref<string | null>(null)
const loadingDemo = ref(false)

function setAudio(info: AudioInfo, blob: Blob) {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = URL.createObjectURL(blob)
  audio.value = info
}

/** Loads the built-in demo loop (preview only). Called on page open when nothing is loaded. */
async function loadDemo() {
  if (loadingDemo.value) return
  loadingDemo.value = true
  error.value = null
  try {
    const { info, blob } = await fetchDemo()
    if (!uploading.value) setAudio(info, blob) // a user import in the meantime wins
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingDemo.value = false
  }
}

async function importFile(file: File) {
  error.value = null
  if (!/\.wav$/i.test(file.name)) {
    error.value = `"${file.name}" is not a .wav file`
    return
  }
  uploading.value = true
  progress.value = 0
  pendingName.value = file.name
  try {
    // Previous audio stays usable until the new one is ready.
    setAudio(await uploadAudio(file, (r) => (progress.value = r)), file)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploading.value = false
  }
}

export function useAudioImport() {
  return {
    audio: readonly(audio),
    url: readonly(url),
    uploading: readonly(uploading),
    progress: readonly(progress),
    pendingName: readonly(pendingName),
    error: readonly(error),
    loadingDemo: readonly(loadingDemo),
    importFile,
    loadDemo,
  }
}
