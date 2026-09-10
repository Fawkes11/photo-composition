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
  }, [armed, screen, reset])

  return { warningSecondsLeft }
}
