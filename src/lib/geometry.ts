export type Rect = { x: number; y: number; width: number; height: number }

/**
 * Mapeo "cover": cómo se dibuja una fuente (el video) dentro de un destino
 * (el escenario / la pieza) llenándolo por completo y recortando el sobrante.
 *
 * Es el mismo mapeo que usan tres sitios distintos, y por eso vive aquí:
 *   1. el <video> del preview (via CSS object-fit: cover),
 *   2. la validación del encuadre (pasa la caja del rostro de px de video a px
 *      de escenario, para compararla contra la guía dibujada),
 *   3. la captura (recorta el frame exactamente igual que lo que se vio).
 * Si los tres no coinciden, la guía miente.
 */
export type CoverMapping = {
  /** Factor fuente → destino. */
  scale: number
  /** Desplazamiento en px de destino (negativo: la fuente sobresale). */
  offsetX: number
  offsetY: number
  /** Región de la fuente que acaba siendo visible, en px de fuente. */
  sourceRect: Rect
}

export function computeCover(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): CoverMapping {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight)
  const drawnWidth = sourceWidth * scale
  const drawnHeight = sourceHeight * scale
  const offsetX = (destWidth - drawnWidth) / 2
  const offsetY = (destHeight - drawnHeight) / 2
  return {
    scale,
    offsetX,
    offsetY,
    sourceRect: {
      x: -offsetX / scale,
      y: -offsetY / scale,
      width: destWidth / scale,
      height: destHeight / scale,
    },
  }
}

/** Igual que computeCover pero conteniendo la fuente entera (letterbox). */
export function computeContain(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
): CoverMapping {
  const scale = Math.min(destWidth / sourceWidth, destHeight / sourceHeight)
  const offsetX = (destWidth - sourceWidth * scale) / 2
  const offsetY = (destHeight - sourceHeight * scale) / 2
  return {
    scale,
    offsetX,
    offsetY,
    sourceRect: { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
  }
}

/**
 * Lleva un rectángulo en px de fuente a px de destino según el mapeo,
 * espejándolo horizontalmente si el destino se muestra en espejo.
 */
export function mapRect(rect: Rect, mapping: CoverMapping, destWidth: number, mirrored: boolean): Rect {
  const x = rect.x * mapping.scale + mapping.offsetX
  const y = rect.y * mapping.scale + mapping.offsetY
  const width = rect.width * mapping.scale
  const height = rect.height * mapping.scale
  return { x: mirrored ? destWidth - (x + width) : x, y, width, height }
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function pointInRect(point: { x: number; y: number }, rect: Rect, padding = 0): boolean {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  )
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}
