import { PERSON } from '../config'
import type { Rect } from '../lib/geometry'
import { loadSegmenter } from './visionLoader'

/**
 * Segmentación de la persona (MediaPipe Selfie Segmentation) y construcción de
 * la máscara de recorte.
 */

export type PersonMask = {
  /** Confianza de "persona" por píxel, 0..1. */
  data: Float32Array
  width: number
  height: number
}

/**
 * Devuelve la máscara de persona del recorte dado.
 *
 * Qué máscara es la buena se decide por la ETIQUETA que declara el modelo, no
 * por el contenido de la imagen. `selfie_segmenter.tflite` publica
 * `getLabels() === ['selfie']` y una única máscara de confianza, donde el valor
 * alto ya significa "persona": no hay nada que invertir.
 *
 * Aquí hubo una heurística que miraba la banda perimetral y, si la confianza
 * era alta en el borde, daba la vuelta a la máscara. Partía de que "el marco de
 * un encuadre de medio cuerpo es fondo casi por definición", y eso es falso en
 * cuanto alguien se acerca: en un selfie de móvil la persona llena el encuadre,
 * el borde ES persona, y la heurística invertía una máscara correcta. Medido
 * con el mismo sujeto a distintas distancias, la cobertura caía del 96,3 % al
 * 3,7 % — la persona desaparecía de la pieza. Ninguna heurística espacial puede
 * resolverlo: si la persona llena el cuadro, no queda borde de fondo con el que
 * comparar. Ver dev/polarity-check.html.
 */
export async function segmentPerson(source: ImageBitmap | OffscreenCanvas): Promise<PersonMask> {
  const segmenter = await loadSegmenter()
  const result = segmenter.segment(source)

  try {
    const masks = result.confidenceMasks
    if (!masks || masks.length === 0) throw new Error('El segmentador no devolvió máscaras')

    const mask = masks[personMaskIndex(segmenter, masks.length)]
    const raw = mask.getAsFloat32Array()
    // El buffer pertenece a la tarea y muere con result.close(): hay que copiar.
    const data = new Float32Array(raw)

    return { data, width: mask.width, height: mask.height }
  } finally {
    result.close()
  }
}

/** Etiquetas que un modelo de segmentación usa para la clase "persona". */
const PERSON_LABEL = /selfie|person|persona|foreground|human/i

let indexCache: number | null = null

/**
 * Índice de la máscara de persona, según las etiquetas que declara el modelo.
 *
 * Se cachea porque el segmentador es un singleton: las etiquetas no cambian
 * entre fotogramas y `getLabels()` no es gratis.
 */
function personMaskIndex(segmenter: unknown, maskCount: number): number {
  if (indexCache !== null) return indexCache

  const labels = (segmenter as { getLabels?: () => string[] }).getLabels?.() ?? []
  const labelled = labels.findIndex((label) => PERSON_LABEL.test(label))

  if (labelled >= 0 && labelled < maskCount) {
    indexCache = labelled
  } else if (maskCount === 1) {
    // Un segmentador de selfie con una sola salida da la probabilidad de
    // persona directamente. Es el caso del modelo que usamos hoy.
    indexCache = 0
  } else {
    // Modelo distinto, con varias clases y sin etiqueta reconocible. Por
    // convención la clase 0 es el fondo, así que se usa la última. No se
    // adivina en silencio: si esto salta, hay que mirar el modelo nuevo.
    indexCache = maskCount - 1
    console.warn(
      `[segmentation] no reconozco la clase de persona en ${JSON.stringify(labels)}; ` +
        `uso la máscara ${indexCache} de ${maskCount}`,
    )
  }

  return indexCache
}

/**
 * Convierte la máscara en un canvas de alfa listo para recortar, del tamaño
 * exacto del recuadro de la persona.
 *
 * `sourceRect` es la MISMA región (en px de la máscara, que comparte
 * resolución con la foto capturada) que se usa para recortar el color en
 * `pipeline.ts`. Sin recortar aquí ese mismo rectángulo antes de escalar, la
 * máscara reflejaría el encuadre de foto completa mientras el color ya viene
 * recortado al de la caja — quedarían descuadrados entre sí.
 *
 * Orden: umbral (0/1) → erosión, para arrancar el halo del fondo que
 * suele quedar pegado al contorno → recorte + escalado a caja con
 * `filter: blur()` para el difuminado final del borde (2-3 px). Sin ese
 * difuminado el recorte se ve duro y arruina la pieza.
 */
export function buildMaskCanvas(
  mask: PersonMask,
  sourceRect: Rect,
  targetWidth: number,
  targetHeight: number,
): OffscreenCanvas {
  const { width, height } = mask
  const alpha = new Uint8ClampedArray(width * height)
  const threshold = PERSON.maskThreshold

  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = mask.data[i] >= threshold ? 255 : 0
  }

  // Erosión en px de la máscara: el mismo `maskErodePx` (definido en px de
  // salida) se traduce al espacio de origen según cuánto se va a ampliar
  // `sourceRect` al escalarlo a `targetWidth`.
  const erodeRadius = Math.round((PERSON.maskErodePx * sourceRect.width) / targetWidth)
  const eroded = erodeRadius > 0 ? erode(alpha, width, height, erodeRadius) : alpha

  const image = new ImageData(width, height)
  for (let i = 0; i < eroded.length; i++) {
    const offset = i * 4
    image.data[offset] = 255
    image.data[offset + 1] = 255
    image.data[offset + 2] = 255
    image.data[offset + 3] = eroded[i]
  }

  const small = new OffscreenCanvas(width, height)
  const smallCtx = small.getContext('2d')
  if (!smallCtx) throw new Error('No se pudo crear el canvas de máscara')
  smallCtx.putImageData(image, 0, 0)

  const target = new OffscreenCanvas(targetWidth, targetHeight)
  const targetCtx = target.getContext('2d')
  if (!targetCtx) throw new Error('No se pudo escalar la máscara')
  targetCtx.imageSmoothingEnabled = true
  targetCtx.imageSmoothingQuality = 'high'
  targetCtx.filter = `blur(${PERSON.featherPx}px)`
  targetCtx.drawImage(
    small,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    targetWidth,
    targetHeight,
  )
  targetCtx.filter = 'none'

  return target
}

/** Filtro de mínimo separable: contrae la máscara `radius` px. */
function erode(alpha: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const horizontal = new Uint8ClampedArray(alpha.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let min = 255
      for (let dx = -radius; dx <= radius; dx++) {
        const sx = x + dx
        if (sx < 0 || sx >= width) continue
        const value = alpha[row + sx]
        if (value < min) min = value
        if (min === 0) break
      }
      horizontal[row + x] = min
    }
  }

  const output = new Uint8ClampedArray(alpha.length)
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let min = 255
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = y + dy
        if (sy < 0 || sy >= height) continue
        const value = horizontal[sy * width + x]
        if (value < min) min = value
        if (min === 0) break
      }
      output[y * width + x] = min
    }
  }

  return output
}
