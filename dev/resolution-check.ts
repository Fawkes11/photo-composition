/**
 * ¿Le sirve a MediaPipe que le demos más resolución?
 *
 *   npm run dev  →  http://localhost:5173/dev/resolution-check.html
 *
 * Pasa la MISMA foto por `segmentPerson` a varios tamaños y compara las
 * máscaras resultantes, todas llevadas a una resolución común.
 *
 * Importa para decidir si merece la pena montar la webcam en vertical: con
 * 1280x720 en horizontal, el recorte 9:16 deja 405x720 (el 32 % del ancho del
 * sensor); en vertical serían 720x1280 completos, 3,16 veces más píxeles.
 *
 * Si las máscaras salen casi idénticas, la inferencia ocurre a un tamaño fijo
 * y la resolución extra solo mejora la FOTO, no el recorte. Si difieren, mejora
 * las dos cosas. No es lo mismo para la recomendación.
 */
import { IMAGES } from '../src/config'
import { segmentPerson } from '../src/vision/segmentation'

const out = document.getElementById('out')!
const log: string[] = []
const say = (l = '') => {
  log.push(l)
  out.textContent = log.join('\n')
}

const TAMANOS = [
  { w: 203, h: 360, etiqueta: 'mitad de lo de hoy' },
  { w: 405, h: 720, etiqueta: 'HOY (camara horizontal)' },
  { w: 540, h: 960, etiqueta: 'intermedio' },
  { w: 720, h: 1280, etiqueta: 'ROTADA (vertical)' },
]

/** La foto a un tamaño dado, sin deformarla. */
async function alTamano(bitmap: ImageBitmap, w: number, h: number): Promise<ImageBitmap> {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const s = Math.max(w / bitmap.width, h / bitmap.height)
  const dw = bitmap.width * s
  const dh = bitmap.height * s
  ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return c.transferToImageBitmap()
}

/** Máscara remuestreada a una rejilla común, para poder restar una de otra. */
function aRejilla(data: Float32Array, w: number, h: number, gw: number, gh: number): Float32Array {
  const g = new Float32Array(gw * gh)
  for (let y = 0; y < gh; y++) {
    const sy = Math.min(h - 1, Math.floor((y / gh) * h))
    for (let x = 0; x < gw; x++) {
      const sx = Math.min(w - 1, Math.floor((x / gw) * w))
      g[y * gw + x] = data[sy * w + sx]
    }
  }
  return g
}

const GW = 180
const GH = 320

async function run() {
  const bitmap = await createImageBitmap(await (await fetch(IMAGES.model)).blob())
  say(`foto de prueba: ${bitmap.width}x${bitmap.height}`)
  say('')

  const rejillas: { etiqueta: string; g: Float32Array; ms: number; cobertura: number }[] = []

  for (const { w, h, etiqueta } of TAMANOS) {
    const escalada = await alTamano(bitmap, w, h)
    const t0 = performance.now()
    const mask = await segmentPerson(escalada)
    const ms = performance.now() - t0
    escalada.close()

    let cubierto = 0
    for (let i = 0; i < mask.data.length; i++) if (mask.data[i] >= 0.5) cubierto++

    rejillas.push({
      etiqueta,
      g: aRejilla(mask.data, mask.width, mask.height, GW, GH),
      ms: Math.round(ms),
      cobertura: (cubierto / mask.data.length) * 100,
    })
    say(`${etiqueta.padEnd(26)} ${`${w}x${h}`.padStart(9)}  ${String(Math.round(ms)).padStart(4)} ms  persona ${((cubierto / mask.data.length) * 100).toFixed(1)}%`)
  }

  say('')
  say('Diferencia entre cada tamaño y el de HOY (405x720),')
  say('medida sobre una rejilla común:')
  say('')
  const base = rejillas[1].g
  for (const r of rejillas) {
    let distintos = 0
    let suma = 0
    for (let i = 0; i < base.length; i++) {
      const d = Math.abs(r.g[i] - base[i])
      suma += d
      // Un pixel "cambia de bando" si cruza el umbral de decision.
      if ((r.g[i] >= 0.5) !== (base[i] >= 0.5)) distintos++
    }
    say(
      `  ${r.etiqueta.padEnd(26)} cambian de bando ${((distintos / base.length) * 100).toFixed(2).padStart(5)}%` +
        `   diferencia media ${(suma / base.length).toFixed(3)}`,
    )
  }

  say('')
  say('TODO OK')
}

run().catch((e) => say('FALLA: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e))))
