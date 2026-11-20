// Minimal WAV reader: PCM 8/16/24/32-bit int, 32/64-bit float, WAVE_FORMAT_EXTENSIBLE.
// Returns the signal mixed down to mono as Float32Array in [-1, 1].

import { readFile, open } from 'node:fs/promises'

const PCM = 1
const FLOAT = 3
const EXTENSIBLE = 0xfffe

/**
 * @typedef {{ format: number, channels: number, sampleRate: number, bitsPerSample: number,
 *   blockAlign: number, dataOffset: number, dataSize: number }} WavHeader
 */

/** @param {Buffer} buf @returns {WavHeader} */
function parseHeader(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file (missing RIFF/WAVE header)')
  }
  /** @type {Partial<WavHeader>} */
  const h = {}
  let pos = 12
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4)
    const size = buf.readUInt32LE(pos + 4)
    const body = pos + 8
    if (id === 'fmt ') {
      h.format = buf.readUInt16LE(body)
      h.channels = buf.readUInt16LE(body + 2)
      h.sampleRate = buf.readUInt32LE(body + 4)
      h.blockAlign = buf.readUInt16LE(body + 12)
      h.bitsPerSample = buf.readUInt16LE(body + 14)
      if (h.format === EXTENSIBLE && size >= 26) h.format = buf.readUInt16LE(body + 24)
    } else if (id === 'data') {
      h.dataOffset = body
      // Some writers put 0 or 0xFFFFFFFF when streaming; clamp to what exists.
      h.dataSize = size
      break
    }
    pos = body + size + (size & 1)
  }
  if (h.format === undefined) throw new Error('WAV has no fmt chunk')
  if (h.dataOffset === undefined) throw new Error('WAV has no data chunk')
  if (h.format !== PCM && h.format !== FLOAT) throw new Error(`Unsupported WAV encoding (format ${h.format})`)
  return /** @type {WavHeader} */ (h)
}

/** @param {import('node:fs/promises').FileHandle} fh */
async function readHeader(fh) {
  const { size } = await fh.stat()
  const head = Buffer.alloc(Math.min(size, 1 << 16))
  await fh.read(head, 0, head.length, 0)
  const h = parseHeader(head)
  const dataSize = Math.min(h.dataSize || size, size - h.dataOffset)
  return { ...h, frames: Math.floor(dataSize / h.blockAlign) }
}

/** Reads only the header (fast, for info). @param {string} path */
export async function readWavInfo(path) {
  const fh = await open(path, 'r')
  try {
    const h = await readHeader(fh)
    return {
      sampleRate: h.sampleRate,
      channels: h.channels,
      bitsPerSample: h.bitsPerSample,
      float: h.format === FLOAT,
      duration: h.frames / h.sampleRate,
    }
  } finally {
    await fh.close()
  }
}

/**
 * Reads only sample frames [start, start + count) as mono — no need to load the whole file.
 * Out-of-range positions are zero. Returns `offset` = index of samples[0] in the full track.
 * @param {string} path @param {number} start @param {number} count
 */
export async function readWavMonoRange(path, start, count) {
  const fh = await open(path, 'r')
  try {
    const h = await readHeader(fh)
    const from = Math.max(0, start)
    const to = Math.min(h.frames, start + count)
    const out = new Float32Array(Math.max(0, count))
    if (to > from) {
      const buf = Buffer.alloc((to - from) * h.blockAlign)
      await fh.read(buf, 0, buf.length, h.dataOffset + from * h.blockAlign)
      mixToMono(buf, 0, to - from, h, out, from - start)
    }
    return { samples: out, offset: start, sampleRate: h.sampleRate, totalSamples: h.frames }
  } finally {
    await fh.close()
  }
}

function mixToMono(buf, dataOffset, frames, h, out, outOffset) {
  const bytes = h.bitsPerSample / 8
  const ch = h.channels
  const read = sampleReader(buf, h.format, h.bitsPerSample)
  for (let i = 0; i < frames; i++) {
    let sum = 0
    let p = dataOffset + i * h.blockAlign
    for (let c = 0; c < ch; c++, p += bytes) sum += read(p)
    out[outOffset + i] = sum / ch
  }
}

/** @param {string} path @returns {Promise<{ samples: Float32Array, sampleRate: number }>} */
export async function readWavMono(path) {
  const buf = await readFile(path)
  const h = parseHeader(buf)
  const dataSize = Math.min(h.dataSize || buf.length, buf.length - h.dataOffset)
  const frames = Math.floor(dataSize / h.blockAlign)
  const out = new Float32Array(frames)
  mixToMono(buf, h.dataOffset, frames, h, out, 0)
  return { samples: out, sampleRate: h.sampleRate }
}

/** @param {Buffer} buf @param {number} format @param {number} bits @returns {(p: number) => number} */
function sampleReader(buf, format, bits) {
  if (format === FLOAT) {
    if (bits === 32) return (p) => buf.readFloatLE(p)
    if (bits === 64) return (p) => buf.readDoubleLE(p)
  } else {
    if (bits === 8) return (p) => (buf[p] - 128) / 128
    if (bits === 16) return (p) => buf.readInt16LE(p) / 32768
    if (bits === 24) return (p) => buf.readIntLE(p, 3) / 8388608
    if (bits === 32) return (p) => buf.readInt32LE(p) / 2147483648
  }
  throw new Error(`Unsupported WAV bit depth: ${bits}-bit ${format === FLOAT ? 'float' : 'PCM'}`)
}
