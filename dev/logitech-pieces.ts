/**
 * Piezas finales a partir de las capturas de la webcam REAL.
 *
 *   npm run dev  →  http://localhost:5173/dev/logitech-pieces.html
 *
 * Las de `dev/samples/` son fotos de la Logitech del tótem, ya giradas a
 * vertical. Miden 720x1280, que es exactamente 9:16 — o sea, exactamente lo que
 * `captureFrame` produciría con la cámara montada en vertical. Por eso se
 * pueden usar tal cual, sin simular el recorte de la cámara.
 *
 * Esto es distinto de un recorte sobre fondo plano: aquí pasa por `composePiece`
 * entero —segmentación, tratamiento fotográfico, las tres capas, los textos y el
 * logo— así que lo que sale es lo que entregaría el kiosco de verdad.
 */
import { WORDS, getStyle } from '../src/config'
import { buildPersonLayer, composePiece } from '../src/compose/pipeline'

const out = document.getElementById('out')!
const galeria = document.getElementById('galeria')!
const log: string[] = []
const say = (l = '') => {
  log.push(l)
  out.textContent = log.join('\n')
}

const MUESTRAS = ['logitech-1.png', 'logitech-2.png', 'logitech-3.png']

async function run() {
  const piezas: Record<string, string> = {}
  const recortes: Record<string, string> = {}

  for (const [indice, nombre] of MUESTRAS.entries()) {
    try {
      const blob = await (await fetch(`/dev/samples/${nombre}`)).blob()
      const bitmap = await createImageBitmap(blob)

      // Cada muestra con una palabra distinta, para ver también el ajuste del
      // texto con frases de largos diferentes.
      const word = WORDS[indice % WORDS.length]

      const t0 = performance.now()
      const pieza = await composePiece({
        frame: { bitmap, width: bitmap.width, height: bitmap.height },
        word,
        styleId: 'signature',
      })
      const ms = Math.round(performance.now() - t0)

      const dataUrl = await new Promise<string>((r) => {
        const fr = new FileReader()
        fr.onload = () => r(fr.result as string)
        fr.readAsDataURL(pieza)
      })
      piezas[nombre] = dataUrl

      // El RECORTE solo, con su transparencia, tal como sale del pipeline. Se
      // pinta sobre un tablero de ajedrez para poder juzgar el canal alfa: sobre
      // un color liso no se distingue un borde semitransparente de uno opaco.
      const capa = await buildPersonLayer(
        { bitmap: await createImageBitmap(blob), width: bitmap.width, height: bitmap.height },
        getStyle(word.styleId ?? 'signature'),
      )
      const lienzo = document.createElement('canvas')
      lienzo.width = capa.width
      lienzo.height = capa.height
      const cx = lienzo.getContext('2d')!
      cx.drawImage(capa, 0, 0)
      capa.close()
      recortes[nombre] = lienzo.toDataURL('image/png')

      const figura = document.createElement('figure')
      figura.style.margin = '0'
      const img = document.createElement('img')
      img.src = dataUrl
      img.style.width = '260px'
      img.style.display = 'block'
      img.style.borderRadius = '6px'
      const pie = document.createElement('figcaption')
      pie.textContent = `${nombre} · ${word.word} · ${ms} ms · ${(pieza.size / 1024).toFixed(0)} KB`
      pie.style.cssText = 'color:#bbb;padding-top:6px;font-size:12px;text-align:center'
      figura.append(img, pie)
      galeria.append(figura)

      say(`  ${nombre.padEnd(18)} ${word.word.padEnd(12)} ${String(ms).padStart(4)} ms  ${(pieza.size / 1024).toFixed(0)} KB`)
    } catch (e) {
      say(`  ${nombre.padEnd(18)} FALLA ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  ;(window as unknown as { __piezas?: unknown; __recortes?: unknown }).__piezas = piezas
  ;(window as unknown as { __recortes?: unknown }).__recortes = recortes
  say('')
  say('TODO OK')
}

say('componiendo…')
say('')
run().catch((e) => say('FALLA GLOBAL: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e))))
