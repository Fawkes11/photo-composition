/**
 * Iconografía de línea de las maquetas, dibujada en SVG.
 *
 * Son formas simples: sale mejor tenerlas vectoriales y coloreables por
 * `currentColor` que pedir cinco PNG más al diseñador.
 */

import type { CSSProperties } from 'react'

type IconProps = { size: number; className?: string; style?: CSSProperties }

/** Mano tocando la pantalla — cabecera de la tarjeta de instrucciones. */
export function TapIcon({ size, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 5.5 6.4 3.6M12.4 4l.5-2.4M4 9.6l-2.3-.5" />
        <path d="M13.2 12.6V8.2a1.7 1.7 0 0 1 3.4 0v7.3" />
        <path d="M16.6 14.2a1.6 1.6 0 0 1 3.2 0v1.4M19.8 15.1a1.6 1.6 0 0 1 3.2 0v1.6M23 16.4a1.6 1.6 0 0 1 3.2 0v4.4c0 4.6-3 8.2-7.4 8.2-3.6 0-5.6-1.6-7.2-4.4l-3.1-5.4a1.7 1.7 0 0 1 2.9-1.7l1.8 2.8" />
      </g>
    </svg>
  )
}

/** Cámara — sobre el botón de disparo. */
export function CameraIcon({ size, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5h4.2l2-3h9.6l2 3H25a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
        <circle cx="15" cy="18.5" r="5" />
        <path d="M27.5 5.5 29 4M25.5 3.5 26 1.6M29.6 8.4l2-.4" />
      </g>
    </svg>
  )
}

/** Persona dentro de un móvil — paso 3 de la tarjeta. */
export function SelfiePhoneIcon({ size, className, style }: IconProps) {
  return (
    <svg width={size} height={size * 1.06} viewBox="0 0 34 36" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="30" height="32" rx="4" />
        <circle cx="17" cy="14" r="5.2" />
        <path d="M8.5 29c1.4-4.4 4.6-6.6 8.5-6.6s7.1 2.2 8.5 6.6" />
      </g>
    </svg>
  )
}

/** Código QR estilizado. */
export function QrIcon({ size, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" className={className} style={style} aria-hidden="true">
      <path d="M2 2h11v11H2V2Zm2.6 2.6v5.8h5.8V4.6H4.6Z" />
      <path d="M19 2h11v11H19V2Zm2.6 2.6v5.8h5.8V4.6h-5.8Z" />
      <path d="M2 19h11v11H2V19Zm2.6 2.6v5.8h5.8v-5.8H4.6Z" />
      <path d="M19 19h4.4v4.4H19V19Zm6.6 0H30v4.4h-4.4V19ZM19 25.6h4.4V30H19v-4.4Zm6.6 0H30V30h-4.4v-4.4Z" />
    </svg>
  )
}

/** Flecha recta corta entre el móvil y el QR. */
export function ArrowIcon({ size, className, style }: IconProps) {
  return (
    <svg width={size} height={size * 0.4} viewBox="0 0 40 16" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 8h33M28 2l7 6-7 6" />
      </g>
    </svg>
  )
}

/** Flecha curva del QR al mockup del móvil. */
export function CurvedArrow({ width, height, className, style }: { width: number; height: number } & Omit<IconProps, 'size'>) {
  return (
    <svg width={width} height={height} viewBox="0 0 120 150" fill="none" className={className} style={style} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M104 6c14 46 6 92-38 122" />
        <path d="M78 118l-12 12 16 8" />
      </g>
    </svg>
  )
}
