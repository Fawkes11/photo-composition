import type { TextBlockConfig } from '../config'

/**
 * Ajuste automático de texto en canvas.
 *
 * Las frases varían mucho de longitud, así que no se puede fijar un tamaño. Se
 * mide con `measureText` y se baja el fontSize hasta que el bloque entra en la
 * caja definida en config. Si la frase tiene dos oraciones, se prueba primero a
 * partirla por el punto: dos líneas equilibradas se leen mejor que una línea
 * diminuta.
 */

export type LaidOutText = {
  lines: string[]
  fontSize: number
  lineHeightPx: number
  /** Alto total del bloque ya compuesto. */
  height: number
}

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

function fontString(config: TextBlockConfig, size: number): string {
  return `${config.fontWeight} ${size}px ${config.fontFamily}`
}

/**
 * Ancho real de una línea teniendo en cuenta el letter-spacing, que
 * `measureText` no incluye (se aplica al dibujar, no al medir).
 */
function lineWidth(ctx: Ctx, text: string, config: TextBlockConfig, size: number): number {
  const base = ctx.measureText(text).width
  if (!config.letterSpacing) return base
  // El espaciado se añade tras cada carácter menos el último.
  return base + Math.max(0, text.length - 1) * config.letterSpacing * size
}

/** Parte en dos por el punto final de la primera oración, si la hay. */
function splitSentences(text: string): string[] | null {
  const match = /^(.+?[.!?])\s+(.+)$/s.exec(text.trim())
  if (!match) return null
  return [match[1].trim(), match[2].trim()]
}

/** Reparto por palabras clásico, respetando el ancho disponible. */
function wrapWords(ctx: Ctx, text: string, config: TextBlockConfig, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && lineWidth(ctx, candidate, config, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function fits(ctx: Ctx, lines: string[], config: TextBlockConfig, size: number): boolean {
  if (lines.length > config.maxLines) return false
  for (const line of lines) {
    if (lineWidth(ctx, line, config, size) > config.box.width) return false
  }
  return lines.length * size * config.lineHeight <= config.box.height
}

/**
 * Calcula líneas y fontSize definitivos.
 * Baja de 1 px en 1 px: con rangos de 30-80 px son unas pocas decenas de
 * medidas, imperceptible, y evita los saltos raros de una búsqueda binaria
 * cuando el reparto de palabras cambia con el tamaño.
 */
export function layoutText(ctx: Ctx, rawText: string, config: TextBlockConfig): LaidOutText {
  const text = config.uppercase ? rawText.toLocaleUpperCase('es-ES') : rawText
  const sentences = config.splitOnSentence ? splitSentences(text) : null

  for (let size = config.maxFontSize; size >= config.minFontSize; size--) {
    ctx.font = fontString(config, size)

    // 1) De una línea, si cabe: es siempre lo más legible.
    if (fits(ctx, [text], config, size)) {
      return finish([text], size, config)
    }

    // 2) Dos oraciones, una por línea.
    if (sentences && fits(ctx, sentences, config, size)) {
      return finish(sentences, size, config)
    }

    // 3) Reparto por palabras.
    const wrapped = wrapWords(ctx, text, config, size, config.box.width)
    if (fits(ctx, wrapped, config, size)) {
      return finish(wrapped, size, config)
    }
  }

  // Nada entró ni al tamaño mínimo: se acepta el desbordamiento controlado del
  // reparto por palabras antes que recortar la frase del cliente.
  const size = config.minFontSize
  ctx.font = fontString(config, size)
  const lines = wrapWords(ctx, text, config, size, config.box.width).slice(0, config.maxLines)
  return finish(lines, size, config)
}

function finish(lines: string[], size: number, config: TextBlockConfig): LaidOutText {
  const lineHeightPx = size * config.lineHeight
  return { lines, fontSize: size, lineHeightPx, height: lines.length * lineHeightPx }
}

/** Dibuja el bloque ya calculado, centrado verticalmente en su caja. */
export function drawTextBlock(ctx: Ctx, layout: LaidOutText, config: TextBlockConfig): void {
  const { box } = config
  ctx.save()
  ctx.font = fontString(config, layout.fontSize)
  ctx.fillStyle = config.color
  ctx.textAlign = config.align
  ctx.textBaseline = 'middle'

  if (config.shadow) {
    ctx.shadowColor = config.shadow.color
    ctx.shadowBlur = config.shadow.blur
    ctx.shadowOffsetX = config.shadow.offsetX
    ctx.shadowOffsetY = config.shadow.offsetY
  }

  const x = config.align === 'center' ? box.x + box.width / 2 : config.align === 'right' ? box.x + box.width : box.x
  // `bottom` clava el borde inferior del bloque en el fondo de la caja: las
  // líneas de más crecen hacia arriba, no hacia el bloque de abajo.
  const blockTop =
    config.verticalAlign === 'bottom'
      ? box.y + box.height - layout.height
      : box.y + (box.height - layout.height) / 2
  const firstLineY = blockTop + layout.lineHeightPx / 2

  layout.lines.forEach((line, index) => {
    const y = firstLineY + index * layout.lineHeightPx
    if (config.letterSpacing) {
      drawSpacedLine(ctx, line, x, y, config, layout.fontSize)
    } else {
      ctx.fillText(line, x, y)
    }
  })

  ctx.restore()
}

/**
 * Dibuja carácter a carácter para aplicar letter-spacing.
 * `ctx.letterSpacing` existe en Chromium pero no en todos los motores; hacerlo
 * a mano garantiza que la pieza salga idéntica en cualquier máquina de feria.
 */
function drawSpacedLine(
  ctx: Ctx,
  line: string,
  anchorX: number,
  y: number,
  config: TextBlockConfig,
  size: number,
): void {
  const spacing = config.letterSpacing * size
  const total = lineWidth(ctx, line, config, size)
  const left = config.align === 'center' ? anchorX - total / 2 : config.align === 'right' ? anchorX - total : anchorX
  drawSpacedFrom(ctx, line, left, y, spacing)
}

/**
 * Dibuja `text` centrado en `centerX` aplicando letter-spacing a mano.
 * Para textos sueltos que no son un bloque de `TEXT_LAYERS` (el titular de la
 * pieza), sin duplicar la lógica de espaciado.
 */
export function drawSpacedCentered(ctx: Ctx, text: string, centerX: number, y: number, spacing: number): void {
  const total = ctx.measureText(text).width + Math.max(0, text.length - 1) * spacing
  drawSpacedFrom(ctx, text, centerX - total / 2, y, spacing)
}

/** Pinta carácter a carácter desde un borde izquierdo dado. */
function drawSpacedFrom(ctx: Ctx, text: string, left: number, y: number, spacing: number): void {
  let x = left
  const previousAlign = ctx.textAlign
  ctx.textAlign = 'left'
  for (const char of text) {
    ctx.fillText(char, x, y)
    x += ctx.measureText(char).width + spacing
  }
  ctx.textAlign = previousAlign
}
