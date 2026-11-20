// Spectrum analysis: per video frame, FFT of a Hann window → N log-spaced bar levels in [0, 1],
// then optional zero-delay temporal smoothing, then bar fall-off (decay).

const FFT_SIZE = 4096
const MIN_HZ = 40
const MAX_HZ = 16000
const DB_FLOOR = -65 // maps to 0
const DB_CEIL = -10 // maps to 1 (at sensitivity 1)
const RELEASE_PER_SEC = 2.2 // how fast bars fall (full height per second)

/** FFT window size in samples (the analyzer looks ±half of it around each frame time). */
export const WINDOW = FFT_SIZE

/**
 * Frames to analyze before a chunk so bar decay state is identical to a run from the start:
 * a bar falls fully (1 → 0) in 1/RELEASE_PER_SEC seconds, after which older history can't matter.
 * @param {number} fps
 */
export function warmupFrames(fps) {
  return Math.ceil(fps / RELEASE_PER_SEC) + 1
}

const MAX_SMOOTH_SEC = 0.2 // smoothing 1 = ±200 ms neighbourhood

/**
 * Smoothing look-around in frames, each side. Smoothing is a centered (zero-phase) Gaussian over
 * neighbouring frames: we render offline, so future frames are known → calmer bars with no delay.
 * @param {number} smoothing 0–1 @param {number} fps
 */
export function smoothingRadius(smoothing, fps) {
  return Math.round(Math.min(1, Math.max(0, smoothing || 0)) * MAX_SMOOTH_SEC * fps)
}

/**
 * Stateful analyzer: call `next(frame)` with consecutive frame indices (bar decay + smoothing need order).
 * @param {Float32Array} samples mono signal (may be a slice of the track, see `offset`)
 * @param {number} sampleRate
 * @param {{ bars: number, sensitivity: number, fps: number, smoothing?: number, offset?: number }} opts
 *   smoothing: 0–1; offset: track sample index of samples[0] (for partial reads)
 */
export function createAnalyzer(samples, sampleRate, { bars, sensitivity, fps, smoothing = 0, offset = 0 }) {
  const raw = createSpectrum(samples, sampleRate, { bars, sensitivity, offset })
  const radius = smoothingRadius(smoothing, fps)
  const kernel = gaussian(radius)
  const cache = new Map() // frame → raw levels (each frame analyzed once)
  const level = new Float32Array(bars)
  const fall = RELEASE_PER_SEC / fps

  const rawFrame = (f) => {
    let v = cache.get(f)
    if (!v) cache.set(f, (v = raw(f / fps)))
    return v
  }

  /** @param {number} f frame index @returns {Float32Array} levels in [0, 1] (reused buffer) */
  function next(f) {
    for (const k of cache.keys()) if (k < f - radius) cache.delete(k)
    for (let b = 0; b < bars; b++) {
      let v = 0
      for (let j = -radius; j <= radius; j++) v += kernel[j + radius] * rawFrame(f + j)[b]
      level[b] = Math.max(v, level[b] - fall)
    }
    return level
  }

  return { next }
}

/** Normalized Gaussian weights for offsets -r..r (sigma = r/2); r = 0 → [1]. */
function gaussian(r) {
  const k = new Float64Array(2 * r + 1)
  const sigma = Math.max(r / 2, 1e-9)
  let sum = 0
  for (let j = -r; j <= r; j++) sum += k[j + r] = Math.exp(-(j * j) / (2 * sigma * sigma))
  for (let i = 0; i < k.length; i++) k[i] /= sum
  return k
}

/** Raw (unsmoothed, no decay) bar levels for one moment: FFT → log bands → dB → [0, 1]. */
function createSpectrum(samples, sampleRate, { bars, sensitivity, offset }) {
  const n = FFT_SIZE
  const window = new Float32Array(n)
  for (let i = 0; i < n; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))

  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const mag = new Float64Array(n / 2)
  const rev = bitReverseTable(n)
  const { cos, sin } = twiddles(n)

  // Band edges in (fractional) FFT bins, log-spaced.
  const binHz = sampleRate / n
  const maxHz = Math.min(MAX_HZ, sampleRate / 2)
  const edges = new Float64Array(bars + 1)
  for (let b = 0; b <= bars; b++) {
    edges[b] = (MIN_HZ * Math.pow(maxHz / MIN_HZ, b / bars)) / binHz
  }

  const norm = n / 4 // amplitude of a full-scale sine after Hann window

  /** @param {number} time seconds @returns {Float32Array} new array of levels in [0, 1] */
  return function raw(time) {
    const level = new Float32Array(bars)
    const center = Math.round(time * sampleRate)
    const start = center - n / 2 - offset
    for (let i = 0; i < n; i++) {
      const s = start + i
      re[rev[i]] = s >= 0 && s < samples.length ? samples[s] * window[i] : 0
      im[i] = 0
    }
    fft(re, im, cos, sin)
    for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]) / norm

    for (let b = 0; b < bars; b++) {
      const lo = edges[b]
      const hi = edges[b + 1]
      let peak = 0
      if (hi - lo < 1) {
        // Narrow low-frequency band: interpolate between neighbouring bins.
        const c = (lo + hi) / 2
        const k = Math.floor(c)
        const t = c - k
        peak = (mag[k] ?? 0) * (1 - t) + (mag[k + 1] ?? 0) * t
      } else {
        for (let k = Math.floor(lo); k < Math.ceil(hi) && k < mag.length; k++) peak = Math.max(peak, mag[k])
      }
      // Gentle tilt so highs aren't always tiny compared to bass.
      const tilt = 1 + (b / bars) * 1.5
      const db = 20 * Math.log10(peak * tilt + 1e-12)
      let v = ((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR)) * sensitivity
      level[b] = Math.min(1, Math.max(0, v))
    }
    return level
  }
}

/** In-place iterative radix-2 FFT (input already in bit-reversed order). */
function fft(re, im, cos, sin) {
  const n = re.length
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1
    const step = n / size
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j
        const b = a + half
        const tr = re[b] * cos[k] + im[b] * sin[k]
        const ti = im[b] * cos[k] - re[b] * sin[k]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

function bitReverseTable(n) {
  const bits = Math.log2(n)
  const t = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    t[i] = r
  }
  return t
}

function twiddles(n) {
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let k = 0; k < n / 2; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / n)
    sin[k] = Math.sin((2 * Math.PI * k) / n)
  }
  return { cos, sin }
}
