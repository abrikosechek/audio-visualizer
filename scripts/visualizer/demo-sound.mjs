// Synthesizes the built-in 15 s "comfy" demo loop (lo-fi chords, keys, soft drums, vinyl crackle).
// Deterministic: same bytes every time. Writes a 16-bit stereo 44.1 kHz WAV.

import { writeFile } from 'node:fs/promises'

export const DEMO_SECONDS = 15
const SR = 44100
const BPM = 80
const BEAT = 60 / BPM // 0.75 s
const BAR = BEAT * 4 // 3 s → 5 bars

// Fmaj7 → Em7 → Am7 → Dm7 → Cmaj7 (MIDI notes), with bass roots.
const CHORDS = [
  { notes: [53, 57, 60, 64], bass: 41 },
  { notes: [52, 55, 59, 62], bass: 40 },
  { notes: [57, 60, 64, 67], bass: 45 },
  { notes: [50, 53, 57, 60], bass: 38 },
  { notes: [48, 55, 59, 64], bass: 36 },
]
const ARP = [0, 2, 1, 3, 2, 1, 3, 2] // chord-note order for the 8th-note arpeggio
const SWING = 0.07 // s, delay of off-beat 8ths

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const TAU = Math.PI * 2

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function synthDemo() {
  const n = Math.round(DEMO_SECONDS * SR)
  const L = new Float32Array(n)
  const R = new Float32Array(n)
  const rand = rng(1234)

  /** Adds a one-shot voice starting at `t0` seconds; fn(t) → [left, right], runs for `len` s. */
  const add = (t0, len, fn) => {
    const s0 = Math.max(0, Math.round(t0 * SR))
    const s1 = Math.min(n, Math.round((t0 + len) * SR))
    for (let s = s0; s < s1; s++) {
      const [l, r] = fn(s / SR - t0)
      L[s] += l
      R[s] += r
    }
  }

  // Warm pad: per chord, detuned sines with slow attack and overlap into the next chord.
  CHORDS.forEach((ch, c) => {
    const t0 = c * BAR
    ch.notes.forEach((m) => {
      const f = hz(m)
      add(t0, BAR + 0.8, (t) => {
        const env = Math.min(1, t / 0.5) * Math.min(1, Math.max(0, (BAR + 0.8 - t) / 0.8))
        const trem = 1 + 0.08 * Math.sin(TAU * 0.7 * t)
        const a = 0.026 * env * trem
        const base = Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)
        return [a * (base + 0.6 * Math.sin(TAU * f * 1.004 * t)), a * (base + 0.6 * Math.sin(TAU * f * 0.996 * t))]
      })
    })
  })

  // Electric-piano arpeggio: soft FM bell tone, an octave up, swung 8ths, alternating pan.
  for (let c = 0; c < CHORDS.length; c++) {
    for (let k = 0; k < 8; k++) {
      if (c === CHORDS.length - 1 && k > 4) break // let the ending breathe
      const t0 = c * BAR + k * (BEAT / 2) + (k % 2 ? SWING : 0)
      const f = hz(CHORDS[c].notes[ARP[k]] + 12)
      const pan = k % 2 ? 0.3 : -0.3
      const vel = 0.75 + 0.25 * rand()
      add(t0, 1.6, (t) => {
        const env = Math.min(1, t / 0.004) * Math.exp(-t * 2.8)
        const mod = 1.1 * Math.exp(-t * 7) * Math.sin(TAU * f * t)
        const v = 0.085 * vel * env * (Math.sin(TAU * f * t + mod) + 0.15 * Math.sin(TAU * 3 * f * t) * Math.exp(-t * 9))
        return [v * (1 - pan), v * (1 + pan)]
      })
    }
  }

  // Bass: round sine on beats 1 and 3 (and a pickup on the last 8th).
  CHORDS.forEach((ch, c) => {
    const f = hz(ch.bass)
    for (const [beat, len] of [[0, 1.3], [2, 1.0], [3.5, 0.4]]) {
      if (c === CHORDS.length - 1 && beat > 0) continue
      add(c * BAR + beat * BEAT, len, (t) => {
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 1.8) * Math.min(1, (len - t) / 0.05)
        const v = 0.16 * env * (Math.sin(TAU * f * t) + 0.2 * Math.sin(TAU * 2 * f * t))
        return [v, v]
      })
    }
  })

  // Drums (skip the very last bar's second half so the loop resolves).
  const lastBeat = CHORDS.length * 4 - 2
  for (let b = 0; b < lastBeat; b++) {
    const t0 = b * BEAT
    if (b % 4 === 0 || b % 4 === 2) {
      // Soft kick: falling sine.
      add(t0, 0.5, (t) => {
        const phase = TAU * (45 * t + (70 / 25) * (1 - Math.exp(-t * 25)))
        const v = 0.42 * Math.exp(-t * 7) * Math.sin(phase)
        return [v, v]
      })
    }
    if (b % 4 === 1 || b % 4 === 3) {
      // Rim / soft snare: band-limited noise + short tone.
      let lp = 0
      let prev = 0
      add(t0 + 0.01, 0.25, (t) => {
        const w = rand() * 2 - 1
        lp += 0.35 * (w - lp)
        const hp = lp - prev
        prev = lp
        const v = 0.09 * Math.exp(-t * 16) * (hp * 2.2 + 0.5 * Math.sin(TAU * 190 * t) * Math.exp(-t * 25))
        return [v * 0.9, v * 1.1]
      })
    }
    for (const off of [0, 0.5]) {
      // Hats on 8ths, quieter on the beat, swung off-beats.
      let prev = 0
      const amp = off ? 0.032 : 0.02
      add(t0 + off * BEAT + (off ? SWING : 0), 0.08, (t) => {
        const w = rand() * 2 - 1
        const hp = w - prev
        prev = w
        const v = amp * Math.exp(-t * 55) * hp
        return [v * 1.15, v * 0.85]
      })
    }
  }

  // Vinyl: faint hiss and sparse crackles.
  let pink = 0
  for (let s = 0; s < n; s++) {
    pink = 0.97 * pink + 0.03 * (rand() * 2 - 1)
    L[s] += pink * 0.02
    R[s] += pink * 0.02
    if (rand() < 7 / SR) {
      const a = 0.03 + 0.07 * rand()
      const right = rand() < 0.5
      for (let k = 0; k < 40 && s + k < n; k++) {
        const v = a * Math.exp(-k / 6) * (k % 2 ? -1 : 1)
        if (right) R[s + k] += v
        else L[s + k] += v
      }
    }
  }

  // Master: gentle low-pass warmth, soft clip, fades, normalize.
  let fl = 0
  let fr = 0
  let peak = 0
  for (let s = 0; s < n; s++) {
    fl += 0.45 * (L[s] - fl)
    fr += 0.45 * (R[s] - fr)
    const t = s / SR
    const fade = Math.min(1, t / 0.3) * Math.min(1, (DEMO_SECONDS - t) / 1.5)
    L[s] = Math.tanh(fl * 1.3) * fade
    R[s] = Math.tanh(fr * 1.3) * fade
    peak = Math.max(peak, Math.abs(L[s]), Math.abs(R[s]))
  }
  const gain = 0.89 / (peak || 1)

  const out = Buffer.alloc(44 + n * 4)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + n * 4, 4)
  out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(2, 22) // stereo
  out.writeUInt32LE(SR, 24)
  out.writeUInt32LE(SR * 4, 28)
  out.writeUInt16LE(4, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(n * 4, 40)
  for (let s = 0; s < n; s++) {
    out.writeInt16LE(Math.round(L[s] * gain * 32767), 44 + s * 4)
    out.writeInt16LE(Math.round(R[s] * gain * 32767), 46 + s * 4)
  }
  return out
}

/** @param {string} path */
export async function writeDemoWav(path) {
  await writeFile(path, synthDemo())
}
