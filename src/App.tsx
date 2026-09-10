import { useEffect } from 'react'
import { BRAND } from './config'
import { Stage } from './components/Stage'
import { useIdleReset } from './hooks/useIdleReset'
import { CaptureScreen } from './screens/CaptureScreen'
import { ProcessingScreen } from './screens/ProcessingScreen'
import { ResultScreen } from './screens/ResultScreen'
import { StartScreen } from './screens/StartScreen'
import { WordScreen } from './screens/WordScreen'
import { useKioskStore } from './store/kioskStore'

/**
 * Raíz del kiosco. Sin router: la pantalla la decide el store.
 * Cada pantalla lleva `key` propia para que al cambiar se desmonte de verdad —
 * es lo que garantiza que la cámara suelte sus tracks al salir de la 03.
 */
export default function App() {
  const screen = useKioskStore((s) => s.screen)
  const { warningSecondsLeft } = useIdleReset()

  useKioskGestures()

  return (
    <Stage>
      {screen === 'start' && <StartScreen key="start" />}
      {screen === 'word' && <WordScreen key="word" />}
      {screen === 'capture' && <CaptureScreen key="capture" />}
      {screen === 'processing' && <ProcessingScreen key="processing" />}
      {screen === 'result' && <ResultScreen key="result" />}

      {warningSecondsLeft !== null && <IdleWarning seconds={warningSecondsLeft} />}
    </Stage>
  )
}

function IdleWarning({ seconds }: { seconds: number }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-[46px] py-[22px] text-[32px]"
      style={{
        bottom: 40,
        background: 'rgba(0,0,0,0.72)',
        border: '2px solid rgba(255,255,255,0.2)',
        color: BRAND.colors.white,
        fontFamily: BRAND.fonts.body,
      }}
    >
      ¿Sigues ahí? Volvemos al inicio en {seconds}s
    </div>
  )
}

/**
 * Comportamiento de kiosco: sin menú contextual, sin selección de texto, sin
 * zoom por gesto ni por doble toque.
 *
 * Lo que no se puede resolver desde CSS se bloquea aquí. El scroll de la
 * pantalla 02 sigue funcionando porque su contenedor declara `touch-action:
 * pan-y`; lo que se cancela es solo el gesto multitáctil.
 */
function useKioskGestures() {
  useEffect(() => {
    const blockContextMenu = (event: Event) => event.preventDefault()
    const blockMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault()
    }
    const blockGesture = (event: Event) => event.preventDefault()

    let lastTouchEnd = 0
    const blockDoubleTapZoom = (event: TouchEvent) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 320) event.preventDefault()
      lastTouchEnd = now
    }

    document.addEventListener('contextmenu', blockContextMenu)
    document.addEventListener('touchstart', blockMultiTouch, { passive: false })
    document.addEventListener('touchend', blockDoubleTapZoom, { passive: false })
    // Safari/iPadOS: el pellizco llega como 'gesture*', no como touch múltiple.
    document.addEventListener('gesturestart', blockGesture)
    document.addEventListener('gesturechange', blockGesture)

    return () => {
      document.removeEventListener('contextmenu', blockContextMenu)
      document.removeEventListener('touchstart', blockMultiTouch)
      document.removeEventListener('touchend', blockDoubleTapZoom)
      document.removeEventListener('gesturestart', blockGesture)
      document.removeEventListener('gesturechange', blockGesture)
    }
  }, [])
}
