/**
 * Tabla de fantasmas del destello, portada de JS.LensFlare.
 *
 * ---------------------------------------------------------------------------
 * Lens Flare effect v1.0
 * Copyright (c) 2016 by Noncho Savov (http://www.foumartgames.com)
 * https://github.com/foumart/JS.LensFlare
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE.
 * ---------------------------------------------------------------------------
 *
 * Qué se portó y qué no:
 *  - SÍ: la tabla de 16 fantasmas (tamaño, paradas de color, forma, opacidad).
 *    Es lo que da el look — muchos elementos pequeños en vez de pocos grandes.
 *  - NO: el motor de animación. El original anima con GSAP/TweenLite, que no
 *    está en el proyecto y que en un tótem significaría un bucle corriendo
 *    todo el día. Aquí los fantasmas se colocan una vez y no se mueven.
 *
 * Los tamaños del original están en px sobre un lienzo de 500×500; aquí se
 * guardan ya normalizados (tamaño / 500) para que escalen con el destello.
 */

const SOURCE_CANVAS = 500

export type GhostPreset = {
  /** Diámetro como fracción del lienzo del destello. */
  readonly size: number
  /** Colores en hex, admite 8 dígitos (#rrggbbaa). */
  readonly colors: readonly string[]
  /** Paradas del degradado, 0..1, una por color. */
  readonly stops: readonly number[]
  /** Opacidad global del fantasma. */
  readonly alpha: number
  /** Lados del polígono. 0 o ausente = disco con degradado radial. */
  readonly sides?: number
  /** Radio interior del degradado, como fracción del tamaño. */
  readonly innerRadius?: number
}

/** Tal cual la tabla `p` del original, en el mismo orden. */
const RAW: readonly [number, readonly string[], readonly number[], number, number?, number?][] = [
  [18, ['#ddffdd', '#eeffee', '#ddffdd', '#ffffff00'], [0, 0.7, 0.8, 1], 0.05],
  [
    160,
    ['#ffffff00', '#0099ff', '#33ff44', '#FFFF00', '#FFA500', '#ff3333', '#dd22aa', '#cc33ff', '#ffffff00'],
    [0.4, 0.58, 0.64, 0.69, 0.73, 0.76, 0.82, 0.88, 1],
    0.1,
  ],
  [25, ['#66ff66', '#ccffcc', '#ffffff00'], [0, 0.95, 1], 0.075, 0, 0.1],
  [125, ['#ffffff', '#ffffff00', '#ffffff00', '#ffffff', '#ffffff', '#ffffff00'], [0, 0.1, 0.5, 0.85, 0.9, 1], 0.05, 0, 0.05],
  [15, ['#449944', '#55bb55', '#66cc66', '#ffffff00'], [0, 0.7, 0.8, 1], 0.2],
  [30, ['#cc6699', '#ff99cc', '#ffffff00'], [0, 0.95, 1], 0.15, 0, 0.1],
  [90, ['#ddddff', '#ffffff', '#eeeeff', '#ffffff00'], [0, 0.3, 0.7, 1], 0.06, 7],
  [100, ['#ffffff', '#ffffff66', '#ffffff00'], [0, 0.5, 1], 0.1, 0, 0],
  [12, ['#009900', '#33ff33', '#11cc11', '#ffffff00'], [0, 0.3, 0.7, 1], 0.1, 8],
  [
    75,
    ['#ffffff', '#ffffffcc', '#ffffff00', '#ffffff00', '#ffffff11', '#ffffff00', '#ffffff88', '#ffffff00'],
    [0, 0.15, 0.2, 0.5, 0.7, 0.75, 0.9, 1],
    0.1,
    0,
    0,
  ],
  [35, ['#999999', '#ffffff', '#ffffff00'], [0, 0.75, 1], 0.075],
  [20, ['#ffffff', '#ffffff00'], [0, 1], 0.15, 7, 0.4],
  [16, ['#dddddd', '#ffffff', '#eeeeee', '#ffffff00'], [0, 0.3, 0.7, 1], 0.1, 7],
  [150, ['#ffffff', '#ffffff66', '#ffffff00'], [0, 0.5, 1], 0.2, 0, 0],
  [
    12,
    ['#99bbdd', '#0099ff', '#33ff44', '#FFFF00', '#FFA500', '#ff3333', '#dd22aa', '#cc33ff', '#ffffff00'],
    [0.2, 0.68, 0.74, 0.79, 0.83, 0.86, 0.92, 0.98, 1],
    0.075,
  ],
  [10, ['#dddddd', '#ffffff', '#eeeeee', '#ffffff00'], [0, 0.3, 0.7, 1], 0.05],
]

export const GHOST_PRESETS: readonly GhostPreset[] = RAW.map(([size, colors, stops, alpha, sides, innerRadius]) => ({
  size: size / SOURCE_CANVAS,
  colors,
  stops,
  alpha,
  sides,
  innerRadius,
}))

/* ─────────────────────────── color ─────────────────────────── */

export type Rgba = { r: number; g: number; b: number; a: number }

/** Lee `#rgb`, `#rrggbb` o `#rrggbbaa`. */
export function parseHex(hex: string): Rgba {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: full.length > 6 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
  }
}

/**
 * Rota el tono de un color.
 *
 * La paleta original tira a verde (era para un demo sobre naranja); sobre el
 * rojo de Revlon eso ensucia. Rotando el tono se conserva la estructura de
 * luminosidad y saturación del original —que es lo que hace que se lea como
 * destello— y solo se lleva el color a la familia de marca.
 */
export function rotateHue(color: Rgba, degrees: number): Rgba {
  if (!degrees) return color
  const { h, s, l } = rgbToHsl(color)
  const rotated = hslToRgb((h + degrees / 360 + 1) % 1, s, l)
  return { ...rotated, a: color.a }
}

function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h / 6, s, l }
}

function hslToRgb(h: number, s: number, l: number): Rgba {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v, a: 1 }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
    a: 1,
  }
}
