import { useCallback, useState } from 'react'
import { BRAND, CAMERA, DEBUG, FRAMING, LAYOUT, TIMING } from '../config'
import { Countdown } from '../components/Countdown'
import { FramingDebugHUD } from '../components/FramingDebugHUD'
import { FramingGuide } from '../components/FramingGuide'
import { ScreenLayer } from '../components/Stage'
import { CameraIcon } from '../components/icons'
import { useCamera } from '../hooks/useCamera'
import { useFaceGuide } from '../hooks/useFaceGuide'
import { captureFrame } from '../lib/capture'
import { guideMessage, isCaptureEnabled } from '../vision/faceValidation'
import { useKioskStore } from '../store/kioskStore'

const L = LAYOUT.capture

type Phase = 'framing' | 'countdown' | 'flash'

/**
 * 03 · TOMA DE FOTO
 * Vídeo a sangre (única pantalla sin arco de marca), guía de medio cuerpo,
 * validación por detección de rostro y cuenta regresiva.
 * Al desmontarse, `useCamera` para los tracks del stream.
 */
export function CaptureScreen() {
  const { videoRef, state: cameraState, error: cameraError } = useCamera(true)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<Phase>('framing')

  const setCaptured = useKioskStore((s) => s.setCaptured)
  const startProcessing = useKioskStore((s) => s.startProcessing)
  const backToWords = useKioskStore((s) => s.backToWords)
  const storeError = useKioskStore((s) => s.error)

  const { status, faceRect } = useFaceGuide(videoEl, cameraState === 'ready' && phase === 'framing')

  // El ref callback de <video> no dispara render; se refleja en estado para que
  // el hook de detección reciba el elemento en cuanto exista.
  const attachVideo = useCallback(
    (element: HTMLVideoElement | null) => {
      videoRef.current = element
      setVideoEl(element)
    },
    [videoRef],
  )

  const shoot = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    try {
      const frame = captureFrame(video)
      setCaptured(frame)
      setPhase('flash')
      window.setTimeout(startProcessing, TIMING.flashMs)
    } catch (err) {
      console.error('[capture] no se pudo congelar el frame', err)
      setPhase('framing')
    }
  }, [videoRef, setCaptured, startProcessing])

  // La cámara lista manda siempre: `captureFrame` lanza si el <video> todavía
  // no tiene dimensiones. Lo que `DEBUG.captureAlwaysEnabled` se salta es solo
  // la validación de encuadre, para poder disparar sin esperar al fallback.
  const enabled = cameraState === 'ready' && (DEBUG.captureAlwaysEnabled || isCaptureEnabled(status))
  const showError = cameraState === 'error'

  /**
   * Texto de la banda inferior.
   *
   * Los errores se muestran SIEMPRE. Apagar `FRAMING.ui.message` silencia la
   * ayuda de encuadre, no los fallos: dejar a alguien delante de una cámara
   * rota sin explicación sería otra cosa muy distinta de lo que se pidió.
   */
  const message = showError
    ? (cameraError ?? 'Cámara no disponible')
    : (storeError ?? (FRAMING.ui.message ? guideMessage(status) : ''))

  return (
    <ScreenLayer className="bg-black">
      <video
        ref={attachVideo}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: CAMERA.mirrorPreview ? 'scaleX(-1)' : undefined }}
      />

      {phase === 'framing' && FRAMING.ui.guide && <FramingGuide status={status} />}

      {DEBUG.framingHud && <FramingDebugHUD status={status} faceRect={faceRect} />}

      {phase === 'countdown' && <Countdown onComplete={shoot} />}

      {phase === 'flash' && (
        <div className="absolute inset-0 bg-white" style={{ animation: `flash ${TIMING.flashMs}ms ease-out forwards` }} />
      )}

      {/* Banda inferior translúcida sobre la que van los controles. */}
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0"
        style={{
          top: L.bottomBar.top,
          background: 'linear-gradient(to bottom, rgba(46,4,14,0) 0%, rgba(46,4,14,0.5) 22%, rgba(46,4,14,0.62) 100%)',
        }}
      />

      {phase === 'framing' && (
        <>
          <button
            type="button"
            onClick={backToWords}
            className="kiosk-button absolute"
            style={{
              left: L.back.x,
              top: L.back.y,
              fontSize: L.back.fontSize,
              color: 'rgba(255,255,255,0.9)',
              fontFamily: BRAND.fonts.body,
              letterSpacing: '0.16em',
              textShadow: '0 2px 14px rgba(0,0,0,0.7)',
            }}
          >
            ← VOLVER
          </button>

          {message && (
            <p
              className="pointer-events-none absolute left-0 right-0 text-center"
              style={{
                top: L.status.top,
                fontSize: L.status.fontSize,
                color: BRAND.colors.white,
                fontFamily: BRAND.fonts.body,
                textShadow: '0 4px 22px rgba(0,0,0,0.75)',
              }}
            >
              {message}
            </p>
          )}

          <CameraIcon
            size={L.cameraIcon.size}
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ top: L.cameraIcon.top, color: BRAND.colors.white }}
          />

          <button
            type="button"
            onClick={() => setPhase('countdown')}
            disabled={!enabled}
            className="kiosk-button absolute transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40"
            style={{
              left: L.shutter.x,
              top: L.shutter.y,
              width: L.shutter.width,
              height: L.shutter.height,
              borderRadius: L.shutter.radius,
              background: BRAND.colors.primary,
              color: BRAND.colors.white,
              fontFamily: BRAND.fonts.display,
              fontSize: L.shutter.fontSize,
              letterSpacing: '0.04em',
              boxShadow: '0 14px 34px rgba(0,0,0,0.4)',
            }}
          >
            TOMAR FOTO
          </button>
        </>
      )}
    </ScreenLayer>
  )
}
