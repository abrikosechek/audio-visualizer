// Vinyl visualizer: a spinning record whose grooves react to sound.
// Pure per-pixel renderer (no Node / DOM APIs) shared by the export script and the page preview,
// so both draw exactly the same picture. Writes RGBA into any byte array (Buffer / ImageData.data).
//
// • One groove per band; bass is the outermost groove.
// • A groove's level makes it light up (dim grey → band color), thicken and shake (radial wobble).
// • The label in the center carries a wedge so the 33⅓ rpm spin is visible.

import { DEFAULT_COLORS, hexToRgb } from './layout.mjs'

export const VINYL_RPM = 100 / 3

const ANG = 2048 // angle resolution of lookup tables
const DISK = 0.46 // disk radius, of height
const LABEL = 0.34 // label radius, of disk radius
const GROOVES_IN = 0.38 // groove area, of disk radius
const GROOVES_OUT = 0.965
const HOLE = 0.022 // spindle hole, of disk radius
const SHAKE = 0.9 // max wobble, in groove spacings (≤ 1 keeps lookups to 3 neighbours)
const SHAKE_MAX = 0.028 // …and never more than this share of the disk radius, so few grooves stay record-like
//                         (outermost groove + max wobble stays inside the disk edge)
const DIM = [58, 58, 72] // resting groove color
const DISK_RGB = [16, 16, 20]

/**
 * @param {{ width: number, height: number, grooves: number, fps: number,
 *   colors?: string[], background: string | null }} opts
 */
export function createVinylRenderer({ width, height, grooves, fps, colors = DEFAULT_COLORS, background }) {
  const cA = hexToRgb(colors[0] ?? DEFAULT_COLORS[0])
  const cB = hexToRgb(colors[1] ?? colors[0] ?? DEFAULT_COLORS[1])
  const bg = background ? hexToRgb(background) : null

  const cx = width / 2
  const cy = height / 2
  const R = height * DISK
  const labelR = R * LABEL
  const holeR = R * HOLE
  const inR = R * GROOVES_IN
  const outR = R * GROOVES_OUT
  const spacing = (outR - inR) / grooves
  const shakeAmp = Math.min(SHAKE * spacing, SHAKE_MAX * R)

  // Disk bounding box and per-pixel polar coordinates (computed once per size).
  const x0 = Math.max(0, Math.floor(cx - R - 2))
  const x1 = Math.min(width, Math.ceil(cx + R + 2))
  const y0 = Math.max(0, Math.floor(cy - R - 2))
  const y1 = Math.min(height, Math.ceil(cy + R + 2))
  const bw = x1 - x0
  const bh = y1 - y0
  const rMap = new Float32Array(bw * bh)
  const aMap = new Uint16Array(bw * bh)
  const shade = new Uint8Array(bw * bh) // static light reflection (doesn't rotate)
  const gMap = new Int16Array(bw * bh) // nearest groove index, or -9 outside the groove area
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const dx = x0 + x + 0.5 - cx
      const dy = y0 + y + 0.5 - cy
      const i = y * bw + x
      const a = Math.atan2(dy, dx)
      rMap[i] = Math.hypot(dx, dy)
      aMap[i] = ((Math.round((a / (2 * Math.PI)) * ANG) % ANG) + ANG) % ANG
      // Two soft highlights opposite each other, like light on a record.
      shade[i] = Math.round(26 * Math.pow(Math.max(0, Math.cos(2 * (a + Math.PI / 4))), 6))
      const r = rMap[i]
      gMap[i] = r > inR - spacing && r < outR + spacing ? Math.floor((r - inR) / spacing) : -9
    }
  }

  // Wobble shapes: groove j uses k_j lobes. Flat tables of sin/cos(kθ): [lobeIndex * ANG + angle].
  const LOBES = [2, 3, 4, 5, 6]
  const sinT = new Float32Array(LOBES.length * ANG)
  const cosT = new Float32Array(LOBES.length * ANG)
  LOBES.forEach((k, t) => {
    for (let a = 0; a < ANG; a++) {
      sinT[t * ANG + a] = Math.sin((k * a * 2 * Math.PI) / ANG)
      cosT[t * ANG + a] = Math.cos((k * a * 2 * Math.PI) / ANG)
    }
  })
  const lobeBase = Int32Array.from({ length: grooves }, (_, j) => ((j * 3 + 1) % LOBES.length) * ANG)

  // Per-frame groove state.
  const gLevel = new Float32Array(grooves)
  const gCos = new Float32Array(grooves)
  const gSin = new Float32Array(grooves)
  const gHalfW = new Float32Array(grooves)
  const gRGB = new Uint8Array(grooves * 3)
  const ringR = Float32Array.from({ length: grooves }, (_, j) => inR + (j + 0.5) * spacing)
  const bandColor = Array.from({ length: grooves }, (_, j) => {
    const t = grooves === 1 ? 0 : j / (grooves - 1)
    return cA.map((c, i) => c + (cB[i] - c) * t)
  })

  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)
  }

  /**
   * @param {Uint8Array | Uint8ClampedArray} out RGBA, width*height*4
   * @param {ArrayLike<number>} levels one per groove (bass first)
   * @param {number} frame video frame index (drives spin and shake)
   * @param {number} [scale] multiply levels by this (1/255 for uint8 levels)
   */
  function draw(out, levels, frame, scale = 1) {
    // Background
    const px = new Uint32Array(out.buffer, out.byteOffset, (width * height) | 0)
    px.fill(bg ? (bg[0] | (bg[1] << 8) | (bg[2] << 16) | (255 << 24)) >>> 0 : 0)

    const rot = Math.round(((frame / fps) * (VINYL_RPM / 60) * ANG) % ANG)
    for (let j = 0; j < grooves; j++) {
      const L = Math.min(1, Math.max(0, levels[grooves - 1 - j] * scale)) // outer groove = bass
      gLevel[j] = L
      const phase = j * 1.7 + frame * 0.85 // shaking motion
      gCos[j] = Math.cos(phase) * L * shakeAmp
      gSin[j] = Math.sin(phase) * L * shakeAmp
      gHalfW[j] = (spacing * (0.28 + 0.34 * L)) / 2
      const m = Math.min(1, L * 1.5)
      const c = bandColor[grooves - 1 - j]
      gRGB[j * 3] = DIM[0] + (c[0] - DIM[0]) * m
      gRGB[j * 3 + 1] = DIM[1] + (c[1] - DIM[1]) * m
      gRGB[j * 3 + 2] = DIM[2] + (c[2] - DIM[2]) * m
    }

    for (let y = 0; y < bh; y++) {
      let o = ((y0 + y) * width + x0) * 4
      for (let x = 0; x < bw; x++, o += 4) {
        const i = y * bw + x
        const r = rMap[i]
        // Coverage of the disk (antialiased outer edge and spindle hole).
        const cov = Math.min(1, Math.max(0, R + 0.5 - r)) * Math.min(1, Math.max(0, r - holeR + 0.5))
        if (cov <= 0) continue
        const a = (aMap[i] - rot + ANG) & (ANG - 1) // angle in record space (spins)

        let cr, cg, cb
        if (r < labelR + 1) {
          // Label art: color A with a color-B wedge, a light ring and a dark center.
          const wedge = a < ANG / 6 ? 1 : 0
          cr = cA[0] + (cB[0] - cA[0]) * wedge
          cg = cA[1] + (cB[1] - cA[1]) * wedge
          cb = cA[2] + (cB[2] - cA[2]) * wedge
          const ring = 1 - smooth(0.6, 1.6, Math.abs(r - labelR * 0.72))
          cr += (240 - cr) * ring * 0.7
          cg += (240 - cg) * ring * 0.7
          cb += (245 - cb) * ring * 0.7
          const center = 1 - smooth(R * 0.07 - 0.8, R * 0.07 + 0.8, r)
          cr += (14 - cr) * center
          cg += (14 - cg) * center
          cb += (18 - cb) * center
          // Blend label edge into the disk.
          const e = Math.min(1, Math.max(0, labelR + 0.5 - r))
          const s = shade[i]
          cr = DISK_RGB[0] + s + (cr - DISK_RGB[0] - s) * e
          cg = DISK_RGB[1] + s + (cg - DISK_RGB[1] - s) * e
          cb = DISK_RGB[2] + s + (cb - DISK_RGB[2] - s) * e
        } else {
          const s = shade[i]
          cr = DISK_RGB[0] + s
          cg = DISK_RGB[1] + s
          cb = DISK_RGB[2] + s + 2
          const g = gMap[i]
          if (g !== -9) {
            // Nearest grooves (wobble ≤ 1 spacing → 3 candidates).
            let best = 0
            let bj = -1
            const jFrom = g > 0 ? g - 1 : 0
            const jTo = g + 1 < grooves ? g + 1 : grooves - 1
            for (let j = jFrom; j <= jTo; j++) {
              const ti = lobeBase[j] + a
              let dist = r - (ringR[j] + sinT[ti] * gCos[j] + cosT[ti] * gSin[j])
              if (dist < 0) dist = -dist
              let c = gHalfW[j] - dist + 0.5
              if (c > 1) c = 1
              if (c > best) (best = c), (bj = j)
            }
            if (bj >= 0) {
              const glow = 0.55 + 0.45 * gLevel[bj] // lit grooves are fully opaque
              const k = best * glow
              cr += (gRGB[bj * 3] - cr) * k
              cg += (gRGB[bj * 3 + 1] - cg) * k
              cb += (gRGB[bj * 3 + 2] - cb) * k
            }
          }
        }

        // Explicit rounding: Buffer truncates, ImageData rounds — keep both identical.
        if (bg) {
          out[o] = (bg[0] + (cr - bg[0]) * cov + 0.5) | 0
          out[o + 1] = (bg[1] + (cg - bg[1]) * cov + 0.5) | 0
          out[o + 2] = (bg[2] + (cb - bg[2]) * cov + 0.5) | 0
          out[o + 3] = 255
        } else {
          out[o] = (cr + 0.5) | 0
          out[o + 1] = (cg + 0.5) | 0
          out[o + 2] = (cb + 0.5) | 0
          out[o + 3] = (255 * cov + 0.5) | 0
        }
      }
    }
  }

  return { draw }
}
