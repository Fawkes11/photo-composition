import {
  BRAND,
  CLAIM_TEXT,
  EXPORT,
  PERSON,
  PIECE_LOGO,
  RESULT,
  TEXT_LAYERS,
  getStyle,
  type PhotoStyle,
  type WordOption,
} from '../config'
import { ensureFontsReady, loadBackLayer, loadFrontLayer } from '../lib/assets'
import { loadLogoBitmap } from '../lib/brandLogo'
import { acquire, release, trim } from '../lib/canvasPool'
import type { Rect } from '../lib/geometry'
import { drawSpacedCentered, drawTextBlock, layoutText } from '../lib/textLayout'
import { buildMaskCanvas, segmentPerson } from '../vision/segmentation'
import { decontaminateEdges } from './edgeDecontamination'
import { applyTreatment } from './imageTreatment'
import type { CapturedFrame } from '../store/kioskStore'

/**
 * Pipeline de composición, en canvas offscreen al tamaño real de exportación.
 *
 * Tres capas, en este orden:
 *   1. FONDO  — PNG del diseñador + el titular "SÉ INOLVIDABLE", que dibuja la
 *               app porque el PNG entregado no lo trae incrustado
 *   2. MEDIO  — la persona segmentada, sin fondo, ya tratada
 *   3. FRENTE — la palabra que eligió el usuario, su frase y el wordmark
 *
 * La capa FRENTE no lleva PNG: lo que va delante de la persona es texto, y lo
 * pinta la app a partir de la palabra elegida. Una palabra concreta puede
 * añadir un grafismo declarando `frontLayer` en su entrada de `WORDS`; si no
 * lo declara, `loadFrontLayer` devuelve null y no se dibuja nada.
 */

export type ComposeInput = {
  frame: CapturedFrame
  word: WordOption
  styleId: string
}

export async function composePiece({ frame, word, styleId }: ComposeInput): Promise<Blob> {
  const style = getStyle(word.styleId ?? styleId)

  // Las fuentes primero: el canvas no re-dibuja cuando una fuente llega tarde.
  // El logo se rasteriza una vez y se cachea (src/lib/brandLogo.ts); en el
  // resto de ciclos esta promesa resuelve al instante.
  const [, back, front, logo] = await Promise.all([
    ensureFontsReady(),
    loadBackLayer(word.backLayer),
    loadFrontLayer(word.frontLayer),
    loadLogoBitmap(PIECE_LOGO.color, PIECE_LOGO.width),
  ])

  const main = acquire(EXPORT.width, EXPORT.height)
  try {
    const ctx = main.ctx

    // ── Capa 1 · FONDO ──────────────────────────────────────────
    ctx.drawImage(back, 0, 0, EXPORT.width, EXPORT.height)
    // El titular va con el fondo, por debajo de la persona: el PNG entregado
    // no lo trae incrustado (ver CLAIM_TEXT).
    drawClaim(ctx)

    // ── Capa 2 · MEDIO ──────────────────────────────────────────
    const person = await buildPersonLayer(frame, style)
    try {
      ctx.drawImage(person, PERSON.box.x, PERSON.box.y)
    } finally {
      person.close()
    }

    // ── Capa 3 · FRENTE ─────────────────────────────────────────
    if (front) ctx.drawImage(front, 0, 0, EXPORT.width, EXPORT.height)
    drawWordText(ctx, word)
    drawLogo(ctx, logo)

    return await main.canvas.convertToBlob({ type: RESULT.mimeType, quality: RESULT.quality })
  } finally {
    release(main)
    // Devuelve al sistema los lienzos temporales del ciclo.
    trim()
  }
}

/**
 * Construye la capa de la persona: encuadre en la caja, segmentación,
 * tratamiento fotográfico y recorte con borde difuminado.
 *
 * La segmentación corre sobre `frame.bitmap` a SU RESOLUCIÓN NATIVA (la foto
 * capturada), no sobre el recuadro ya reescalado al tamaño de la caja de la
 * persona: reescalar primero y segmentar después le da al modelo una imagen
 * ya suavizada por el remuestreo, y el borde de la máscara sale peor definido.
 * La máscara resultante se recorta con exactamente la misma región (`source`)
 * que se usa para el color, así quedan perfectamente alineadas — si no,
 * máscara y foto se desincronizan y el recorte se ve descuadrado.
 *
 * La segmentación corre sobre el recorte SIN tratar: la LUT y el viñeteado
 * mueven los colores y el modelo acierta menos con la imagen ya graduada.
 */
async function buildPersonLayer(frame: CapturedFrame, style: PhotoStyle): Promise<ImageBitmap> {
  const { width: boxWidth, height: boxHeight } = PERSON.box
  const source = anchoredCover(frame.width, frame.height, boxWidth, boxHeight)

  const mask = await segmentPerson(frame.bitmap)
  const maskCanvas = buildMaskCanvas(mask, source, boxWidth, boxHeight)

  const tile = acquire(boxWidth, boxHeight)
  try {
    tile.ctx.imageSmoothingEnabled = true
    tile.ctx.imageSmoothingQuality = 'high'
    tile.ctx.drawImage(
      frame.bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      boxWidth,
      boxHeight,
    )

    // Tratamiento (piel → grading → glow → viñeteado) antes de recortar.
    await applyTreatment(tile.ctx, boxWidth, boxHeight, style)

    // Le quita al contorno el color del fondo original ANTES de recortar:
    // necesita ver los píxeles de fondo de alrededor para estimar qué restar,
    // y tras el recorte esos píxeles ya no existen.
    decontaminateEdges(tile.ctx, maskCanvas, boxWidth, boxHeight)

    // Recorte: la máscara ya llega alineada y con el borde difuminado.
    tile.ctx.save()
    tile.ctx.globalCompositeOperation = 'destination-in'
    tile.ctx.drawImage(maskCanvas, 0, 0)
    tile.ctx.restore()

    return tile.canvas.transferToImageBitmap()
  } finally {
    release(tile)
  }
}

/**
 * Recorte "cover" con anclaje: llena la caja destino y decide qué sobrante se
 * tira. Anclado arriba, lo que se pierde es la parte baja del torso — nunca la
 * cabeza. Devuelve la región en px de la FOTO ORIGINAL (`frame.bitmap`): con
 * ese mismo rectángulo se recortan tanto el color como la máscara.
 */
function anchoredCover(sourceWidth: number, sourceHeight: number, destWidth: number, destHeight: number): Rect {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight) * PERSON.scale
  const width = Math.min(sourceWidth, destWidth / scale)
  const height = Math.min(sourceHeight, destHeight / scale)
  return {
    x: (sourceWidth - width) * PERSON.anchorX,
    y: (sourceHeight - height) * PERSON.anchorY,
    width,
    height,
  }
}

/**
 * "SÉ INOLVIDABLE" sobre el fondo.
 *
 * No usa `TEXT_LAYERS` porque no necesita ajuste automático: es un texto fijo
 * con un tamaño calibrado sobre la composición del diseñador.
 */
function drawClaim(ctx: OffscreenCanvasRenderingContext2D): void {
  if (!CLAIM_TEXT.render) return

  ctx.save()
  ctx.font = `700 ${CLAIM_TEXT.fontSize}px ${BRAND.fonts.display}`
  ctx.fillStyle = CLAIM_TEXT.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (CLAIM_TEXT.shadow) {
    ctx.shadowColor = CLAIM_TEXT.shadow.color
    ctx.shadowBlur = CLAIM_TEXT.shadow.blur
    ctx.shadowOffsetX = CLAIM_TEXT.shadow.offsetX
    ctx.shadowOffsetY = CLAIM_TEXT.shadow.offsetY
  }
  drawSpacedCentered(
    ctx,
    CLAIM_TEXT.text,
    EXPORT.width / 2,
    CLAIM_TEXT.centerY,
    CLAIM_TEXT.letterSpacing * CLAIM_TEXT.fontSize,
  )
  ctx.restore()
}

/** Los dos bloques de texto de la capa FRENTE, con ajuste automático. */
function drawWordText(ctx: OffscreenCanvasRenderingContext2D, word: WordOption): void {
  const wordLayout = layoutText(ctx, word.word, TEXT_LAYERS.word)
  drawTextBlock(ctx, wordLayout, TEXT_LAYERS.word)

  const phraseLayout = layoutText(ctx, word.phrase, TEXT_LAYERS.phrase)
  drawTextBlock(ctx, phraseLayout, TEXT_LAYERS.phrase)
}

/**
 * Wordmark al pie de la pieza, bajo el bloque de la palabra.
 * Llega ya rasterizado y en su color final (src/lib/brandLogo.ts): aquí solo
 * se posiciona.
 */
function drawLogo(ctx: OffscreenCanvasRenderingContext2D, logo: ImageBitmap): void {
  const x = PIECE_LOGO.centerX - logo.width / 2
  const y = EXPORT.height - PIECE_LOGO.bottom - logo.height
  ctx.drawImage(logo, x, y)
}
