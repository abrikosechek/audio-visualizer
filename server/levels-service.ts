// Keeps one long-lived `render.mjs serve` process for preview chunks (no Node startup per request).
// Requests are queued and sent one at a time; a request aborted while still queued never reaches the script.

import { spawn, type ChildProcess } from 'node:child_process'

export interface LevelsRequest {
  input: string
  bars: number
  sensitivity: number
  smoothing: number
  start: number
  count: number
}

export interface LevelsHeader {
  start: number
  frames: number
  totalFrames: number
  bars: number
  fps: number
}

interface Pending {
  id: number
  req: LevelsRequest
  signal: AbortSignal
  resolve: (r: { head: LevelsHeader; data: Buffer }) => void
  reject: (e: Error) => void
}

export function createLevelsService(script: string, cwd: string) {
  let child: ChildProcess | null = null
  let nextId = 1
  const queue: Pending[] = []
  let active: Pending | null = null

  // Stream parser state: a JSON header line, then `bytes` raw bytes.
  let buf: Buffer = Buffer.alloc(0)
  let header: (LevelsHeader & { id: number; ok: boolean; bytes: number; error?: string }) | null = null

  function ensureChild() {
    if (child && child.exitCode === null) return child
    child = spawn(process.execPath, [script, 'serve'], { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    buf = Buffer.alloc(0)
    header = null
    let stderr = ''
    child.stderr!.on('data', (d) => (stderr += d))
    child.stdout!.on('data', onData)
    child.on('close', () => {
      child = null
      if (active) {
        active.reject(new Error(stderr.trim() || 'Analyzer process exited'))
        active = null
      }
      pump()
    })
    return child
  }

  function onData(chunk: Buffer) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk
    for (;;) {
      if (!header) {
        const nl = buf.indexOf(10)
        if (nl < 0) return
        header = JSON.parse(buf.subarray(0, nl).toString('utf8'))
        buf = buf.subarray(nl + 1)
        if (!header!.ok) {
          finish((p) => p.reject(new Error(header!.error ?? 'Analysis failed')))
          continue
        }
      }
      if (buf.length < header!.bytes) return
      const data = Buffer.from(buf.subarray(0, header!.bytes))
      buf = buf.subarray(header!.bytes)
      const { start, frames, totalFrames, bars, fps } = header!
      finish((p) => p.resolve({ head: { start, frames, totalFrames, bars, fps }, data }))
    }
  }

  function finish(settle: (p: Pending) => void) {
    const p = active
    header = null
    active = null
    if (p) settle(p)
    pump()
  }

  function pump() {
    if (active) return
    let p: Pending | undefined
    while ((p = queue.shift()) && p.signal.aborted) p.reject(new Error('aborted'))
    if (!p) return
    active = p
    ensureChild().stdin!.write(JSON.stringify({ id: p.id, ...p.req }) + '\n')
  }

  function request(req: LevelsRequest, signal: AbortSignal) {
    return new Promise<{ head: LevelsHeader; data: Buffer }>((resolve, reject) => {
      queue.push({ id: nextId++, req, signal, resolve, reject })
      pump()
    })
  }

  function dispose() {
    child?.kill()
  }

  return { request, dispose }
}
