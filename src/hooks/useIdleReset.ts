import { useEffect, useRef, useState } from 'react'
import { TIMING, UI } from '../config'
import { useKioskStore } from '../store/kioskStore'

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const

/**
 * Reset a la pantalla 01 tras inactividad, desde cualquier paso.
 *
 * Se engancha una sola vez a nivel de app (no por pantalla) para que el
 * temporizador sobreviva a los cambios de pantalla y no se reinicie solo por
 * navegar. Devuelve los segundos que quedan cuando entra en la ventana de
 * aviso, para que la UI pueda avisar antes de borrar la sesión de alguien.
 */
export function useIdleReset() {
  const screen = useKioskStore((s) => s.screen)
  const reset = useKioskStore((s) => s.reset)
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null)
  // Se inicializa dentro del efecto: leer el reloj durante el render no es puro.
  const lastActivityRef = useRef(0)

  const armed = !(TIMING.idleIgnoreOnStart && screen === 'start')

  useEffect(() => {
    if (!armed) return
    lastActivityRef.current = Date.now()

    const markActivity = () => {
      lastActivityRef.current = Date.now()
      // Pasar siempre null deja que React descarte el render cuando ya era null,
      // así un pointermove no vuelve a renderizar el árbol entero.
      setWarningSecondsLeft(null)
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true })
    }

    // Un intervalo en vez de un timeout re-armado: sobrevive a la suspensión
    // de timers en pestañas de fondo y no acumula temporizadores huérfanos.
    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      if (idleMs >= TIMING.idleResetMs) {
        // El aviso muere con la sesión que anunciaba. Sin esto se quedaba con
        // su último valor ("…en 1s") y sobrevivía al reset.
        setWarningSecondsLeft(null)
        reset()
        return
      }
      const remaining = TIMING.idleResetMs - idleMs
      setWarningSecondsLeft(remaining <= UI.idleWarningMs ? Math.ceil(remaining / 1000) : null)
    }, 500)

    return () => {
      window.clearInterval(interval)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, markActivity)
    }
    // `screen` NO va en las dependencias a propósito: dentro del efecto no se
    // usa, solo a través de `armed`. Incluirlo reiniciaba el temporizador en
    // cada cambio de pantalla, justo lo contrario de lo que dice la cabecera.
  }, [armed, reset])

  // El aviso se DERIVA de `armed` en vez de apagarse a mano. Mientras se
  // limpiaba por separado, uno que estuviera en pantalla al saltar el reset
  // sobrevivía al salto al inicio: allí el efecto sale antes de enganchar los
  // listeners de actividad, así que ya no quedaba nada capaz de borrarlo.
  // Derivándolo, en el inicio no puede verse aunque el estado siga puesto.
  return { warningSecondsLeft: armed ? warningSecondsLeft : null }
}
