import type { CSSProperties } from 'react'
import { REVLON_LOGO_PATH, REVLON_LOGO_VIEWBOX } from '../lib/brandLogo'

/**
 * Wordmark oficial de Revlon, en SVG puro.
 *
 * Reusable: se le da un ancho y un color, y calcula el alto solo respetando
 * la proporción real del logotipo (316:52). El mismo trazado (`REVLON_LOGO_PATH`
 * en `src/lib/brandLogo.ts`) es el que se rasteriza para la pieza final en
 * canvas — un solo dibujo, nunca se desincronizan.
 */
export function RevlonLogo({
  width = 240,
  color = '#000000',
  className,
  style,
}: {
  /** Ancho en px. El alto sale solo de la proporción real del logotipo. */
  width?: number
  color?: string
  className?: string
  style?: CSSProperties
}) {
  const height = (width / REVLON_LOGO_VIEWBOX.width) * REVLON_LOGO_VIEWBOX.height

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${REVLON_LOGO_VIEWBOX.width} ${REVLON_LOGO_VIEWBOX.height}`}
      className={className}
      style={style}
      role="img"
      aria-label="Revlon"
    >
      <path d={REVLON_LOGO_PATH} fill={color} />
    </svg>
  )
}
