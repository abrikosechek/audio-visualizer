#!/usr/bin/env node
// Audio bars visualizer — local render script.
//
//   node scripts/visualizer/render.mjs info    --input song.wav
//   node scripts/visualizer/render.mjs levels  --input song.wav [--start 300 --count 150] [options] > levels.bin
//   node scripts/visualizer/render.mjs preview --input song.wav --time 12.5 [options] > frame.png
//   node scripts/visualizer/render.mjs render  --input song.wav --output out.mp4 [options]
//
// Options: --type bars|vinyl  --mode bottom|center (bars)  --bars 64 (bars / grooves)  --sensitivity 1  --smoothing 0.3 (0–1, no delay)
//          --background #0b0b14|transparent
//          --colors "#8b7bff,#3dd6ff" (one color = solid, two = left→right gradient)
// `levels` writes a JSON header line, then raw uint8 bar levels (frames × bars, 0–255, 30 fps) for the
//   page's live preview. With --start/--count only that chunk is analyzed (partial WAV read).
// `serve` is the same as `levels` but long-lived (JSON-line requests on stdin) — used by the dev server.
// `render` prints JSON lines to stdout: start / progress / done / error. Send "cancel" on stdin to stop.

import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import { once } from 'node:events'
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import ffmpegPath from 'ffmpeg-static'

import { readWavInfo, readWavMono, readWavMonoRange } from './wav.mjs'
import { createAnalyzer, smoothingRadius, warmupFrames, WINDOW } from './analyze.mjs'
import { createDrawer } from './draw.mjs'
import { DEFAULT_COLORS, hexToRgb } from './layout.mjs'
import { encodePng } from './png.mjs'

export const VIDEO = { width: 2560, height: 1440, fps: 30 }
const PREVIEW = { width: 1280, height: 720 }

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    time: { type: 'string', default: '0' },
    start: { type: 'string' },
    count: { type: 'string' },
    type: { type: 'string', default: 'bars' },
    mode: { type: 'string', default: 'bottom' },
    bars: { type: 'string', default: '64' },
    sensitivity: { type: 'string', default: '1' },
    smoothing: { type: 'string', default: '0' },
    background: { type: 'string', default: '#0b0b14' },
    colors: { type: 'string', default: DEFAULT_COLORS.join(',') },
  },
})

const command = positionals[0]

try {
  if (command === 'serve') await serve()
  else if (!values.input) throw new Error('--input is required')
  else if (command === 'info') await info()
  else if (command === 'levels') await levels()
  else if (command === 'preview') await preview()
  else if (command === 'render') await render()
  else throw new Error(`Unknown command "${command}". Use info | preview | render.`)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  if (command === 'render') emit({ type: 'error', message })
  process.stderr.write(message + '\n')
  process.exit(1)
}

function settings() {
  const type = values.type === 'vinyl' ? 'vinyl' : 'bars'
  const mode = values.mode === 'center' ? 'center' : 'bottom'
  const bars = clamp(Math.round(Number(values.bars)), 1, 512)
  const sensitivity = clamp(Number(values.sensitivity), 0.05, 10)
  const smoothing = clamp(Number(values.smoothing), 0, 1)
  const background = values.background === 'transparent' ? null : values.background
  const colors = values.colors.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 2)
  if (![bars, sensitivity, smoothing].every(Number.isFinite)) throw new Error('Invalid --bars, --sensitivity or --smoothing')
  for (const c of [...colors, background ?? '#000000']) hexToRgb(c) // validates
  return { type, mode, bars, sensitivity, smoothing, background, colors }
}

async function info() {
  process.stdout.write(JSON.stringify(await readWavInfo(values.input)) + '\n')
}

/**
 * Bar levels for frames [start, start + count), identical to what `render` computes for those frames.
 * Reads only the needed slice of the WAV (+ a short warm-up so bar decay state matches).
 * Prints a JSON header line (start, frames, totalFrames, bars), then the raw uint8 levels.
 */
async function levels() {
  const s = settings()
  const { head, data } = await computeLevels(values.input, s, values.start, values.count)
  process.stdout.write(JSON.stringify(head) + '\n')
  process.stdout.write(data)
}

/**
 * Long-lived mode for the page preview: avoids Node startup per chunk.
 * stdin: one JSON request per line {id, input, bars, sensitivity, smoothing, start, count}
 * stdout: per request a JSON line {id, ok, bytes, ...header} followed by `bytes` raw bytes,
 *         or {id, ok: false, error}.
 */
async function serve() {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin })
  for await (const line of rl) {
    if (!line.trim()) continue
    let id = null
    try {
      const req = JSON.parse(line)
      id = req.id
      const opts = {
        bars: clamp(Math.round(Number(req.bars)), 1, 512),
        sensitivity: clamp(Number(req.sensitivity), 0.05, 10),
        smoothing: clamp(Number(req.smoothing) || 0, 0, 1),
      }
      const { head, data } = await computeLevels(req.input, opts, req.start, req.count)
      process.stdout.write(JSON.stringify({ id, ok: true, bytes: data.length, ...head }) + '\n')
      process.stdout.write(data)
    } catch (err) {
      process.stdout.write(JSON.stringify({ id, ok: false, error: err instanceof Error ? err.message : String(err) }) + '\n')
    }
  }
}

/** @param {{ bars: number, sensitivity: number, smoothing: number }} opts */
async function computeLevels(input, opts, startArg, countArg) {
  const { fps } = VIDEO
  const { bars } = opts
  const info = await readWavInfo(input)
  const sr = info.sampleRate
  const totalFrames = Math.max(1, Math.ceil(info.duration * fps))
  const start = clamp(Math.floor(Number(startArg) || 0), 0, totalFrames)
  const count = clamp(Math.floor(Number(countArg ?? totalFrames)), 0, totalFrames - start)

  // Samples needed: decay warm-up before the chunk, smoothing look-around on both sides, FFT half-window.
  const radius = smoothingRadius(opts.smoothing, fps)
  const warmStart = Math.max(0, start - warmupFrames(fps))
  const firstSample = Math.round(((warmStart - radius) / fps) * sr) - WINDOW / 2
  const lastSample = Math.round(((start + count - 1 + radius) / fps) * sr) + WINDOW / 2 + 1
  const slice = await readWavMonoRange(input, firstSample, lastSample - firstSample)
  const analyzer = createAnalyzer(slice.samples, sr, { ...opts, fps, offset: slice.offset })

  for (let f = warmStart; f < start; f++) analyzer.next(f)
  const data = Buffer.alloc(count * bars)
  for (let i = 0; i < count; i++) {
    const lv = analyzer.next(start + i)
    for (let b = 0; b < bars; b++) data[i * bars + b] = Math.round(lv[b] * 255)
  }
  return { head: { start, frames: count, totalFrames, bars, fps }, data }
}

async function preview() {
  const s = settings()
  const { samples, sampleRate } = await readWavMono(values.input)
  const time = clamp(Number(values.time) || 0, 0, samples.length / sampleRate)
  const analyzer = createAnalyzer(samples, sampleRate, { ...s, fps: VIDEO.fps })
  // Warm up so bar decay matches what the export shows at this moment.
  const target = Math.floor(time * VIDEO.fps)
  let levels
  for (let f = Math.max(0, target - warmupFrames(VIDEO.fps)); f <= target; f++) levels = analyzer.next(f)

  const drawer = createDrawer({ ...PREVIEW, ...s, fps: VIDEO.fps })
  const frame = Buffer.alloc(drawer.frameSize)
  drawer.draw(frame, levels, target)
  process.stdout.write(encodePng(frame, PREVIEW.width, PREVIEW.height))
}

async function render() {
  if (!values.output) throw new Error('--output is required')
  const s = settings()
  const { width, height, fps } = VIDEO
  const transparent = s.background === null

  emit({ type: 'stage', stage: 'reading' })
  const { samples, sampleRate } = await readWavMono(values.input)
  const duration = samples.length / sampleRate
  const total = Math.max(1, Math.ceil(duration * fps))
  emit({ type: 'start', totalFrames: total, duration, width, height, fps })

  const codec = transparent
    ? ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0']
    : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  const ffmpeg = spawn(
    ffmpegPath,
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', 'pipe:0',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      ...codec,
      values.output,
    ],
    { stdio: ['pipe', 'ignore', 'pipe'] },
  )
  let ffErr = ''
  ffmpeg.stderr.on('data', (d) => (ffErr += d))
  const ffExit = once(ffmpeg, 'close')
  ffmpeg.stdin.on('error', () => {}) // surfaced via exit code below

  let cancelled = false
  process.stdin.on('data', (d) => {
    if (String(d).includes('cancel')) {
      cancelled = true
      ffmpeg.kill()
    }
  })

  // Analysis is sequential (bar decay/smoothing need order) and cheap; drawing is the heavy part,
  // so frames are drawn in parallel by worker threads and written to ffmpeg strictly in order.
  const analyzer = createAnalyzer(samples, sampleRate, { ...s, fps })
  const frameSize = width * height * 4
  const workerCount = clamp(availableParallelism() - 1, 1, 8)
  const workers = Array.from({ length: workerCount }, () => {
    const w = new Worker(new URL('./frame-worker.mjs', import.meta.url), { workerData: { width, height, fps, ...s } })
    const queue = [] // resolvers, in request order (a worker answers in order)
    w.on('message', (m) => queue.shift()(m.buf))
    w.on('error', (e) => queue.shift()?.(Promise.reject(e)))
    return { w, queue }
  })
  const draw = (f, levels, buf) => {
    const wk = workers[f % workerCount]
    return new Promise((resolve) => {
      wk.queue.push(resolve)
      wk.w.postMessage({ f, levels, buf }, [buf])
    })
  }

  const depth = workerCount * 2 // frames in flight
  const free = Array.from({ length: depth + 2 }, () => new ArrayBuffer(frameSize))
  const inflight = [] // promises of drawn buffers, frame order
  const started = Date.now()
  let lastEmit = 0
  let written = 0

  async function writeNext() {
    const buf = await inflight.shift()
    await new Promise((resolve) => ffmpeg.stdin.write(Buffer.from(buf), () => resolve()))
    free.push(buf)
    written++
    const now = Date.now()
    if (now - lastEmit > 250 || written === total) {
      lastEmit = now
      const rate = written / Math.max((now - started) / 1000, 0.001)
      emit({ type: 'progress', frame: written, total, fps: round(rate), eta: round((total - written) / rate) })
    }
  }

  try {
    for (let f = 0; f < total && !cancelled && ffmpeg.exitCode === null; f++) {
      while (inflight.length >= depth || free.length === 0) await writeNext()
      const levels = Float32Array.from(analyzer.next(f))
      inflight.push(draw(f, levels, free.pop()))
    }
    while (inflight.length && !cancelled && ffmpeg.exitCode === null) await writeNext()
  } finally {
    for (const { w } of workers) w.terminate()
  }

  emit({ type: 'stage', stage: 'finalizing' })
  ffmpeg.stdin.end()
  const [code] = await ffExit
  if (cancelled) {
    emit({ type: 'cancelled' })
    process.exit(2)
  }
  if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${ffErr.trim() || 'no output'}`)
  emit({ type: 'done', output: values.output, seconds: round((Date.now() - started) / 1000) })
  process.exit(0)
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}
function round(v) {
  return Math.round(v * 10) / 10
}
