export declare const DEFAULT_COLORS: string[]

export interface BarsLayoutItem {
  x: number
  rgb: number[]
  css: string
}

export interface BarsLayout {
  width: number
  height: number
  mode: 'bottom' | 'center'
  barWidth: number
  radius: number
  bars: BarsLayoutItem[]
  span(level: number): { top: number; bottom: number; height: number }
}

export declare function createBarsLayout(opts: {
  width: number
  height: number
  bars: number
  mode: 'bottom' | 'center'
  colors?: string[]
}): BarsLayout

export declare function hexToRgb(hex: string): [number, number, number]
