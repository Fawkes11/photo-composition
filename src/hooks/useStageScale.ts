import { useEffect, useState } from 'react'
import { DESIGN } from '../config'

/**
 * Factor de escala del escenario de autoría (1080x1920) al viewport real.
 *
 * Toda la UI se escribe en px de DESIGN y se escala una sola vez por CSS. Sale
 * más barato que hacer todo responsive y, sobre todo, hace que la guía de
 * encuadre y la pieza compartan un único sistema de coordenadas.
 */
export function useStageScale(): number {
  const [scale, setScale] = useState(() => computeScale())

  useEffect(() => {
    const update = () => setScale(computeScale())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    // El teclado virtual y las barras del navegador cambian el viewport visual
    // sin disparar 'resize' en algunos Android.
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return scale
}

function computeScale(): number {
  if (typeof window === 'undefined') return 1
  const width = window.visualViewport?.width ?? window.innerWidth
  const height = window.visualViewport?.height ?? window.innerHeight
  return Math.min(width / DESIGN.width, height / DESIGN.height)
}
