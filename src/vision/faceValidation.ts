import { DESIGN, FRAMING } from '../config'
import { computeCover, mapRect, pointInRect, type Rect } from '../lib/geometry'
import type { Detection } from '@mediapipe/tasks-vision'

/**
 * Validación del encuadre de medio cuerpo.
 *
 * La detección llega en px del video; la guía está dibujada en px de escenario.
 * Todo se traduce a escenario con el MISMO mapeo cover que usa el <video> y que
 * usará la captura: así lo que valida la guía es literalmente lo que se ve.
 */

export type GuideStatus =
  | 'loading' // wasm/modelo aún cargando
  | 'searching' // no hay rostro
  | 'multiple' // más de una persona
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'ok'
  | 'fallback' // pasaron los 8s sin detección: se habilita igual

export type GuideEvaluation = {
  status: GuideStatus
  /** Caja del rostro en px de escenario, para depurar y para el HUD. */
  faceRect: Rect | null
}

const MESSAGES: Record<GuideStatus, string> = {
  loading: 'Preparando la cámara…',
  searching: 'Colócate dentro de la guía',
  multiple: 'Solo una persona en cuadro',
  too_far: 'Acércate un poco',
  too_close: 'Aléjate un poco',
  off_center: 'Céntrate en la guía',
  ok: '¡Así! No te muevas',
  fallback: 'Cuando quieras, toma la foto',
}

export function guideMessage(status: GuideStatus): string {
  return MESSAGES[status]
}

export function isCaptureEnabled(status: GuideStatus): boolean {
  return status === 'ok' || status === 'fallback'
}

/**
 * Evalúa un resultado de detección contra la guía.
 *
 * @param wasValid estado previo, para aplicar histéresis: una vez dentro, los
 *        umbrales se ensanchan un poco y el usuario deja de ver la guía
 *        parpadear cuando respira.
 */
export function evaluateFraming(
  detections: readonly Detection[],
  videoWidth: number,
  videoHeight: number,
  mirrored: boolean,
  wasValid: boolean,
): GuideEvaluation {
  if (detections.length === 0) return { status: 'searching', faceRect: null }
  if (detections.length > 1) return { status: 'multiple', faceRect: null }

  const box = detections[0].boundingBox
  if (!box) return { status: 'searching', faceRect: null }

  const mapping = computeCover(videoWidth, videoHeight, DESIGN.width, DESIGN.height)
  const faceRect = mapRect(
    { x: box.originX, y: box.originY, width: box.width, height: box.height },
    mapping,
    DESIGN.width,
    mirrored,
  )

  const slack = wasValid ? FRAMING.hysteresis : 0
  const widthRatio = faceRect.width / DESIGN.width

  if (widthRatio < FRAMING.faceWidthRatio.min - slack) return { status: 'too_far', faceRect }
  if (widthRatio > FRAMING.faceWidthRatio.max + slack) return { status: 'too_close', faceRect }

  const center = { x: faceRect.x + faceRect.width / 2, y: faceRect.y + faceRect.height / 2 }
  const padding = slack * DESIGN.width
  if (!pointInRect(center, FRAMING.headZone, padding)) return { status: 'off_center', faceRect }

  return { status: 'ok', faceRect }
}
