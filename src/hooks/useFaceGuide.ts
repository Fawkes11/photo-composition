import { useEffect, useRef, useState } from 'react'
import { CAMERA, DETECTION, FRAMING } from '../config'
import { evaluateFraming, type GuideStatus } from '../vision/faceValidation'
import { loadFaceDetector } from '../vision/visionLoader'
import type { Rect } from '../lib/geometry'

/**
 * Loop de detección sobre el <video> en vivo.
 *
 * Reglas de la pantalla 03:
 *  - un solo rostro, dentro de la guía, a la distancia correcta → estado OK;
 *  - el estado se confirma por frames consecutivos, no por frame suelto: si no,
 *    la guía parpadea con cada respiración;
 *  - NUNCA se bloquea al usuario. Hay dos escapes, y los dos cuelgan de
 *    temporizadores propios, no del bucle de rAF: si el navegador estrangula
 *    los frames (pestaña de fondo, equipo saturado) el escape debe saltar igual.
 *      · a los 8 s sin ninguna detección → encuadre por defecto;
 *      · a los 16 s pase lo que pase → se habilita la captura aunque el modelo
 *        vea a la persona pero no dé nunca el encuadre por bueno.
 */
export function useFaceGuide(video: HTMLVideoElement | null, enabled: boolean) {
  const [status, setStatus] = useState<GuideStatus>('loading')
  const [faceRect, setFaceRect] = useState<Rect | null>(null)
  /** Escapes por tiempo, independientes del bucle de inferencia. */
  const [escape, setEscape] = useState<'none' | 'noDetection' | 'forced'>('none')

  // Se llevan en refs: cambian cada frame y no deben provocar renders.
  const validFramesRef = useRef(0)
  const invalidFramesRef = useRef(0)
  const isValidRef = useRef(false)
  const lastInferenceRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const everDetectedRef = useRef(false)

  useEffect(() => {
    if (!enabled || !video) return

    let rafId = 0
    let cancelled = false
    let detector: Awaited<ReturnType<typeof loadFaceDetector>> | null = null

    validFramesRef.current = 0
    invalidFramesRef.current = 0
    isValidRef.current = false
    lastInferenceRef.current = 0
    lastVideoTimeRef.current = -1
    everDetectedRef.current = false

    const softTimer = window.setTimeout(() => {
      if (!everDetectedRef.current) setEscape((current) => (current === 'none' ? 'noDetection' : current))
    }, DETECTION.fallbackAfterMs)

    const hardTimer = window.setTimeout(() => setEscape('forced'), DETECTION.forceEnableAfterMs)

    const minInterval = 1000 / DETECTION.previewFps

    const tick = () => {
      if (cancelled) return
      rafId = requestAnimationFrame(tick)

      if (!detector || video.readyState < 2 || video.videoWidth === 0) return

      // Limitar la tasa de inferencia y saltar frames repetidos del vídeo.
      const now = performance.now()
      if (now - lastInferenceRef.current < minInterval) return
      if (video.currentTime === lastVideoTimeRef.current) return
      lastInferenceRef.current = now
      lastVideoTimeRef.current = video.currentTime

      let evaluation
      try {
        const result = detector.detectForVideo(video, now)
        evaluation = evaluateFraming(
          result.detections,
          video.videoWidth,
          video.videoHeight,
          CAMERA.mirrorPreview,
          isValidRef.current,
        )
      } catch (err) {
        console.warn('[guide] fallo de inferencia', err)
        return
      }

      if (evaluation.faceRect) everDetectedRef.current = true
      setFaceRect(evaluation.faceRect)

      if (evaluation.status === 'ok') {
        validFramesRef.current++
        invalidFramesRef.current = 0
      } else {
        invalidFramesRef.current++
        validFramesRef.current = 0
      }

      if (!isValidRef.current && validFramesRef.current >= FRAMING.framesToConfirm) {
        isValidRef.current = true
      } else if (isValidRef.current && invalidFramesRef.current >= FRAMING.framesToRelease) {
        isValidRef.current = false
      }

      setStatus(isValidRef.current ? 'ok' : evaluation.status)
    }

    loadFaceDetector()
      .then((instance) => {
        if (cancelled) return
        detector = instance
        setStatus('searching')
      })
      .catch((err) => {
        console.error('[guide] el detector no cargó; se habilita el modo por defecto', err)
        if (!cancelled) setEscape('forced')
      })

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(softTimer)
      window.clearTimeout(hardTimer)
      // Al apagarse la pantalla se reinician los escapes: la próxima sesión
      // vuelve a contar sus 8 y 16 segundos desde cero.
      setEscape('none')
      setStatus('loading')
      // El detector es singleton compartido: no se cierra aquí.
    }
  }, [video, enabled])

  // Con la pantalla apagada el último estado no significa nada.
  if (!enabled || !video) return { status: 'loading' as GuideStatus, faceRect: null }

  // El encuadre válido manda sobre cualquier escape: si está bien colocada, la
  // guía debe decírselo aunque el reloj ya la hubiera liberado.
  if (status === 'ok') return { status, faceRect }
  if (escape !== 'none') return { status: 'fallback' as GuideStatus, faceRect }
  return { status, faceRect }
}
