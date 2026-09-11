/**
 * Exporta las máscaras de MediaPipe de las fotos del bake-off.
 *
 *   npm run dev  →  http://localhost:5173/dev/bakeoff-masks.html
 *
 * Usa `segmentPerson` DE VERDAD, el mismo que compone las piezas en el tótem.
 * Reimplementar la segmentación en Python para comparar habría medido rembg
 * contra otra cosa, no contra lo que corre en producción.
 *
 * Deja el resultado en `window.__mascaras` para que el script de Node lo recoja
 * por CDP y lo escriba en disco: una página web no puede escribir en el
 * sistema de archivos.
 */
import { segmentPerson } from '../src/vision/segmentation'
import { currentDelegate } from '../src/vision/visionLoader'

const ENTRADA = '/backend/python/bakeoff/input'
const out = document.getElementById('out')!
const log: string[] = []
const say = (l: string) => {
  log.push(l)
  out.textContent = log.join('\n')
}

/** La máscara 0..1 a un PNG en escala de grises, que es lo que compara Python. */
function maskToPng(data: Float32Array, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(width, height)
  for (let i = 0; i < data.length; i++) {
    const v = Math.round(Math.max(0, Math.min(1, data[i])) * 255)
    image.data[i * 4] = v
    image.data[i * 4 + 1] = v
    image.data[i * 4 + 2] = v
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

async function run() {
  const nombres = Array.from({ length: 14 }, (_, i) => `${i + 1}.png`)
  const salida: Record<string, { png: string; ms: number; cobertura: number }> = {}

  say(`${nombres.length} fotos · delegate ${currentDelegate()}`)
  say('')

  for (const nombre of nombres) {
    try {
      const blob = await (await fetch(`${ENTRADA}/${nombre}`)).blob()
      const bitmap = await createImageBitmap(blob)

      const t0 = performance.now()
      const mask = await segmentPerson(bitmap)
      const ms = performance.now() - t0
      bitmap.close()

      let cubierto = 0
      for (let i = 0; i < mask.data.length; i++) if (mask.data[i] >= 0.5) cubierto++
      const cobertura = cubierto / mask.data.length

      salida[nombre] = {
        png: maskToPng(mask.data, mask.width, mask.height),
        ms: Math.round(ms),
        cobertura: Number((cobertura * 100).toFixed(1)),
      }
      say(`  ${nombre.padStart(8)}  ${Math.round(ms).toString().padStart(5)} ms  persona ${(cobertura * 100).toFixed(1)}%`)
    } catch (e) {
      say(`  ${nombre.padStart(8)}  FALLA ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  say('')
  say(`delegate final: ${currentDelegate()}`)
  ;(window as unknown as { __mascaras?: unknown }).__mascaras = salida
  say('TODO OK')
}

run().catch((e) => say('FALLA GLOBAL: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e))))
