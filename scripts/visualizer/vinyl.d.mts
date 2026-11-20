export declare const VINYL_RPM: number

export declare function createVinylRenderer(opts: {
  width: number
  height: number
  grooves: number
  fps: number
  colors?: string[]
  background: string | null
}): {
  draw(out: Uint8Array | Uint8ClampedArray, levels: ArrayLike<number>, frame: number, scale?: number): void
}
