import { useEffect, useState } from 'react'
import { BRAND, LAYOUT, TIMING } from '../config'

const L = LAYOUT.capture.countdown

/**
 * Cuenta regresiva 3-2-1 antes del disparo.
 *
 * Anillo punteado con un arco de progreso que se vacía en cada segundo, según
 * la maqueta. Llama a `onComplete` una sola vez, al llegar a cero.
 */
export function Countdown({ onComplete }: { onComplete: () => void }) {
  const [value, setValue] = useState<number>(TIMING.countdownFrom)

  useEffect(() => {
    if (value <= 0) {
      onComplete()
      return
    }
    const id = window.setTimeout(() => setValue((v) => v - 1), TIMING.countdownStepMs)
    return () => window.clearTimeout(id)
  }, [value, onComplete])

  if (value <= 0) return null

  const radius = L.size / 2 - L.ring
  const circumference = 2 * Math.PI * radius

  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ top: L.centerY - L.size / 2, width: L.size, height: L.size }}
    >
      <svg width={L.size} height={L.size} viewBox={`0 0 ${L.size} ${L.size}`} aria-hidden="true">
        {/* Aro punteado de fondo. */}
        <circle
          cx={L.size / 2}
          cy={L.size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
          strokeDasharray="3 11"
          strokeLinecap="round"
        />
        {/* Arco de progreso: se vacía a lo largo del segundo. */}
        <circle
          key={value}
          className="countdown-sweep"
          cx={L.size / 2}
          cy={L.size / 2}
          r={radius}
          fill="none"
          stroke={BRAND.colors.white}
          strokeWidth={L.ring}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${L.size / 2} ${L.size / 2})`}
          style={{ ['--sweep' as string]: `${circumference}px`, animationDuration: `${TIMING.countdownStepMs}ms` }}
        />
      </svg>

      <span
        key={`n${value}`}
        className="countdown-pop absolute inset-0 flex items-center justify-center"
        style={{
          color: BRAND.colors.white,
          fontFamily: BRAND.fonts.display,
          fontSize: L.fontSize,
          lineHeight: 1,
          textShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
