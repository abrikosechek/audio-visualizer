import type { BarsMode } from '@/shared/api'
import { createBarsLayout, type BarsLayout } from '@/shared/lib'

export interface DrawOptions {
  mode: BarsMode
  background: string | null
  colors: string[]
}

let cache: { key: string; layout: BarsLayout } | undefined

/**
 * Draws one video frame. `levels` = bar values 0–255 for that frame (from the local analyzer);
 * geometry/colors come from the same layout code the export uses.
 */
export function drawBars(ctx: CanvasRenderingContext2D, levels: Uint8Array | null, o: DrawOptions) {
  const { width, height } = ctx.canvas
  if (o.background) {
    ctx.fillStyle = o.background
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.clearRect(0, 0, width, height)
  }
  if (!levels?.length) return

  const bars = levels.length
  const key = `${width}x${height}|${bars}|${o.mode}|${o.colors.join()}`
  if (cache?.key !== key) {
    cache = { key, layout: createBarsLayout({ width, height, bars, mode: o.mode, colors: o.colors }) }
  }
  const layout = cache.layout
  const solid = o.colors.length < 2 || o.colors[0] === o.colors[1]

  // Solid color: all bars in one path → a single fill call.
  if (solid) {
    ctx.fillStyle = layout.bars[0]!.css
    ctx.beginPath()
  }
  for (let b = 0; b < bars; b++) {
    const bar = layout.bars[b]!
    const { top, height: h } = layout.span(levels[b]! / 255)
    const r = Math.min(layout.radius, o.mode === 'center' ? h / 2 : h)
    if (!solid) {
      ctx.fillStyle = bar.css
      ctx.beginPath()
    }
    ctx.roundRect(bar.x, top, layout.barWidth, h, o.mode === 'center' ? r : [r, r, 0, 0])
    if (!solid) ctx.fill()
  }
  if (solid) ctx.fill()
}
