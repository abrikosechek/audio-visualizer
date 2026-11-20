// Bar geometry + colors. Pure (no Node APIs): shared by the render script and the page's live preview,
// so the preview is drawn exactly like the exported video.

export const DEFAULT_COLORS = ['#8b7bff', '#3dd6ff']

const MARGIN_X = 0.04 // of width, each side
const MARGIN_Y = 0.06 // of height: top (bottom mode) or top and bottom (center mode)
const GAP = 0.3 // fraction of a slot left empty between bars
const MIN_BAR = 0.004 // of height, so silent bars stay visible
const RADIUS = 0.006 // of height

/**
 * @param {{ width: number, height: number, bars: number, mode: 'bottom' | 'center',
 *   colors?: string[] }} opts colors: one color (solid) or two (left → right gradient)
 */
export function createBarsLayout({ width, height, bars, mode, colors = DEFAULT_COLORS }) {
  const from = hexToRgb(colors[0] ?? DEFAULT_COLORS[0])
  const to = hexToRgb(colors[1] ?? colors[0] ?? DEFAULT_COLORS[1])

  const usable = width * (1 - 2 * MARGIN_X)
  const slot = usable / bars
  const barWidth = Math.max(1, Math.round(slot * (1 - GAP)))
  const x0 = width * MARGIN_X + (slot - barWidth) / 2
  const radius = Math.min(Math.floor(barWidth / 2), Math.round(height * RADIUS))
  const maxH = mode === 'center' ? height * (1 - 2 * MARGIN_Y) : height * (1 - MARGIN_Y)
  const minH = Math.max(2, Math.round(height * MIN_BAR))

  const items = []
  for (let b = 0; b < bars; b++) {
    const t = bars === 1 ? 0 : b / (bars - 1)
    const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * t))
    items.push({ x: Math.round(x0 + b * slot), rgb, css: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` })
  }

  /** Vertical extent of a bar for a level in [0, 1]. */
  function span(level) {
    let h = Math.round(minH + (maxH - minH) * level)
    if (mode === 'center') {
      h -= h & 1 // keep symmetric
      const top = Math.round(height / 2 - h / 2)
      return { top, bottom: top + h, height: h }
    }
    return { top: height - h, bottom: height, height: h }
  }

  return { width, height, mode, barWidth, radius, bars: items, span }
}

/** @param {string} hex */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Invalid color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
