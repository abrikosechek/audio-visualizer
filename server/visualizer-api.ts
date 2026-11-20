// Vite plugin: local HTTP bridge between the page and scripts/visualizer/render.mjs.
// The browser only uploads the WAV and sends settings; all analysis/drawing/encoding runs in the
// local Node script as a child process, so the UI never blocks.
//
//   POST /api/audio                  raw WAV body, header x-filename → { id, name, duration, ... }
//   POST /api/levels                 { audioId, bars, sensitivity, smoothing, start, count } → uint8 frames×bars
//                                    (headers x-start, x-frames, x-total-frames, x-bars, x-fps)
//   GET  /api/demo, /api/demo/audio  built-in 15 s demo loop (info / WAV), preview only
//   POST /api/render                 { audioId, settings } → { jobId }  (403 for the demo)
//   GET  /api/render/:id/events      Server-Sent Events: stage / start / progress / done / error / cancelled
//   POST /api/render/:id/cancel
//   GET  /api/render/:id/download

import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, parse, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'

import { writeDemoWav } from '../scripts/visualizer/demo-sound.mjs'
import { createLevelsService } from './levels-service.ts'

interface Settings {
  type: 'bars' | 'vinyl'
  mode: 'bottom' | 'center'
  bars: number
  sensitivity: number
  smoothing: number
  background: string | null
  colors: string[]
}

interface Job {
  id: string
  status: 'running' | 'done' | 'error' | 'cancelled'
  child: ChildProcess
  file: string
  downloadName: string
  events: object[]
  listeners: Set<ServerResponse>
}

const ROOT = resolve(import.meta.dirname, '..')
const SCRIPT = join(ROOT, 'scripts/visualizer/render.mjs')
const CACHE = join(ROOT, '.cache/visualizer')
const UPLOADS = join(CACHE, 'uploads')
const EXPORTS = join(CACHE, 'exports')
const MAX_AGE_MS = 24 * 60 * 60 * 1000
const ID = /^[a-f0-9-]{36}$/
// Built-in preview sound: synthesized locally, previewable, never exportable.
const DEMO_ID = 'demo'
const DEMO_FILE = join(CACHE, 'demo-comfy-v1.wav')

export function visualizerApi(): Plugin {
  const audioNames = new Map<string, string>()
  const jobs = new Map<string, Job>()
  const levelsService = createLevelsService(SCRIPT, ROOT)

  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local')
    if (!url.pathname.startsWith('/api/')) return next()
    handle(url, req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      if (!res.headersSent) json(res, 500, { error: message })
      else res.end()
    })
  }

  async function handle(url: URL, req: IncomingMessage, res: ServerResponse) {
    const p = url.pathname
    const m = /^\/api\/render\/([^/]+)\/(events|cancel|download)$/.exec(p)

    if (req.method === 'POST' && p === '/api/audio') return uploadAudio(req, res)
    if (req.method === 'GET' && p === '/api/demo') {
      const info = JSON.parse(await runScript(['info', '--input', DEMO_FILE], 'utf8'))
      return json(res, 200, { id: DEMO_ID, name: 'Comfy demo loop', demo: true, ...info })
    }
    if (req.method === 'GET' && p === '/api/demo/audio') {
      const { size } = await stat(DEMO_FILE)
      res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': size, 'cache-control': 'no-store' })
      return void (await pipeline(createReadStream(DEMO_FILE), res))
    }
    if (req.method === 'POST' && p === '/api/levels') return levels(req, res)
    if (req.method === 'POST' && p === '/api/render') return startRender(req, res)
    if (m) {
      const job = jobs.get(m[1]!)
      if (!job) return json(res, 404, { error: 'Unknown render job' })
      if (m[2] === 'events' && req.method === 'GET') return events(job, req, res)
      if (m[2] === 'cancel' && req.method === 'POST') {
        if (job.status === 'running') job.child.stdin?.write('cancel\n')
        return json(res, 200, { ok: true })
      }
      if (m[2] === 'download' && req.method === 'GET') return download(job, res)
    }
    json(res, 404, { error: 'Not found' })
  }

  async function uploadAudio(req: IncomingMessage, res: ServerResponse) {
    const name = decodeURIComponent(String(req.headers['x-filename'] ?? 'audio.wav'))
    if (!/\.wav$/i.test(name)) return json(res, 400, { error: 'Only .wav files are supported' })
    const id = randomUUID()
    const file = join(UPLOADS, `${id}.wav`)
    await pipeline(req, createWriteStream(file))
    try {
      const info = JSON.parse(await runScript(['info', '--input', file], 'utf8'))
      audioNames.set(id, name)
      json(res, 200, { id, name, ...info })
    } catch (err) {
      await rm(file, { force: true })
      json(res, 400, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  async function levels(req: IncomingMessage, res: ServerResponse) {
    const body = await readJson(req)
    const file = audioFile(body.audioId)
    if (!file) return json(res, 404, { error: 'Audio not found, import it again' })
    // Client gave up on this chunk (seeked away / settings changed) → drop it if still queued.
    const ctrl = new AbortController()
    res.on('close', () => ctrl.abort())
    try {
      const { head, data } = await levelsService.request(
        {
          input: file,
          bars: Number(body.bars) || 64,
          sensitivity: Number(body.sensitivity) || 1,
          smoothing: Number(body.smoothing) || 0,
          start: Number(body.start) || 0,
          count: Math.min(Number(body.count) || 150, 3000),
        },
        ctrl.signal,
      )
      if (res.destroyed) return
      res.writeHead(200, {
        'content-type': 'application/octet-stream',
        'cache-control': 'no-store',
        'x-start': head.start,
        'x-frames': head.frames,
        'x-total-frames': head.totalFrames,
        'x-bars': head.bars,
        'x-fps': head.fps,
      })
      res.end(data)
    } catch (err) {
      if (!res.destroyed) json(res, 500, { error: err instanceof Error ? err.message : String(err) })
    }
  }

  async function startRender(req: IncomingMessage, res: ServerResponse) {
    const body = await readJson(req)
    if (body.audioId === DEMO_ID) return json(res, 403, { error: 'The demo sound is for preview only. Import a WAV to export.' })
    const file = audioFile(body.audioId)
    if (!file) return json(res, 404, { error: 'Audio not found, import it again' })
    const settings = body.settings as Settings
    const ext = settings.background === null ? 'mov' : 'mp4'
    const id = randomUUID()
    const out = join(EXPORTS, `${id}.${ext}`)
    const base = parse(audioNames.get(body.audioId) ?? 'audio').name
    const child = spawnScript(['render', '--input', file, '--output', out, ...settingsArgs(settings)])
    const job: Job = {
      id,
      status: 'running',
      child,
      file: out,
      downloadName: `${base}-${settings.type === 'vinyl' ? 'vinyl' : `bars-${settings.mode}`}-2560x1440.${ext}`,
      events: [],
      listeners: new Set(),
    }
    jobs.set(id, job)

    const push = (ev: Record<string, unknown>) => {
      // Keep only the latest progress event in history so late subscribers get a compact replay.
      if (ev.type === 'progress' && job.events.at(-1)?.hasOwnProperty('frame')) job.events.pop()
      job.events.push(ev)
      for (const l of job.listeners) send(l, ev)
      if (ev.type === 'done' || ev.type === 'error' || ev.type === 'cancelled') {
        for (const l of job.listeners) l.end()
        job.listeners.clear()
      }
    }

    let buf = ''
    let stderr = ''
    child.stdout!.setEncoding('utf8').on('data', (d: string) => {
      buf += d
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line) continue
        try {
          const ev = JSON.parse(line)
          if (ev.type === 'done') {
            job.status = 'done'
            ev.filename = job.downloadName
          } else if (ev.type === 'error') job.status = 'error'
          else if (ev.type === 'cancelled') job.status = 'cancelled'
          push(ev)
        } catch {
          /* ignore non-JSON output */
        }
      }
    })
    child.stderr!.on('data', (d) => (stderr += d))
    child.on('close', (code) => {
      if (job.status === 'running') {
        job.status = 'error'
        push({ type: 'error', message: stderr.trim() || `Render script exited with code ${code}` })
      }
      if (job.status !== 'done') rm(out, { force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
    })

    json(res, 200, { jobId: id })
  }

  function events(job: Job, req: IncomingMessage, res: ServerResponse) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    })
    for (const ev of job.events) send(res, ev)
    if (job.status !== 'running') return res.end()
    job.listeners.add(res)
    req.on('close', () => job.listeners.delete(res))
  }

  async function download(job: Job, res: ServerResponse) {
    if (job.status !== 'done') return json(res, 409, { error: 'Render is not finished' })
    const { size } = await stat(job.file)
    res.writeHead(200, {
      'content-type': job.file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
      'content-length': size,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(job.downloadName)}`,
    })
    await pipeline(createReadStream(job.file), res)
  }

  function audioFile(id: unknown) {
    if (id === DEMO_ID) return DEMO_FILE
    return typeof id === 'string' && ID.test(id) ? join(UPLOADS, `${id}.wav`) : null
  }

  return {
    name: 'visualizer-api',
    async configureServer(server) {
      await prepareCache()
      server.middlewares.use(middleware)
      server.httpServer?.on('close', levelsService.dispose)
    },
    buildEnd() {
      levelsService.dispose()
    },
    async configurePreviewServer(server) {
      await prepareCache()
      server.middlewares.use(middleware)
    },
  }
}

function settingsArgs(s: Settings) {
  return [
    '--type', s.type === 'vinyl' ? 'vinyl' : 'bars',
    '--mode', s.mode === 'center' ? 'center' : 'bottom',
    '--bars', String(s.bars),
    '--sensitivity', String(s.sensitivity),
    '--smoothing', String(Number(s.smoothing) || 0),
    '--background', s.background === null ? 'transparent' : String(s.background),
    ...(Array.isArray(s.colors) && s.colors.length ? ['--colors', s.colors.join(',')] : []),
  ]
}

function spawnScript(args: string[]) {
  return spawn(process.execPath, [SCRIPT, ...args], { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
}

function runScript(args: string[], encoding: BufferEncoding) {
  return new Promise<string>((ok, fail) => {
    const child = spawnScript(args)
    let out = ''
    let err = ''
    child.stdout!.setEncoding(encoding).on('data', (d) => (out += d))
    child.stderr!.on('data', (d) => (err += d))
    child.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(err.trim() || `Script failed (${code})`))))
  })
}

async function prepareCache() {
  await mkdir(UPLOADS, { recursive: true })
  await mkdir(EXPORTS, { recursive: true })
  if (!(await stat(DEMO_FILE).catch(() => null))) await writeDemoWav(DEMO_FILE)
  // Drop files left from earlier sessions.
  for (const dir of [UPLOADS, EXPORTS]) {
    for (const name of await readdir(dir)) {
      const f = join(dir, name)
      const s = await stat(f).catch(() => null)
      if (s && Date.now() - s.mtimeMs > MAX_AGE_MS) await rm(f, { force: true }).catch(() => {})
    }
  }
}

async function readJson(req: IncomingMessage) {
  let body = ''
  for await (const chunk of req) body += chunk
  return JSON.parse(body || '{}')
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(data))
}

function send(res: ServerResponse, ev: object) {
  res.write(`data: ${JSON.stringify(ev)}\n\n`)
}
