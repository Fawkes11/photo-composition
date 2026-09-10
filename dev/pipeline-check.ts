/**
 * Banco de pruebas del pipeline de composición, SIN cámara.
 *
 *   npm run dev  →  http://localhost:5173/dev/pipeline-check.html
 *
 * Compone N piezas seguidas a partir de un frame sintético y reporta tiempos y
 * uso de heap. Sirve para: comprobar que las capas del diseñador cargan, medir
 * cuánto cuesta de verdad una pieza y detectar fugas antes de una jornada larga.
 * No entra en el build de producción (Vite solo empaqueta index.html).
 */
import { EXPORT, PERSON, WORDS } from '../src/config'
import { composePiece } from '../src/compose/pipeline'

const out = document.getElementById('out')!
const log: string[] = []
const say = (line: string) => { log.push(line); out.textContent = log.join('\n') }

/**
 * Frame de prueba con una persona de verdad: se usa la foto de la modelo sobre
 * un fondo plano, con el mismo recorte 9:16 que produciría la cámara. Con una
 * silueta pintada a mano el segmentador no encuentra a nadie y no se estaría
 * probando lo que importa: la máscara, el feather y el encaje en la caja.
 */
async function syntheticFrame() {
  const w = 607, h = 1080
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#2b3a55'); g.addColorStop(1, '#0d1017')
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)

  const person = await createImageBitmap(await (await fetch('/images/model.png')).blob())
  const scale = Math.max(w / person.width, h / person.height)
  const dw = person.width * scale, dh = person.height * scale
  ctx.drawImage(person, (w - dw) / 2, (h - dh) * 0.1, dw, dh)
  person.close()

  return { bitmap: c.transferToImageBitmap(), width: w, height: h }
}

const CYCLES = 25
const heap = () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0
const mb = (bytes: number) => (bytes / 1048576).toFixed(1) + ' MB'

try {
  const times: number[] = []
  let sample = { width: 0, height: 0, size: 0, type: '' }
  let lastDataUrl = ''

  for (let i = 0; i < CYCLES; i++) {
    const frame = await syntheticFrame()
    const word = WORDS[i % WORDS.length]
    const t0 = performance.now()
    const blob = await composePiece({ frame, word, styleId: 'signature' })
    times.push(performance.now() - t0)
    frame.bitmap.close()

    if (i === 0 || i === CYCLES - 1) {
      const bmp = await createImageBitmap(blob)
      sample = { width: bmp.width, height: bmp.height, size: blob.size, type: blob.type }
      bmp.close()
      lastDataUrl = await new Promise<string>((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result as string)
        fr.readAsDataURL(blob)
      })
    }
    // Igual que en la app: cada ciclo suelta su object URL.
    URL.revokeObjectURL(URL.createObjectURL(blob))
    if (i === 0) say(`primera pieza (modelos en frío): ${Math.round(times[0])} ms`)
    if (i === 4 || i === 14 || i === CYCLES - 1) say(`heap tras ${i + 1} ciclos: ${mb(heap())}`)
  }

  const warm = times.slice(1)
  const avg = warm.reduce((a, b) => a + b, 0) / warm.length
  const heapAfter = heap()

  say(`ciclos            ${CYCLES}`)
  say(`en caliente       min ${Math.round(Math.min(...warm))} / media ${Math.round(avg)} / max ${Math.round(Math.max(...warm))} ms`)
  say(`blob              ${sample.type} ${(sample.size / 1024).toFixed(0)} KB`)
  say(`dimension         ${sample.width}x${sample.height} (esperado ${EXPORT.width}x${EXPORT.height})`)
  say(`caja persona      ${PERSON.box.width}x${PERSON.box.height}`)
  say(`heap tras ciclos  ${mb(heapAfter)}`)
  say(sample.width === EXPORT.width && sample.height === EXPORT.height ? 'TODO OK' : 'FALLA: dimension')

  // La última pieza queda en window para poder descargarla desde el driver CDP.
  ;(window as unknown as { __pieza?: string }).__pieza = lastDataUrl
} catch (e) {
  say('FALLA: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)))
}
