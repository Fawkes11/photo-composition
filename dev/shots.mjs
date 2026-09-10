/**
 * Capturas de las cinco pantallas, sin tocar el kiosco a mano.
 *
 *   npm run dev
 *   node dev/shots.mjs [urlBase] [carpetaSalida]
 *
 * Requiere Chrome escuchando CDP:
 *   chrome --headless=new --remote-debugging-port=9222
 *          --use-fake-device-for-media-stream --use-fake-ui-for-media-stream
 *
 * La cámara falsa de Chrome permite recorrer también la pantalla 03 y llegar
 * hasta el resultado con una pieza compuesta de verdad.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

/** Rutas habituales de Chrome. Se usa la primera que exista. */
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

/** Arranca Chrome en headless con CDP, salvo que ya haya uno escuchando. */
async function ensureChrome() {
  try {
    await fetch('http://127.0.0.1:9222/json/version')
    return null
  } catch {
    // No hay ninguno: se lanza.
  }

  const binary = CHROME_PATHS.find((p) => existsSync(p))
  if (!binary) throw new Error('No se encontró Chrome. Define CHROME_PATH.')

  const child = spawn(
    binary,
    [
      '--headless=new',
      '--no-sandbox',
      '--remote-debugging-port=9222',
      `--user-data-dir=${join(tmpdir(), 'kiosk-shots-profile')}`,
      // Vídeo sintético: permite recorrer también la pantalla de cámara.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()

  for (let i = 0; i < 40; i++) {
    try {
      await fetch('http://127.0.0.1:9222/json/version')
      return child
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  throw new Error('Chrome no llegó a escuchar en el puerto 9222')
}

const chrome = await ensureChrome()

const base = process.argv[2] ?? 'http://localhost:5173'
const outDir = process.argv[3] ?? 'dev/shots'
mkdirSync(outDir, { recursive: true })

const target = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)

let nextId = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return response.result?.result?.value
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Espera a que una expresión devuelva true, o se rinde. */
async function until(expression, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true
    await wait(250)
  }
  return false
}

/** Simula actividad: si no, saltaría el reset por inactividad a media sesión. */
const keepAlive = () =>
  evaluate(`window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true })), true`)

async function shot(name) {
  await keepAlive()
  await wait(700)
  const response = await send('Page.captureScreenshot', { format: 'png' })
  const file = join(outDir, `${name}.png`)
  writeFileSync(file, Buffer.from(response.result.data, 'base64'))
  console.log('→', file)
}

await new Promise((resolve) => ws.addEventListener('open', resolve))
await send('Page.enable')
await send('Runtime.enable')
// El escenario mide 1080x1920; a escala 0.5 la captura sale en 540x960.
await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 0.5, mobile: false })

const errors = []
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    errors.push(message.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description ?? 'excepción')
  }
})

if (!(await until('!!window.__kiosk'))) throw new Error('La app no arrancó')

await evaluate(`window.__kiosk.getState().reset()`)
await shot('01-inicio')

await evaluate(`window.__kiosk.getState().goToWordSelection()`)
await shot('02-palabra')

await evaluate(`window.__kiosk.getState().selectWord('audaz')`)
// Espera a que el vídeo tenga dimensiones antes de capturar.
await until(`(() => { const v = document.querySelector('video'); return !!v && v.videoWidth > 0 })()`)
await wait(1200)
await shot('03-camara')

// La cámara falsa no tiene cara: a los 8 s entra el modo por defecto y el
// botón se habilita igual. Esperarlo aquí valida ese camino de escape.
const shutter = `document.evaluate("//button[contains(., 'TOMAR FOTO')]", document, null, 9, null).singleNodeValue`
const enabled = await until(`(() => { const b = ${shutter}; return !!b && !b.disabled })()`, 15000)
console.log(enabled ? '   (botón habilitado por el modo por defecto de 8 s)' : '   ¡el botón nunca se habilitó!')
await keepAlive()
await evaluate(`${shutter}?.click()`)
await until(`window.__kiosk.getState().screen === 'processing'`, 15000)
await shot('04-procesando')

const keepAliveTimer = setInterval(() => void keepAlive(), 4000)
await until(`window.__kiosk.getState().screen === 'result'`, 30000)
clearInterval(keepAliveTimer)
await shot('05-resultado')

// La pieza compuesta, a tamaño completo.
const piece = await evaluate(`(async () => {
  const url = window.__kiosk.getState().piece?.objectUrl
  if (!url) return null
  const blob = await (await fetch(url)).blob()
  return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) })
})()`)
if (piece) {
  writeFileSync(join(outDir, 'pieza.jpg'), Buffer.from(piece.split(',')[1], 'base64'))
  console.log('→', join(outDir, 'pieza.jpg'))
}

if (errors.length) {
  console.log('\n--- errores en consola ---')
  console.log([...new Set(errors)].join('\n'))
}
process.exit(0)
