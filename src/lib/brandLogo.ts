/**
 * Wordmark oficial de Revlon, en un solo `path` vectorial.
 *
 * Única fuente de verdad para el logo: de aquí sale tanto el `<svg>` que
 * pinta `RevlonLogo.tsx` en el DOM como el bitmap que se rasteriza para
 * componerlo en el canvas de la pieza final (`loadLogoBitmap` más abajo). Un
 * solo trazado, dos consumidores — así nunca se pueden desincronizar.
 */
export const REVLON_LOGO_VIEWBOX = { width: 316, height: 52 } as const

export const REVLON_LOGO_PATH =
  'M32.7926 28.4122C36.8689 28.2296 46.5424 24.3967 46.5424 15.2708C46.5424 7.36161 38.2682 2.06855 27.8646 2.06855H0V51.1662H8.76092V29.2639H23.1191L42.1619 51.2879H53.4781L32.7926 28.4122ZM8.76092 25.796V5.47558H26.952C34.4961 5.47558 37.9032 10.4644 37.9032 15.3316C37.9032 21.0505 33.5227 25.8569 25.796 25.8569H8.76092V25.796ZM154.837 2.12939L135.733 40.8843L115.535 2.12939H105.679L131.718 51.2271H134.517L159.157 2.12939H154.837ZM223.951 0C208.254 0 192.984 11.3162 192.984 25.3093C192.984 40.0325 207.159 46.0557 214.521 45.9948C212.452 44.5347 210.445 43.3179 208.619 41.2493C205.456 37.6598 202.657 33.2793 202.657 25.3093C202.657 12.533 212.209 3.40702 224.012 3.40702C235.815 3.40702 245.123 13.1414 245.123 25.3093C245.123 37.4773 237.457 47.8809 225.655 47.8809H174.975L175.036 2.12939H166.458V51.2271H225.655C240.378 51.2271 254.736 39.2416 254.736 25.3093C254.736 11.377 239.769 0 223.951 0ZM307.362 2.12939H303.712V37.1122L269.763 2.12939H262.584V51.5312L266.296 51.4704V11.377L304.929 51.2271H307.362V2.12939ZM69.5398 47.5767V28.473H90.712V24.8835H69.5398V5.77977H100.021L98.1345 2.12939H60.9614V51.2271H101.359L103.245 47.5767H69.5398ZM315.393 5.17138C315.393 6.81405 314.116 8.15252 312.412 8.15252C310.769 8.15252 309.431 6.87489 309.431 5.17138C309.431 3.5287 310.708 2.19023 312.412 2.19023C314.116 2.19023 315.393 3.5287 315.393 5.17138ZM309.978 5.17138C309.978 6.57069 311.013 7.72665 312.473 7.72665C313.872 7.72665 314.967 6.63153 314.967 5.17138C314.967 3.77206 313.933 2.61611 312.473 2.61611C311.013 2.61611 309.978 3.77206 309.978 5.17138ZM311.804 6.87489H311.378V3.46786H312.716C313.507 3.46786 313.811 3.77206 313.811 4.4413C313.811 5.0497 313.385 5.29306 312.96 5.41474L313.994 6.93573H313.507L312.534 5.41474H311.804V6.87489ZM312.351 4.98886C312.838 4.98886 313.385 4.98886 313.385 4.38046C313.385 3.89374 312.96 3.77206 312.595 3.77206H311.804V4.92802H312.351V4.98886Z'

/**
 * Devuelve el markup SVG del logotipo, listo para envolver en un blob.
 *
 * `width`/`height` explícitos en la raíz, no solo `viewBox`: sin ellos,
 * `createImageBitmap()` no tiene tamaño intrínseco del que partir y falla con
 * `InvalidStateError: The source image could not be decoded` en vez de
 * rasterizar el SVG.
 */
export function revlonLogoSvgMarkup(color: string): string {
  const { width, height } = REVLON_LOGO_VIEWBOX
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${REVLON_LOGO_PATH}" fill="${color}"/></svg>`
}

const bitmapCache = new Map<string, Promise<ImageBitmap>>()

/**
 * Rasteriza el logotipo a un `ImageBitmap` de un color y ancho concretos, para
 * componerlo en el canvas de la pieza. Se cachea por color+ancho: la pieza
 * puede pedir el mismo logo cientos de veces en una jornada de kiosco.
 */
export function loadLogoBitmap(color: string, width: number): Promise<ImageBitmap> {
  const key = `${color}@${Math.round(width)}`
  let promise = bitmapCache.get(key)
  if (!promise) {
    promise = rasterize(color, width)
    bitmapCache.set(key, promise)
  }
  return promise
}

/**
 * `createImageBitmap()` alimentado directamente con un Blob de SVG no es
 * fiable en Chromium — falla con `InvalidStateError: The source image could
 * not be decoded` incluso con `width`/`height` explícitos en la raíz. El
 * camino que sí funciona en todos los motores es el clásico: decodificar el
 * SVG a través de un `<img>` (su pipeline de carga de imágenes SÍ soporta
 * SVG) y, ya decodificado, pedirle a `createImageBitmap` un bitmap DE ESA
 * imagen — no del blob crudo.
 */
async function rasterize(color: string, width: number): Promise<ImageBitmap> {
  const height = (width / REVLON_LOGO_VIEWBOX.width) * REVLON_LOGO_VIEWBOX.height
  const blob = new Blob([revlonLogoSvgMarkup(color)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImageElement(url)
    // Redimensiona al tamaño final pedido: el trazo sale nítido en vez de
    // heredar la resolución por defecto con la que el navegador decodifica el SVG.
    return await createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(width)),
      resizeHeight: Math.max(1, Math.round(height)),
      resizeQuality: 'high',
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`No se pudo decodificar la imagen: ${url}`))
    image.src = url
  })
}
