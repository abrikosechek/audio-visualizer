import { computed, reactive } from 'vue'
import type { BarsMode, RenderSettings, VisualizerType } from '@/shared/api'
import { DEFAULT_COLORS } from '@/shared/lib'

export const SETTINGS_LIMITS = {
  bars: { min: 8, max: 256, step: 1 },
  grooves: { min: 6, max: 120, step: 1 },
  sensitivity: { min: 0.2, max: 3, step: 0.05 },
  smoothing: { min: 0, max: 1, step: 0.05 },
} as const

const DEFAULTS = {
  type: 'bars' as VisualizerType,
  mode: 'bottom' as BarsMode,
  bars: 64,
  /** vinyl has its own count, so switching types keeps each one */
  grooves: 48,
  sensitivity: 1,
  smoothing: 0.3,
  color: '#0b0b14',
  transparent: false,
  barColor: DEFAULT_COLORS[0]!,
  barColor2: DEFAULT_COLORS[1]!,
  gradient: true,
}

// App-wide editable settings. Hidden values (bg color while transparent, 2nd bar color while solid)
// are kept, so toggling back restores them.
const state = reactive({ ...DEFAULTS })

const renderSettings = computed<RenderSettings>(() => ({
  type: state.type,
  mode: state.mode,
  bars: state.type === 'vinyl' ? state.grooves : state.bars,
  sensitivity: state.sensitivity,
  smoothing: state.smoothing,
  background: state.transparent ? null : state.color,
  colors: state.gradient ? [state.barColor, state.barColor2] : [state.barColor],
}))

/** Resets the look; the chosen visualizer type is kept. */
function reset() {
  Object.assign(state, { ...DEFAULTS, type: state.type })
}

export function useVisualizerSettings() {
  return { settings: state, renderSettings, reset }
}
