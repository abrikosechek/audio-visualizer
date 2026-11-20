import { VIDEO_OUTPUT } from '@/shared/api'
import { createVinylRenderer } from '@/shared/lib'

export interface VinylDrawOptions {
  background: string | null
  colors: string[]
}

let cache: { key: string; renderer: ReturnType<typeof createVinylRenderer>; image: ImageData } | undefined

/**
 * Draws the vinyl frame with the export's own per-pixel renderer (into an ImageData, then one putImageData).
 * `frame` drives the spin, so the preview turns exactly like the video.
 */
export function drawVinyl(ctx: CanvasRenderingContext2D, levels: Uint8Array | null, frame: number, o: VinylDrawOptions) {
  const { width, height } = ctx.canvas
  const grooves = levels?.length ?? 0
  if (!levels || !grooves) {
    ctx.clearRect(0, 0, width, height)
    if (o.background) {
      ctx.fillStyle = o.background
      ctx.fillRect(0, 0, width, height)
    }
    return
  }
  const key = `${width}x${height}|${grooves}|${o.colors.join()}|${o.background}`
  if (cache?.key !== key) {
    cache = {
      key,
      renderer: createVinylRenderer({ width, height, grooves, fps: VIDEO_OUTPUT.fps, colors: o.colors, background: o.background }),
      image: ctx.createImageData(width, height),
    }
  }
  cache.renderer.draw(cache.image.data, levels, frame, 1 / 255)
  ctx.putImageData(cache.image, 0, 0)
}
