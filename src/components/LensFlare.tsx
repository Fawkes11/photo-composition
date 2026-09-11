import { useEffect, useRef } from 'react'
import { DECOR, type FlareConfig } from '../config'
import { GHOST_PRESETS, parseHex, rotateHue, type GhostPreset } from '../lib/lensFlarePresets'

/**
 * Destello de lente (lens flare).
 *
 * Los fantasmas salen de la tabla de JS.LensFlare (ver
 * `src/lib/lensFlarePresets.ts` para la atribución y qué se portó): 16
 * elementos, la mayoría pequeños, que es lo que da el aspecto de destello real
 * en vez de unas pocas manchas grandes.
 *
 * Del original NO se portó el motor de animación (GSAP): aquí se dibuja **una
 * sola vez**, sin bucle. En un tótem que corre todo el día sobre gráficos
 * integrados, un rAF permanente de decoración no se paga.
 */
export function LensFlare({ flare }: { flare: FlareConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { x, y, size, intensity, hueShift, spread, tint } = { ...DECOR.flareDefaults, ...flare }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = size
    canvas.height = size
    ctx.clearRect(0, 0, size, size)
    drawFlare(ctx, size, intensity, hueShift, spread)
  }, [size, intensity, hueShift, spread])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute"
      style={{ left: x, top: y, width: size, height: size, mixBlendMode: 'screen', filter: tint }}
      aria-hidden="true"
    />
  )
}

/** Pinta todos los destellos declarados para una pantalla. */
export function LensFlares({ flares }: { flares: readonly FlareConfig[] }) {
  return (
    <>
      {flares.map((flare, index) => (
        <LensFlare key={index} flare={flare} />
      ))}
    </>
  )
}

/* ─────────────────────────── dibujo ────────────────────────── */

function drawFlare(ctx: CanvasRenderingContext2D, size: number, intensity: number, hueShift: number, spread: number): void {
  // La fuente está arriba a la derecha y la cadena baja hacia la izquierda,
  // cruzando el centro — como en una lente, y como pide el diseño.
  const source = { x: size * DECOR.flareSource.x, y: size * DECOR.flareSource.y }
  const centre = { x: size * 0.5, y: size * 0.5 }
  // `spread` alarga o acorta la cadena más allá del centro.
  const end = {
    x: source.x + (centre.x - source.x) * spread,
    y: source.y + (centre.y - source.y) * spread,
  }

  ctx.globalCompositeOperation = 'lighter'

  const last = GHOST_PRESETS.length - 1
  GHOST_PRESETS.forEach((ghost, index) => {
    // Repartidos uniformemente entre la fuente y el final del eje, igual que
    // en el original.
    const t = last === 0 ? 0 : index / last
    drawGhost(ctx, {
      ghost,
      x: source.x + (end.x - source.x) * t,
      y: source.y + (end.y - source.y) * t,
      diameter: ghost.size * size,
      alpha: ghost.alpha * intensity,
      hueShift,
    })
  })

  ctx.globalCompositeOperation = 'source-over'
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  { ghost, x, y, diameter, alpha, hueShift }: { ghost: GhostPreset; x: number; y: number; diameter: number; alpha: number; hueShift: number },
): void {
  const radius = diameter / 2
  const tint = (hex: string, extra = 1) => {
    const c = rotateHue(parseHex(hex), hueShift)
    return `rgba(${c.r},${c.g},${c.b},${c.a * alpha * extra})`
  }

  if (ghost.sides) {
    // Fantasma poligonal: el reflejo del diafragma.
    ctx.beginPath()
    for (let i = 0; i < ghost.sides; i++) {
      const angle = (i / ghost.sides) * Math.PI * 2
      const px = x + Math.cos(angle) * radius
      const py = y + Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = tint(ghost.colors[0])
    ctx.fill()
    return
  }

  // Disco con degradado radial. El radio interior sale del preset.
  const inner = radius * (ghost.innerRadius ?? 0.3) * 2
  const gradient = ctx.createRadialGradient(x, y, Math.min(inner, radius), x, y, radius)
  ghost.colors.forEach((color, i) => {
    gradient.addColorStop(clamp01(ghost.stops[i] ?? i / (ghost.colors.length - 1)), tint(color))
  })
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}
