import type { CurvePoint } from '../config'

/**
 * Color grading.
 *
 * Dos caminos, en este orden de preferencia:
 *   1. LUT 3D .cube del diseñador (soporte completo, interpolación trilineal);
 *   2. curvas por canal definidas en config, como fallback mientras la LUT no
 *      llega. La estructura es la misma para el pipeline: ambas producen una
 *      función que transforma un ImageData in situ.
 */

export type Lut3D = {
  size: number
  /** RGB en 0..1, tamaño size³ * 3, indexado como ((b*size + g)*size + r)*3. */
  table: Float32Array
  domainMin: [number, number, number]
  domainMax: [number, number, number]
}

/* ─────────────────────────── .cube ─────────────────────────── */

/**
 * Parser de .cube (formato Adobe/Resolve).
 * Solo LUT_3D_SIZE: las 1D se cubren de sobra con las curvas por canal.
 */
export function parseCubeLut(source: string): Lut3D {
  let size = 0
  let domainMin: [number, number, number] = [0, 0, 0]
  let domainMax: [number, number, number] = [1, 1, 1]
  const values: number[] = []

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    if (line.startsWith('TITLE')) continue
    if (line.startsWith('LUT_1D_SIZE')) {
      throw new Error('LUT 1D no soportada; usa el fallback de curvas o exporta una 3D')
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      size = Number.parseInt(line.split(/\s+/)[1], 10)
      continue
    }
    if (line.startsWith('DOMAIN_MIN')) {
      domainMin = triple(line)
      continue
    }
    if (line.startsWith('DOMAIN_MAX')) {
      domainMax = triple(line)
      continue
    }

    const parts = line.split(/\s+/)
    if (parts.length < 3) continue
    const r = Number.parseFloat(parts[0])
    const g = Number.parseFloat(parts[1])
    const b = Number.parseFloat(parts[2])
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) continue
    values.push(r, g, b)
  }

  if (!size) throw new Error('El .cube no declara LUT_3D_SIZE')
  const expected = size * size * size * 3
  if (values.length !== expected) {
    throw new Error(`El .cube declara ${size}³ entradas pero trae ${values.length / 3}`)
  }

  return { size, table: Float32Array.from(values), domainMin, domainMax }
}

function triple(line: string): [number, number, number] {
  const parts = line.split(/\s+/).slice(1).map(Number.parseFloat)
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0]
}

const lutCache = new Map<string, Promise<Lut3D | null>>()

/** Carga y cachea una LUT. Devuelve null si no está: el pipeline usa curvas. */
export function loadLut(path: string): Promise<Lut3D | null> {
  const cached = lutCache.get(path)
  if (cached) return cached

  const promise = (async () => {
    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return parseCubeLut(await response.text())
    } catch (error) {
      console.info(`[lut] ${path} no disponible; se usan las curvas de config`, error)
      return null
    }
  })()

  lutCache.set(path, promise)
  return promise
}

/**
 * Aplica la LUT a un ImageData, con interpolación trilineal y mezcla contra el
 * original (`amount`). Se recorre el buffer una sola vez.
 */
export function applyLut(data: Uint8ClampedArray, lut: Lut3D, amount: number): void {
  const { size, table, domainMin, domainMax } = lut
  const last = size - 1
  const spanR = Math.max(1e-6, domainMax[0] - domainMin[0])
  const spanG = Math.max(1e-6, domainMax[1] - domainMin[1])
  const spanB = Math.max(1e-6, domainMax[2] - domainMin[2])
  const mix = Math.min(1, Math.max(0, amount))
  const keep = 1 - mix

  for (let i = 0; i < data.length; i += 4) {
    // Coordenada dentro de la rejilla, en 0..last.
    const r = clamp01((data[i] / 255 - domainMin[0]) / spanR) * last
    const g = clamp01((data[i + 1] / 255 - domainMin[1]) / spanG) * last
    const b = clamp01((data[i + 2] / 255 - domainMin[2]) / spanB) * last

    const r0 = Math.floor(r)
    const g0 = Math.floor(g)
    const b0 = Math.floor(b)
    const r1 = Math.min(last, r0 + 1)
    const g1 = Math.min(last, g0 + 1)
    const b1 = Math.min(last, b0 + 1)
    const fr = r - r0
    const fg = g - g0
    const fb = b - b0

    // Ocho vértices del cubo que rodea la muestra.
    const c000 = ((b0 * size + g0) * size + r0) * 3
    const c100 = ((b0 * size + g0) * size + r1) * 3
    const c010 = ((b0 * size + g1) * size + r0) * 3
    const c110 = ((b0 * size + g1) * size + r1) * 3
    const c001 = ((b1 * size + g0) * size + r0) * 3
    const c101 = ((b1 * size + g0) * size + r1) * 3
    const c011 = ((b1 * size + g1) * size + r0) * 3
    const c111 = ((b1 * size + g1) * size + r1) * 3

    for (let channel = 0; channel < 3; channel++) {
      const x00 = table[c000 + channel] + (table[c100 + channel] - table[c000 + channel]) * fr
      const x10 = table[c010 + channel] + (table[c110 + channel] - table[c010 + channel]) * fr
      const x01 = table[c001 + channel] + (table[c101 + channel] - table[c001 + channel]) * fr
      const x11 = table[c011 + channel] + (table[c111 + channel] - table[c011 + channel]) * fr
      const y0 = x00 + (x10 - x00) * fg
      const y1 = x01 + (x11 - x01) * fg
      const graded = (y0 + (y1 - y0) * fb) * 255
      data[i + channel] = data[i + channel] * keep + graded * mix
    }
  }
}

/* ───────────────────── curvas por canal ────────────────────── */

/**
 * Convierte puntos de control en una tabla de 256 entradas, interpolando de
 * forma monótona (Fritsch-Carlson): una curva en S no debe generar rebotes ni
 * invertir el orden de los tonos.
 */
export function buildCurveTable(points: readonly CurvePoint[]): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256)
  const sorted = [...points].sort((a, b) => a[0] - b[0])

  if (sorted.length === 0) {
    for (let i = 0; i < 256; i++) table[i] = i
    return table
  }
  if (sorted.length === 1) {
    table.fill(Math.round(clamp01(sorted[0][1]) * 255))
    return table
  }

  const xs = sorted.map((p) => p[0])
  const ys = sorted.map((p) => p[1])
  const n = xs.length
  const slopes = new Array<number>(n - 1)
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i]
    slopes[i] = dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx
  }

  const tangents = new Array<number>(n)
  tangents[0] = slopes[0]
  tangents[n - 1] = slopes[n - 2]
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  }
  // Recorte de Fritsch-Carlson: garantiza monotonía.
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
      continue
    }
    const a = tangents[i] / slopes[i]
    const b = tangents[i + 1] / slopes[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      tangents[i] = t * a * slopes[i]
      tangents[i + 1] = t * b * slopes[i]
    }
  }

  for (let i = 0; i < 256; i++) {
    const x = i / 255
    let segment = 0
    while (segment < n - 2 && x > xs[segment + 1]) segment++

    const x0 = xs[segment]
    const x1 = xs[segment + 1]
    const h = x1 - x0
    const t = h === 0 ? 0 : (x - x0) / h
    const t2 = t * t
    const t3 = t2 * t

    const value =
      (2 * t3 - 3 * t2 + 1) * ys[segment] +
      (t3 - 2 * t2 + t) * h * tangents[segment] +
      (-2 * t3 + 3 * t2) * ys[segment + 1] +
      (t3 - t2) * h * tangents[segment + 1]

    table[i] = Math.round(clamp01(value) * 255)
  }

  return table
}

export type CurveTables = {
  rgb: Uint8ClampedArray
  r: Uint8ClampedArray
  g: Uint8ClampedArray
  b: Uint8ClampedArray
}

/** Aplica curva maestra + curvas por canal y la saturación posterior. */
export function applyCurves(data: Uint8ClampedArray, tables: CurveTables, saturation: number): void {
  const sat = saturation
  for (let i = 0; i < data.length; i += 4) {
    let r = tables.r[tables.rgb[data[i]]]
    let g = tables.g[tables.rgb[data[i + 1]]]
    let b = tables.b[tables.rgb[data[i + 2]]]

    if (sat !== 1) {
      // Luma Rec.709: desaturar hacia ella conserva el brillo percibido.
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = luma + (r - luma) * sat
      g = luma + (g - luma) * sat
      b = luma + (b - luma) * sat
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
