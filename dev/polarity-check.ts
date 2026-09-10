/**
 * ¿Por qué en móvil la persona desaparecía de la pieza?
 *
 *   npm run dev  →  http://localhost:5173/dev/polarity-check.html
 *
 * Pasa el MISMO sujeto por `segmentPerson` a distintas distancias y mide qué
 * porción del encuadre acaba marcada como persona.
 *
 * El fallo: había una heurística que miraba la banda perimetral de la máscara y,
 * si la confianza era alta ahí, daba la vuelta a la máscara entera. Asumía que
 * el borde del encuadre es fondo. Con un móvil en la mano eso es falso — la
 * persona llena el cuadro — así que invertía máscaras correctas y borraba a la
 * persona. La columna de la derecha muestra qué habría hecho esa heurística.
 */
import { DETECTION, IMAGES } from '../src/config'
import { loadSegmenter } from '../src/vision/visionLoader'
import { segmentPerson } from '../src/vision/segmentation'

const out = document.getElementById('out')!
const log: string[] = []
const say = (l: string) => {
  log.push(l)
  out.textContent = log.join('\n')
}

/** La misma banda perimetral del 4% que usaba la heurística retirada. */
function borderMean(data: Float32Array, width: number, height: number): number {
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.04))
  let sum = 0
  let count = 0
  for (let y = 0; y < height; y++) {
    const isEdgeRow = y < band || y >= height - band
    for (let x = 0; x < width; x++) {
      if (!isEdgeRow && x >= band && x < width - band) continue
      sum += data[y * width + x]
      count++
    }
  }
  return count === 0 ? 0 : sum / count
}

const coverage = (d: Float32Array) => {
  let n = 0
  for (let i = 0; i < d.length; i++) if (d[i] >= 0.5) n++
  return n / d.length
}

/** Frame 9:16 con la modelo a un zoom dado (1 = encuadre del banco de pruebas). */
async function frameAt(zoom: number) {
  const w = 607
  const h = 1080
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#2b3a55')
  g.addColorStop(1, '#0d1017')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  const person = await createImageBitmap(await (await fetch(IMAGES.model)).blob())
  const s = Math.max(w / person.width, h / person.height) * zoom
  const dw = person.width * s
  const dh = person.height * s
  ctx.drawImage(person, (w - dw) / 2, (h - dh) * 0.1, dw, dh)
  person.close()

  return c.transferToImageBitmap()
}

try {
  say('delegate: ' + DETECTION.delegate)

  const seg = await loadSegmenter()
  const labels = (seg as unknown as { getLabels?: () => string[] }).getLabels?.()
  say('getLabels(): ' + (labels ? JSON.stringify(labels) : 'NO DISPONIBLE'))

  const probe = await frameAt(1.0)
  const pr = seg.segment(probe)
  say('confidenceMasks: ' + (pr.confidenceMasks?.length ?? 0) + '   categoryMask: ' + (pr.categoryMask ? 'si' : 'no'))
  pr.close()
  probe.close()
  say('')

  say('zoom  borde   persona  con la heuristica retirada')
  say('----  ------  -------  --------------------------')

  let peor = 1
  for (const zoom of [1.0, 1.3, 1.6, 2.0, 2.6, 3.2]) {
    const bmp = await frameAt(zoom)
    const mask = await segmentPerson(bmp) // ← ruta real de produccion
    bmp.close()

    const cov = coverage(mask.data)
    const bm = borderMean(mask.data, mask.width, mask.height)
    peor = Math.min(peor, cov)

    const antes = bm > 0.5 ? `habria invertido → ${((1 - cov) * 100).toFixed(1)}%` : 'sin cambio'
    say(
      `${zoom.toFixed(1).padStart(4)}  ${bm.toFixed(3).padStart(6)}  ` +
        `${(cov * 100).toFixed(1).padStart(6)}%  ${antes}`,
    )
  }

  say('')
  // A cualquier distancia la persona tiene que seguir ocupando una porcion
  // sustancial del encuadre. Si esto baja, algo volvio a invertir la mascara.
  say(peor > 0.5 ? `TODO OK — peor caso ${(peor * 100).toFixed(1)}% de persona` : `FALLA — peor caso ${(peor * 100).toFixed(1)}%`)
} catch (e) {
  say('FALLA: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)))
}
