import type { CSSProperties, ReactNode } from 'react'
import { DESIGN } from '../config'
import { useStageScale } from '../hooks/useStageScale'

/**
 * Escenario del kiosco: un lienzo fijo de 1080x1920 escalado por CSS y
 * centrado sobre fondo negro. Los hijos se escriben en px de diseño y no
 * necesitan saber nada del tamaño real de la pantalla.
 */
export function Stage({ children }: { children: ReactNode }) {
  const scale = useStageScale()

  const style: CSSProperties = {
    width: DESIGN.width,
    height: DESIGN.height,
    transform: `translate(-50%, -50%) scale(${scale})`,
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div className="absolute left-1/2 top-1/2 origin-center" style={style}>
        {children}
      </div>
    </div>
  )
}

/** Contenedor de una pantalla: ocupa el escenario completo. */
export function ScreenLayer({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`absolute overflow-hidden inset-0 ${className}`} style={style}>
      {children}
    </div>
  )
}
