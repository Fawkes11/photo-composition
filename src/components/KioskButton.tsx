import type { ReactNode } from 'react'
import { BRAND } from '../config'

type Variant = 'primary' | 'ghost' | 'outline'

const VARIANTS: Record<Variant, { background: string; color: string; border: string }> = {
  primary: { background: BRAND.colors.primary, color: BRAND.colors.white, border: 'transparent' },
  ghost: { background: 'rgba(255,255,255,0.08)', color: BRAND.colors.white, border: 'rgba(255,255,255,0.22)' },
  outline: { background: 'transparent', color: BRAND.colors.white, border: 'rgba(255,255,255,0.55)' },
}

/**
 * Botón del kiosco. Área táctil generosa, sin estados hover (nadie pasa el
 * ratón por encima de un tótem) y con respuesta táctil inmediata en :active.
 */
export function KioskButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  height = 132,
  className = '',
}: {
  children: ReactNode
  onClick: () => void
  variant?: Variant
  disabled?: boolean
  height?: number
  className?: string
}) {
  const palette = VARIANTS[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`kiosk-button flex w-full items-center justify-center rounded-full text-[38px] font-semibold tracking-[0.18em] transition-[opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-35 ${className}`}
      style={{
        height,
        background: palette.background,
        color: palette.color,
        border: `2px solid ${palette.border}`,
        fontFamily: BRAND.fonts.body,
      }}
    >
      {children}
    </button>
  )
}
