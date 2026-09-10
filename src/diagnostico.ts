/**
 * Página de diagnóstico, pensada para abrirse EN EL DISPOSITIVO que falla.
 *
 * En un móvil no hay consola a mano, así que todo se imprime en pantalla. Va
 * de lo más barato a lo más caro: primero las capacidades del navegador, luego
 * la carga de MediaPipe, y al final una segmentación de verdad sobre una imagen
 * sintética con una figura clara.
 *
 * Es una entrada aparte del build (ver vite.config.ts): no entra en el bundle
 * del kiosco ni lo lastra.
 */
import { DETECTION, EXPORT, IMAGES } from './config'

const out = document.getElementById('out')!
const lines: string[] = []
const say = (l = '') => {
  lines.push(l)
  out.textContent = lines.join('\n')
}
const mark = (ok: boolean | null, label: string, detail = '') => {
  const icon = ok === null ? '·' : ok ? '✓' : '✗'
  say(`${icon} ${label}${detail ? '   ' + detail : ''}`)
}

async function run() {
  say('── DISPOSITIVO ──')
  say(navigator.userAgent)
  say(`pantalla ${screen.width}×${screen.height} · dpr ${devicePixelRatio}`)
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  say(`nucleos ${navigator.hardwareConcurrency ?? '?'} · RAM ${mem ? mem + ' GB' : 'desconocida'}`)
  say()

  say('── CAPACIDADES ──')
  mark(typeof OffscreenCanvas !== 'undefined', 'OffscreenCanvas')
  mark(typeof createImageBitmap === 'function', 'createImageBitmap')
  mark(typeof WebAssembly === 'object', 'WebAssembly')
  mark(!!navigator.mediaDevices?.getUserMedia, 'getUserMedia')
  mark(isSecureContext, 'contexto seguro (HTTPS)')

  let convertToBlob = false
  let transferToImageBitmap = false
  try {
    const c = new OffscreenCanvas(8, 8)
    transferToImageBitmap = typeof c.transferToImageBitmap === 'function'
    convertToBlob = typeof c.convertToBlob === 'function'
  } catch { /* queda en false */ }
  mark(transferToImageBitmap, 'OffscreenCanvas.transferToImageBitmap')
  mark(convertToBlob, 'OffscreenCanvas.convertToBlob')

  // Un canvas del tamaño real de la pieza. Algunos móviles tienen tope de área
  // y devuelven un lienzo en blanco sin avisar de nada.
  let bigCanvas = false
  try {
    const c = new OffscreenCanvas(EXPORT.width, EXPORT.height)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, EXPORT.width, EXPORT.height)
    const p = ctx.getImageData(EXPORT.width - 2, EXPORT.height - 2, 1, 1).data
    bigCanvas = p[0] > 200
  } catch { /* queda en false */ }
  mark(bigCanvas, `canvas de ${EXPORT.width}×${EXPORT.height}`, bigCanvas ? '' : 'LIENZO EN BLANCO')

  const gl = document.createElement('canvas').getContext('webgl2')
  mark(!!gl, 'WebGL2')
  if (gl) {
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    if (info) say(`   GPU: ${gl.getParameter(info.UNMASKED_RENDERER_WEBGL)}`)
  }
  say()

  say('── ASSETS ──')
  for (const [label, url] of [
    ['modelo segmentador', DETECTION.segmenterModelPath],
    ['modelo rostro', DETECTION.faceModelPath],
    ['wasm', DETECTION.wasmPath + '/vision_wasm_internal.wasm'],
    ['imagen de prueba', IMAGES.model],
  ] as const) {
    try {
      const r = await fetch(url, { method: 'GET' })
      const size = (await r.blob()).size
      mark(r.ok && size > 0, label, `${r.status} · ${(size / 1024).toFixed(0)} KB`)
    } catch (e) {
      mark(false, label, String(e))
    }
  }
  say()

  say('── SEGMENTACION ──')
  say('(cargando MediaPipe, puede tardar en la primera vez…)')
  try {
    const { loadSegmenter } = await import('./vision/visionLoader')
    const t0 = performance.now()
    const segmenter = await loadSegmenter()
    mark(true, 'segmentador cargado', `${Math.round(performance.now() - t0)} ms · delegate ${DETECTION.delegate}`)

    const labels = (segmenter as unknown as { getLabels?: () => string[] }).getLabels?.()
    say(`   etiquetas: ${labels ? JSON.stringify(labels) : 'no disponibles'}`)

    const { segmentPerson } = await import('./vision/segmentation')
    const bmp = await pruebaFrame()
    const t1 = performance.now()
    const mask = await segmentPerson(bmp)
    const ms = Math.round(performance.now() - t1)
    bmp.close()

    // Se comparan MEDIAS, no sumas: la banda central ocupa ~30 % del area y la
    // de fuera ~70 %, asi que sumar haria ganar siempre al lado mas grande
    // aunque la mascara fuese correcta.
    let dentro = 0
    let nDentro = 0
    let fuera = 0
    let nFuera = 0
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) {
        const v = mask.data[y * mask.width + x]
        // La figura ocupa la franja central; las esquinas superiores son fondo
        // casi seguro incluso con la persona cerca.
        const central = x > mask.width * 0.3 && x < mask.width * 0.7 && y > mask.height * 0.25
        if (central) { dentro += v; nDentro++ } else { fuera += v; nFuera++ }
      }
    }
    const medDentro = dentro / Math.max(1, nDentro)
    const medFuera = fuera / Math.max(1, nFuera)
    const total = mask.width * mask.height
    let cubierto = 0
    for (let i = 0; i < mask.data.length; i++) if (mask.data[i] >= 0.5) cubierto++

    say(`   inferencia: ${ms} ms · mascara ${mask.width}×${mask.height}`)
    say(`   persona detectada: ${((cubierto / total) * 100).toFixed(1)} % del encuadre`)

    say(`   confianza media: ${medDentro.toFixed(2)} en la figura · ${medFuera.toFixed(2)} fuera`)

    const ratio = medDentro / Math.max(0.001, medFuera)
    if (cubierto / total < 0.02) {
      say('   ✗ MASCARA VACIA — la persona se borraria de la pieza')
    } else if (ratio < 1) {
      say('   ✗ MASCARA INVERTIDA — hay mas confianza fuera de la figura que dentro')
    } else {
      say('   ✓ mascara coherente')
    }
  } catch (e) {
    mark(false, 'segmentacion', e instanceof Error ? (e.stack ?? e.message) : String(e))
  }

  say()
  say('── FIN ──')
}

/** Figura clara sobre fondo plano: silueta de cabeza y hombros. */
async function pruebaFrame(): Promise<ImageBitmap> {
  const w = 405
  const h = 720
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#1b2436'
  ctx.fillRect(0, 0, w, h)
  try {
    const person = await createImageBitmap(await (await fetch(IMAGES.model)).blob())
    const s = Math.max(w / person.width, h / person.height)
    ctx.drawImage(person, (w - person.width * s) / 2, (h - person.height * s) * 0.1, person.width * s, person.height * s)
    person.close()
  } catch {
    // Sin la foto real se usa una silueta pintada: peor sujeto, pero permite
    // distinguir "no detecta nada" de "no pudo cargar la imagen".
    ctx.fillStyle = '#d9a889'
    ctx.beginPath()
    ctx.ellipse(w / 2, h * 0.3, w * 0.16, h * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(w * 0.28, h * 0.42, w * 0.44, h * 0.58)
  }
  return c.transferToImageBitmap()
}

run().catch((e) => say('FALLA GLOBAL: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e))))
