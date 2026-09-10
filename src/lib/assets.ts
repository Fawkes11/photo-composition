import { DEBUG, EXPORT, FONT_FACES, LAYERS, MISSING_ASSET } from '../config'

/**
 * Carga de capas y tipografías.
 *
 * Si una capa del diseñador no responde, en vez de romper (o de obligar a
 * commitear PNG falsos) se genera un placeholder del tamaño exacto de la pieza.
 * En cuanto el archivo aparezca en /public/layers, empieza a usarse solo: no
 * hay que tocar código.
 *
 * Ojo con el modo dev de Vite: una ruta que no existe bajo /public no devuelve
 * 404, devuelve el index.html de la SPA con estado 200. Por eso el fallo que se
 * ve en consola no es "404" sino "The source image could not be decoded" — el
 * fetch va bien y lo que revienta es createImageBitmap sobre un HTML.
 */

type LayerImage = ImageBitmap
type PlaceholderSpec = { fill: string }

const layerCache = new Map<string, Promise<LayerImage>>()

/** Carga una capa PNG; si no está disponible, devuelve el placeholder. */
export function loadLayer(path: string, placeholder: PlaceholderSpec): Promise<LayerImage> {
  const cached = layerCache.get(path)
  if (cached) return cached

  const promise = fetchImage(path).catch((error) => {
    console.info(`[assets] ${path} no disponible; se usa placeholder`, error instanceof Error ? error.message : error)
    return makePlaceholder(placeholder)
  })

  layerCache.set(path, promise)
  return promise
}

async function fetchImage(path: string): Promise<ImageBitmap> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const blob = await response.blob()
  if (blob.size === 0) throw new Error('archivo vacío')
  return createImageBitmap(blob)
}

/**
 * Placeholder del tamaño de la pieza para cuando falta un PNG de capa. El
 * titular "SÉ INOLVIDABLE" no se dibuja aquí — lo pinta siempre el pipeline
 * (ver CLAIM_TEXT).
 *
 * La capa FRENTE tiene `fill: 'transparent'`, así que su placeholder es un
 * lienzo vacío: si el PNG no está, la pieza sale como si esa capa no existiera,
 * que es exactamente lo que se quiere en la pieza final.
 *
 * El marco de "falta este archivo" está detrás de `DEBUG.missingLayerFrame` y
 * apagado por defecto. Antes se dibujaba siempre, y como era rojo sobre un
 * fondo rojo acababa colándose en la composición como si fuera parte del
 * diseño. Ahora, si se enciende, sale en el turquesa de `MISSING_ASSET`.
 */
function makePlaceholder(spec: PlaceholderSpec): ImageBitmap {
  const canvas = new OffscreenCanvas(EXPORT.width, EXPORT.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear el placeholder')

  if (spec.fill !== 'transparent') {
    ctx.fillStyle = spec.fill
    ctx.fillRect(0, 0, EXPORT.width, EXPORT.height)
  }

  if (DEBUG.missingLayerFrame) {
    ctx.strokeStyle = MISSING_ASSET.color
    ctx.lineWidth = 8
    ctx.strokeRect(40, 40, EXPORT.width - 80, EXPORT.height - 80)
  }

  return canvas.transferToImageBitmap()
}

/** Capa 1 — FONDO. */
export function loadBackLayer(path?: string): Promise<LayerImage> {
  return loadLayer(path ?? LAYERS.backDefault, LAYERS.placeholders.back)
}

/**
 * Capa 3 — FRENTE. Opcional y sin archivo por defecto.
 *
 * En esta composición lo único que va delante de la persona es texto que pinta
 * la app (la palabra elegida, su frase y el wordmark), así que sin `path` no
 * hay nada que cargar y se devuelve `null`. Solo se busca un PNG cuando una
 * entrada de `WORDS` declara `frontLayer` explícitamente.
 */
export function loadFrontLayer(path?: string): Promise<LayerImage | null> {
  if (!path) return Promise.resolve(null)
  return loadLayer(path, LAYERS.placeholders.front)
}

/* ─────────────────────── TIPOGRAFÍAS ───────────────────────── */

let fontsPromise: Promise<void> | null = null

/**
 * Carga las tipografías de marca y espera a que estén listas ANTES de dibujar
 * en canvas.
 *
 * Un `@font-face` de CSS no se descarga hasta que un elemento del DOM lo usa
 * — pintar texto en canvas no cuenta como "uso" para el navegador. Por eso no
 * hay `@font-face` en index.css: cada fuente se registra a mano con la API
 * `FontFace`, se fuerza su descarga con `.load()` y se añade al registro
 * global con `document.fonts.add()`. Ese registro es el mismo que usan tanto
 * el DOM como el canvas, así que una vez cargada aquí sirve para los dos.
 *
 * El `family`/`weight`/`style` de cada entrada de `FONT_FACES` tiene que
 * coincidir EXACTAMENTE con lo que se pide luego al componer (`BRAND.fonts.*`
 * + `fontWeight` en `TEXT_LAYERS`): si no coincide, `ctx.font` no encuentra la
 * cara registrada y cae al respaldo del sistema sin avisar.
 */
export function ensureFontsReady(): Promise<void> {
  fontsPromise ??= (async () => {
    await Promise.all(
      FONT_FACES.map(async ({ family, url, weight, style }) => {
        try {
          const face = new FontFace(family, `url(${url})`, { weight, style })
          await face.load()
          document.fonts.add(face)
        } catch (error) {
          console.warn(`[assets] no se pudo cargar la fuente "${family}" desde ${url}; se usa el respaldo`, error)
        }
      }),
    )
    // Por si algún otro font-face (del sistema, o cargado por CSS) sigue en
    // curso; no hace daño esperarlo también.
    await document.fonts.ready
  })()
  return fontsPromise
}

/** Precarga en la pantalla de inicio, mientras nadie está esperando. */
export async function preloadLayerAssets(): Promise<void> {
  await Promise.all([loadBackLayer(), ensureFontsReady()])
}
