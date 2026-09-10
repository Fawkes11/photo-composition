import { useCallback, useEffect, useRef, useState } from 'react'
import { CAMERA } from '../config'

export type CameraState = 'idle' | 'starting' | 'ready' | 'error'

/**
 * Ciclo de vida del stream de la webcam.
 *
 * Lo importante para un kiosco: al salir de la pantalla de cámara se paran
 * TODOS los tracks y se suelta el srcObject. Un track vivo mantiene el
 * dispositivo abierto, el LED encendido y un buffer de frames por sesión; con
 * 300 ciclos eso es una pestaña muerta y un usuario preguntando por qué la
 * cámara sigue grabando.
 */
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<CameraState>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      streamRef.current = null
    }
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
      // Sin esto, Chrome conserva el último frame decodificado en memoria.
      video.removeAttribute('src')
      video.load()
    }
  }, [])

  useEffect(() => {
    if (!active) return

    let cancelled = false

    const start = async () => {
      setState('starting')
      setError(null)

      for (let attempt = 0; attempt <= CAMERA.retries; attempt++) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(CAMERA.constraints)
          if (cancelled) {
            for (const track of stream.getTracks()) track.stop()
            return
          }
          const video = videoRef.current
          if (!video) {
            for (const track of stream.getTracks()) track.stop()
            return
          }
          streamRef.current = stream
          video.srcObject = stream
          await video.play()
          if (cancelled) return
          setState('ready')
          return
        } catch (err) {
          if (cancelled) return
          if (attempt === CAMERA.retries) {
            console.error('[camera] no se pudo abrir el dispositivo', err)
            setError(
              err instanceof DOMException && err.name === 'NotAllowedError'
                ? 'Permiso de cámara denegado.'
                : 'No se encontró la cámara.',
            )
            setState('error')
            return
          }
          await new Promise((resolve) => setTimeout(resolve, CAMERA.retryDelayMs))
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stop()
    }
  }, [active, stop])

  // Mientras la pantalla no está activa el estado interno da igual: lo que ve
  // quien consume el hook es 'idle' hasta que arranque de nuevo.
  return { videoRef, state: active ? state : 'idle', error: active ? error : null, stop }
}
