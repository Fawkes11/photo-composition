import { DESIGN, FRAMING } from '../config'
import { pointInRect, type Rect } from '../lib/geometry'
import type { GuideStatus } from '../vision/faceValidation'

/**
 * HUD de calibración de la guía de encuadre. Solo para desarrollo — se activa
 * con `DEBUG.framingHud` en config.ts.
 *
 * Enseña en vivo los números que decide `evaluateFraming` (src/vision/faceValidation.ts)
 * para no tener que adivinar por qué el estado no llega a 'ok': cuánto mide el
 * rostro detectado contra el rango permitido, y si el centro cae dentro de la
 * zona de cabeza. Ajusta `FRAMING` en config.ts hasta que estos números casen
 * con lo que ves en la cámara real del kiosco (no en el celular: el FOV y la
 * distancia de una selfie no se parecen a los de una webcam de escritorio).
 */
export function FramingDebugHUD({ status, faceRect }: { status: GuideStatus; faceRect: Rect | null }) {
  const widthRatio = faceRect ? faceRect.width / DESIGN.width : null
  const center = faceRect ? { x: faceRect.x + faceRect.width / 2, y: faceRect.y + faceRect.height / 2 } : null
  const inZone = center ? pointInRect(center, FRAMING.headZone) : null

  return (
    <>
      {/* Rectángulo de la zona de cabeza objetivo, en amarillo. */}
      <div
        className="pointer-events-none absolute border-2 border-yellow-300"
        style={{
          left: FRAMING.headZone.x,
          top: FRAMING.headZone.y,
          width: FRAMING.headZone.width,
          height: FRAMING.headZone.height,
        }}
      />
      {/* Caja del rostro detectado, en verde lima. */}
      {faceRect && (
        <div
          className="pointer-events-none absolute border-2 border-lime-400"
          style={{ left: faceRect.x, top: faceRect.y, width: faceRect.width, height: faceRect.height }}
        />
      )}

      <div
        className="pointer-events-none absolute left-[20px] rounded-md bg-black/80 p-[14px] font-mono text-[20px] leading-[1.5] text-lime-300"
        style={{ top: 130, width: 480 }}
      >
        <div>estado: <b className="text-white">{status}</b></div>
        <div>
          ancho rostro: {widthRatio === null ? '—' : `${(widthRatio * 100).toFixed(1)}%`}
          {'  '}(rango válido: {(FRAMING.faceWidthRatio.min * 100).toFixed(0)}–{(FRAMING.faceWidthRatio.max * 100).toFixed(0)}%)
        </div>
        <div>
          {widthRatio !== null &&
            (widthRatio < FRAMING.faceWidthRatio.min
              ? '↑ por debajo del mínimo → "too_far" (acércate)'
              : widthRatio > FRAMING.faceWidthRatio.max
                ? '↓ por encima del máximo → "too_close" (aléjate)'
                : '✓ ancho dentro de rango')}
        </div>
        <div>centro en zona de cabeza: {inZone === null ? '—' : inZone ? 'sí ✓' : 'no ✗'}</div>
      </div>
    </>
  )
}
