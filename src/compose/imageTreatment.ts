import type { PhotoStyle } from '../config'
import { acquire, release } from '../lib/canvasPool'
import { applyCurves, applyLut, buildCurveTable, loadLut, type CurveTables, type Lut3D } from '../lib/lut'

/**
 * Tratamiento fotográfico de la capa MEDIO.
 *
 * Se aplica sobre el recuadro de la persona ANTES de recortar con la máscara y
 * de componer. El orden es el del brief y no es arbitrario:
 *   1. suavizado de piel  — sobre píxeles aún sin graduar, donde el umbral de
 *                           detalle se comporta de forma predecible;
 *   2. color grading      — LUT .cube, o curvas por canal si aún no hay LUT;
 *   3. glow               — necesita el color ya definitivo para que el brillo
 *                           tire de los tonos correctos;
 *   4. viñeteado          — siempre el último: oscurece lo que ya está hecho.
 *
 * Todo trabaja sobre un canvas que se recibe y se modifica in situ.
 */

type Ctx = OffscreenCanvasRenderingContext2D

const curveCache = new Map<string, CurveTables>()

export async function applyTreatment(ctx: Ctx, width: number, height: number, style: PhotoStyle): Promise<void> {
  if (style.skinSmooth.enabled) skinSmooth(ctx, width, height, style)
  if (style.grading.enabled) await colorGrade(ctx, width, height, style)
  if (style.glow.enabled) glow(ctx, width, height, style)
  if (style.vignette.enabled) vignette(ctx, width, height, style)
}

/* ───────────────── 1 · SUAVIZADO DE PIEL ───────────────────── */

/**
 * Desenfoque selectivo: se mezcla la versión desenfocada solo donde el detalle
 * local es bajo (piel), y se deja el píxel intacto donde hay contraste (ojos,
 * pestañas, cejas, labios, contorno del pelo). Un blur plano convierte la cara
 * en plástico; esto conserva los rasgos.
 */
function skinSmooth(ctx: Ctx, width: number, height: number, style: PhotoStyle): void {
  const { radiusPx, strength, detailThreshold, detailSoftness } = style.skinSmooth
  if (strength <= 0 || radiusPx <= 0) return

  const original = ctx.getImageData(0, 0, width, height)

  // El blur lo hace el navegador (GPU); solo la mezcla se hace en JS.
  const blurEntry = acquire(width, height)
  let blurred: ImageData
  try {
    blurEntry.ctx.filter = `blur(${radiusPx}px)`
    blurEntry.ctx.drawImage(ctx.canvas, 0, 0)
    blurEntry.ctx.filter = 'none'
    blurred = blurEntry.ctx.getImageData(0, 0, width, height)
  } finally {
    release(blurEntry)
  }

  const src = original.data
  const blur = blurred.data
  const softness = Math.max(1, detailSoftness)

  for (let i = 0; i < src.length; i += 4) {
    // Diferencia de luma entre original y desenfocado = detalle local.
    const lumaSrc = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]
    const lumaBlur = 0.2126 * blur[i] + 0.7152 * blur[i + 1] + 0.0722 * blur[i + 2]
    const detail = Math.abs(lumaSrc - lumaBlur)

    // 1 en zonas planas, 0 en bordes, con transición suave entre ambas.
    const falloff = 1 - clamp01((detail - detailThreshold) / softness + 1)
    const mix = strength * falloff
    if (mix <= 0) continue

    src[i] += (blur[i] - src[i]) * mix
    src[i + 1] += (blur[i + 1] - src[i + 1]) * mix
    src[i + 2] += (blur[i + 2] - src[i + 2]) * mix
  }

  ctx.putImageData(original, 0, 0)
}

/* ──────────────────── 2 · COLOR GRADING ────────────────────── */

async function colorGrade(ctx: Ctx, width: number, height: number, style: PhotoStyle): Promise<void> {
  const { lutPath, lutAmount, curves, saturation } = style.grading

  let lut: Lut3D | null = null
  if (lutPath) lut = await loadLut(lutPath)

  const image = ctx.getImageData(0, 0, width, height)

  if (lut) {
    applyLut(image.data, lut, lutAmount)
  } else {
    // Fallback mientras el diseñador no entregue la .cube.
    let tables = curveCache.get(style.id)
    if (!tables) {
      tables = {
        rgb: buildCurveTable(curves.rgb),
        r: buildCurveTable(curves.r),
        g: buildCurveTable(curves.g),
        b: buildCurveTable(curves.b),
      }
      curveCache.set(style.id, tables)
    }
    applyCurves(image.data, tables, saturation)
  }

  ctx.putImageData(image, 0, 0)
}

/* ───────────────────────── 3 · GLOW ────────────────────────── */

/**
 * Copia desenfocada compuesta con 'screen'. Con `threshold` > 0 solo brillan
 * las altas luces (bright-pass); a 0 la imagen entera se ilumina.
 */
function glow(ctx: Ctx, width: number, height: number, style: PhotoStyle): void {
  const { radiusPx, opacity, threshold } = style.glow
  if (opacity <= 0) return

  const entry = acquire(width, height)
  try {
    const bright = entry.ctx
    bright.drawImage(ctx.canvas, 0, 0)

    if (threshold > 0) {
      const image = bright.getImageData(0, 0, width, height)
      const data = image.data
      const cut = threshold * 255
      // Por encima del corte se conserva el exceso reescalado; por debajo, negro.
      const scale = 255 / Math.max(1, 255 - cut)
      for (let i = 0; i < data.length; i += 4) {
        const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (luma <= cut) {
          data[i] = 0
          data[i + 1] = 0
          data[i + 2] = 0
        } else {
          const gain = ((luma - cut) * scale) / luma
          data[i] *= gain
          data[i + 1] *= gain
          data[i + 2] *= gain
        }
      }
      bright.putImageData(image, 0, 0)
    }

    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.globalAlpha = opacity
    ctx.filter = `blur(${radiusPx}px)`
    ctx.drawImage(entry.canvas, 0, 0)
    ctx.restore()
  } finally {
    release(entry)
  }
}

/* ─────────────────────── 4 · VIÑETEADO ─────────────────────── */

function vignette(ctx: Ctx, width: number, height: number, style: PhotoStyle): void {
  const { strength, innerRadius, outerRadius, centerX, centerY } = style.vignette
  if (strength <= 0) return

  const cx = width * centerX
  const cy = height * centerY
  // Radio de referencia: la distancia a la esquina más lejana.
  const maxRadius = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy))

  const gradient = ctx.createRadialGradient(cx, cy, maxRadius * innerRadius, cx, cy, maxRadius * outerRadius)
  gradient.addColorStop(0, 'rgba(0,0,0,0)')
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
