// Rasterizes bar levels into an RGBA frame buffer using the shared layout.
// No canvas dependency: plain Buffer fills/copies, one pre-colored row per bar.

import { createBarsLayout, hexToRgb } from './layout.mjs'
import { createVinylRenderer } from './vinyl.mjs'

/**
 * Frame drawer for the chosen visualizer type. `draw(frame, levels, frameIndex)`.
 * @param {{ type?: 'bars' | 'vinyl', width: number, height: number, bars: number, fps: number,
 *   mode: 'bottom' | 'center', background: string | null, colors?: string[] }} opts
 */
export function createDrawer(opts) {
  if (opts.type === 'vinyl') {
    const { width, height, bars, fps, background, colors } = opts
    const vinyl = createVinylRenderer({ width, height, grooves: bars, fps, background, colors })
    return { draw: (frame, levels, f) => vinyl.draw(frame, levels, f), frameSize: width * height * 4 }
  }
  return createBarsDrawer(opts)
}

/**
 * @param {{ width: number, height: number, bars: number, mode: 'bottom' | 'center',
 *   background: string | null, colors?: string[] }} opts background: '#rrggbb' or null (transparent)
 */
function createBarsDrawer({ width, height, bars, mode, background, colors }) {
  const layout = createBarsLayout({ width, height, bars, mode, colors })
  const stride = width * 4
  const bgPixel = Buffer.from(background ? [...hexToRgb(background), 255] : [0, 0, 0, 0])
  const { barWidth, radius } = layout

  const rows = layout.bars.map(({ rgb }) => {
    const row = Buffer.alloc(barWidth * 4)
    for (let x = 0; x < barWidth; x++) row.set([rgb[0], rgb[1], rgb[2], 255], x * 4)
    return row
  })

  // Corner inset per row from the rounded end (0 = full width).
  const inset = new Int32Array(radius)
  for (let r = 0; r < radius; r++) {
    const dy = radius - r - 0.5
    inset[r] = Math.round(radius - Math.sqrt(Math.max(0, radius * radius - dy * dy)))
  }

  /** @param {Buffer} frame width*height*4 bytes @param {ArrayLike<number>} levels in [0, 1] */
  function draw(frame, levels) {
    frame.fill(bgPixel)
    for (let b = 0; b < bars; b++) {
      const { top, bottom, height: h } = layout.span(levels[b])
      const rounded = Math.min(radius, Math.floor(h / (mode === 'center' ? 2 : 1)))
      const row = rows[b]
      const xStart = layout.bars[b].x * 4
      for (let y = top; y < bottom; y++) {
        let e = y - top // distance into the rounded end(s)
        if (mode === 'center') e = Math.min(e, bottom - 1 - y)
        const cut = e < rounded ? inset[e + (radius - rounded)] : 0
        row.copy(frame, y * stride + xStart + cut * 4, cut * 4, row.length - cut * 4)
      }
    }
  }

  return { draw, frameSize: stride * height }
}
