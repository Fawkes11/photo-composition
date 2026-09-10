/**
 * Auditoría del pipeline de composición.
 *
 *   npm run dev  →  http://localhost:5173/dev/audit.html
 *
 * Responde con números, no con impresiones, a tres preguntas:
 *   1. ¿se está pintando el FONDO real o el placeholder?
 *   2. ¿las tipografías de marca están cargadas y aplicándose de verdad?
 *   3. ¿cada etapa del tratamiento (piel, grading, glow, viñeteado) está
 *      conectada y modificando píxeles?
 *
 * La 3 es la que no se puede comprobar mirando el código: se mide el delta de
 * píxeles entre aplicar la etapa y no aplicarla. Delta 0 = etapa muerta.
 */
import { BRAND, EXPORT, FONT_FACES, LAYERS, PERSON, PHOTO_STYLES, WORDS, type PhotoStyle } from '../src/config'
import { composePiece } from '../src/compose/pipeline'
import { applyTreatment } from '../src/compose/imageTreatment'
import { ensureFontsReady } from '../src/lib/assets'

const out = document.getElementById('out')!
const shots = document.getElementById('shots')!
const lines: string[] = []
const say = (line = '') => {
  lines.push(line)
  out.textContent = lines.join('\n')
}
const verdict = (ok: boolean, text: string) => say(`${ok ? '  OK  ' : ' FALLA'} · ${text}`)

function show(canvasOrBlob: OffscreenCanvas | Blob, caption: string) {
  const img = new Image()
  const url =
    canvasOrBlob instanceof Blob
      ? URL.createObjectURL(canvasOrBlob)
      : URL.createObjectURL(new Blob())
  if (canvasOrBlob instanceof Blob) img.src = url
  const figure = document.createElement('figure')
  figure.append(img, Object.assign(document.createElement('figcaption'), { textContent: caption }))
  shots.append(figure)
  return img
}

/* ── estadísticas de píxel ─────────────────────────────────── */

type Stats = { mean: [number, number, number]; std: number }

function statsOf(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number): Stats {
  const d = ctx.getImageData(0, 0, w, h).data
  let r = 0, g = 0, b = 0
  const n = d.length / 4
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
  r /= n; g /= n; b /= n
  let varSum = 0
  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    const m = 0.2126 * r + 0.7152 * g + 0.0722 * b
    varSum += (luma - m) ** 2
  }
  return { mean: [r, g, b], std: Math.sqrt(varSum / n) }
}

/** Diferencia media absoluta por canal entre dos canvas del mismo tamaño. */
function meanAbsDiff(a: OffscreenCanvasRenderingContext2D, b: OffscreenCanvasRenderingContext2D, w: number, h: number): number {
  const x = a.getImageData(0, 0, w, h).data
  const y = b.getImageData(0, 0, w, h).data
  let sum = 0
  for (let i = 0; i < x.length; i += 4) {
    sum += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2])
  }
  return sum / (x.length / 4) / 3
}

/** Copia la foto de la modelo en un tile del tamaño de la caja de persona. */
async function personTile(): Promise<{ canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D }> {
  const { width, height } = PERSON.box
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  const bitmap = await createImageBitmap(await (await fetch('/images/model.png')).blob())
  const scale = Math.max(width / bitmap.width, height / bitmap.height)
  const dw = bitmap.width * scale, dh = bitmap.height * scale
  ctx.fillStyle = '#243046'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, (width - dw) / 2, (height - dh) * 0.06, dw, dh)
  bitmap.close()
  return { canvas, ctx }
}

/** Un estilo con solo una etapa encendida, para aislar su efecto. */
function onlyStage(base: PhotoStyle, stage: 'skinSmooth' | 'grading' | 'glow' | 'vignette'): PhotoStyle {
  return {
    ...base,
    skinSmooth: { ...base.skinSmooth, enabled: stage === 'skinSmooth' },
    grading: { ...base.grading, enabled: stage === 'grading' },
    glow: { ...base.glow, enabled: stage === 'glow' },
    vignette: { ...base.vignette, enabled: stage === 'vignette' },
  }
}

/* ── auditoría ─────────────────────────────────────────────── */

try {
  let failures = 0
  const fail = () => { failures++ }

  /* 1 · FONDO */
  say('1 · CAPA DE FONDO')
  const backResponse = await fetch(LAYERS.backDefault)
  const backOk = backResponse.ok
  verdict(backOk, `${LAYERS.backDefault} → HTTP ${backResponse.status}`)
  if (!backOk) fail()
  if (backOk) {
    const bmp = await createImageBitmap(await backResponse.blob())
    const sized = bmp.width === EXPORT.width && bmp.height === EXPORT.height
    verdict(sized, `dimensiones ${bmp.width}x${bmp.height} (pieza: ${EXPORT.width}x${EXPORT.height})`)
    if (!sized) fail()
    // Si el fondo real carga, el placeholder NO debe aparecer en la pieza.
    const probe = new OffscreenCanvas(bmp.width, bmp.height)
    const pctx = probe.getContext('2d')!
    pctx.drawImage(bmp, 0, 0)
    const s = statsOf(pctx, bmp.width, bmp.height)
    say(`       media RGB ${s.mean.map((v) => v.toFixed(0)).join(',')} · el placeholder sería ~26,7,16`)
    const isPlaceholder = s.mean[0] < 40 && s.mean[1] < 20
    verdict(!isPlaceholder, isPlaceholder ? 'parece el placeholder oscuro' : 'es la ilustración real, no el placeholder')
    if (isPlaceholder) fail()
    bmp.close()
  }
  say()

  /* 2 · TIPOGRAFÍAS */
  say('2 · TIPOGRAFÍAS DE MARCA')
  await ensureFontsReady()
  const probe = new OffscreenCanvas(8, 8).getContext('2d')!
  for (const face of FONT_FACES) {
    const registered = [...document.fonts].find((f) => f.family === face.family)
    const loaded = registered?.status === 'loaded'
    verdict(loaded, `${face.family} (${face.url}) → ${registered?.status ?? 'no registrada'}`)
    if (!loaded) fail()

    // Cargar no basta: hay que comprobar que ctx.font la resuelve de verdad.
    probe.font = `${face.weight} 120px "${face.family}"`
    const real = probe.measureText('SÉ INOLVIDABLE').width
    probe.font = `${face.weight} 120px monospace`
    const fallback = probe.measureText('SÉ INOLVIDABLE').width
    const applied = Math.abs(real - fallback) > 1
    verdict(applied, `       se aplica en canvas (ancho ${real.toFixed(0)} vs respaldo ${fallback.toFixed(0)})`)
    if (!applied) fail()
  }
  say()

  /* 3 · TRATAMIENTO, ETAPA POR ETAPA */
  say('3 · TRATAMIENTO FOTOGRÁFICO (delta de píxel por etapa)')
  const style = PHOTO_STYLES[0]
  say(`    estilo "${style.id}" · LUT: ${style.grading.lutPath ?? 'ninguna → curvas de config'}`)

  const base = await personTile()
  const baseStats = statsOf(base.ctx, PERSON.box.width, PERSON.box.height)
  say(`    partida: media RGB ${baseStats.mean.map((v) => v.toFixed(1)).join(',')} · desv ${baseStats.std.toFixed(1)}`)

  for (const stage of ['skinSmooth', 'grading', 'glow', 'vignette'] as const) {
    const test = await personTile()
    await applyTreatment(test.ctx, PERSON.box.width, PERSON.box.height, onlyStage(style, stage))
    const delta = meanAbsDiff(base.ctx, test.ctx, PERSON.box.width, PERSON.box.height)
    const after = statsOf(test.ctx, PERSON.box.width, PERSON.box.height)
    const alive = delta > 0.05
    verdict(alive, `${stage.padEnd(11)} delta ${delta.toFixed(2)} · media ${after.mean.map((v) => v.toFixed(1)).join(',')} · desv ${after.std.toFixed(1)}`)
    if (!alive) fail()
  }

  // Y la cadena entera junta.
  const full = await personTile()
  await applyTreatment(full.ctx, PERSON.box.width, PERSON.box.height, style)
  const fullDelta = meanAbsDiff(base.ctx, full.ctx, PERSON.box.width, PERSON.box.height)
  verdict(fullDelta > 0.05, `cadena completa delta ${fullDelta.toFixed(2)}`)
  say()

  /* 4 · PIEZA DE PRUEBA */
  say('4 · PIEZA DE PRUEBA')
  const frameCanvas = new OffscreenCanvas(607, 1080)
  const fctx = frameCanvas.getContext('2d')!
  const model = await createImageBitmap(await (await fetch('/images/model.png')).blob())
  const s2 = Math.max(607 / model.width, 1080 / model.height)
  fctx.fillStyle = '#243046'
  fctx.fillRect(0, 0, 607, 1080)
  fctx.drawImage(model, (607 - model.width * s2) / 2, (1080 - model.height * s2) * 0.1, model.width * s2, model.height * s2)
  model.close()

  const t0 = performance.now()
  const blob = await composePiece({
    frame: { bitmap: frameCanvas.transferToImageBitmap(), width: 607, height: 1080 },
    word: WORDS.find((w) => w.id === 'intensa')!,
    styleId: style.id,
  })
  const ms = Math.round(performance.now() - t0)
  const outBmp = await createImageBitmap(blob)
  verdict(outBmp.width === EXPORT.width && outBmp.height === EXPORT.height,
    `${outBmp.width}x${outBmp.height} · ${(blob.size / 1024).toFixed(0)} KB · ${ms} ms`)
  outBmp.close()
  show(blob, 'pieza de prueba')
  ;(window as unknown as { __pieza?: Blob }).__pieza = blob
  say()

  say(failures === 0 ? 'RESULTADO: TODO OK' : `RESULTADO: ${failures} FALLO(S)`)
  void BRAND
} catch (error) {
  say('EXCEPCIÓN: ' + (error instanceof Error ? (error.stack ?? error.message) : String(error)))
}
