import { useState, type CSSProperties, type ReactNode } from 'react'
import { BRAND, MISSING_ASSET } from '../config'

/**
 * Marcadores de material pendiente.
 *
 * Turquesa sobre rojo de marca: imposible confundirlo con diseño terminado.
 * El marcador ocupa exactamente el hueco del recurso definitivo, así la maqueta
 * se revisa entera aunque falten piezas.
 *
 * Dos intensidades, según haya o no algo que enseñar debajo:
 *  - hueco vacío     → trama diagonal y etiqueta centrada. Imposible ignorarlo.
 *  - hay aproximación → filo fino y una chapa en la esquina, para no tapar lo
 *                       que sí se puede ir revisando.
 *
 * Se apagan de golpe con `MISSING_ASSET.show = false` en config.
 */

function Chip({ text, corner = false }: { text: string; corner?: boolean }) {
  return (
    <span
      className={
        corner
          ? 'pointer-events-none absolute left-0 top-0 rounded-br px-[10px] py-[5px] text-[18px] leading-none'
          : 'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded px-[14px] py-[7px] text-[22px] leading-none'
      }
      style={{
        background: MISSING_ASSET.color,
        color: BRAND.colors.black,
        fontFamily: BRAND.fonts.body,
        fontWeight: 700,
      }}
    >
      {text}
    </span>
  )
}

export function MissingAsset({
  label,
  style,
  className = '',
  children,
}: {
  label: string
  style?: CSSProperties
  className?: string
  /** Aproximación provisional. Si se pasa, el marcador se vuelve discreto. */
  children?: ReactNode
}) {
  if (!MISSING_ASSET.show) {
    return children ? (
      <div className={className} style={{ position: 'absolute', ...style }}>
        {children}
      </div>
    ) : null
  }

  const hasApproximation = Boolean(children)

  return (
    <div className={`missing-asset ${className}`} style={{ position: 'absolute', ...style }}>
      {children}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          border: `${hasApproximation ? 2 : 3}px dashed ${MISSING_ASSET.color}`,
          background: hasApproximation
            ? 'transparent'
            : `repeating-linear-gradient(45deg, ${MISSING_ASSET.tint} 0 22px, ${MISSING_ASSET.stripe} 22px 44px)`,
        }}
      />
      <Chip text={`FALTA · ${label}`} corner={hasApproximation} />
    </div>
  )
}

/**
 * Imagen que se degrada sola.
 *
 * Intenta cargar el archivo; si no está (404, o el diseñador aún no lo ha
 * entregado) pinta el marcador con su etiqueta. En cuanto el archivo aparece
 * con ese nombre en /public/images, la app lo usa sin tocar una línea.
 *
 * `issue` es para el caso contrario: el archivo existe pero tiene un problema
 * (p. ej. exportado sin canal alfa). Se pinta igual, con un aviso encima.
 */
export function AssetImage({
  src,
  label,
  alt,
  style,
  className = '',
  fit = 'contain',
  fallback,
  issue,
}: {
  src: string
  /** Texto del marcador si el archivo no existe. */
  label: string
  alt?: string
  style?: CSSProperties
  className?: string
  fit?: CSSProperties['objectFit']
  /** Aproximación a mostrar mientras falta el archivo (p. ej. un degradado). */
  fallback?: ReactNode
  /** Problema conocido del archivo entregado. */
  issue?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <MissingAsset label={label} className={className} style={style}>
        {fallback}
      </MissingAsset>
    )
  }

  const image = (
    <img
      src={src}
      alt={alt ?? ''}
      className={issue ? '' : className}
      style={issue ? { width: '100%', height: '100%', objectFit: fit } : { position: 'absolute', objectFit: fit, ...style }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  )

  if (!issue || !MISSING_ASSET.show) return image

  return (
    <div className={`missing-asset ${className}`} style={{ position: 'absolute', ...style }}>
      {image}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ border: `2px dashed ${MISSING_ASSET.color}` }}
      />
      <Chip text={`REVISAR · ${issue}`} corner />
    </div>
  )
}
