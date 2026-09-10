import { CAMERA, EXPORT } from '../config'
import { acquire, release } from './canvasPool'
import { computeCover } from './geometry'
import type { CapturedFrame } from '../store/kioskStore'

/**
 * Congela un frame del video en un ImageBitmap listo para el pipeline.
 *
 * Se recorta con el MISMO mapeo cover que usa el preview, así la foto contiene
 * exactamente lo que el usuario tenía dentro de la guía — ni un píxel más.
 *
 * Se captura a la resolución nativa del recorte, no a la de exportación: subir
 * de escala aquí y volver a escalar dentro de la caja de la persona sería
 * remuestrear dos veces. El pipeline lo hace una sola vez, al final.
 */
export function captureFrame(video: HTMLVideoElement): CapturedFrame {
  const { videoWidth, videoHeight } = video
  if (!videoWidth || !videoHeight) throw new Error('El video todavía no tiene dimensiones')

  const mapping = computeCover(videoWidth, videoHeight, EXPORT.width, EXPORT.height)
  const src = mapping.sourceRect
  const width = Math.round(src.width)
  const height = Math.round(src.height)

  const entry = acquire(width, height)
  try {
    const { ctx } = entry
    if (CAMERA.mirrorCapture) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, src.x, src.y, src.width, src.height, 0, 0, width, height)
    // transferToImageBitmap mueve el buffer en vez de copiarlo.
    return { bitmap: entry.canvas.transferToImageBitmap(), width, height }
  } finally {
    release(entry)
  }
}
