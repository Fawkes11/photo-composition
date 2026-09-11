import { RESULT, UPLOAD } from '../config'

/**
 * Sube la pieza al backend y devuelve la URL que codificará el QR.
 *
 * Dos reglas que mandan sobre todo lo demás:
 *
 * 1. SIN BACKEND CONFIGURADO no se toca la red. `UPLOAD.baseUrl` vacío devuelve
 *    una URL local de mentira, igual que hacía el stub, para poder recorrer el
 *    flujo entero sin depender de nada.
 *
 * 2. SI LA SUBIDA FALLA, la pieza se entrega igual. Esto corre con el usuario
 *    delante mirando "procesando", y en una feria el wifi se cae. Es preferible
 *    entregar la foto sin QR que dejar a alguien esperando sin fin o, peor,
 *    perder su pieza por un problema de red. Por eso devuelve `null` en vez de
 *    lanzar: quien llama decide qué enseñar.
 */
export async function uploadPiece(blob: Blob, meta: { wordId: string }): Promise<string | null> {
  if (!UPLOAD.baseUrl) {
    const id = createId()
    console.info('[upload] sin backend configurado; no se envía nada', { id, wordId: meta.wordId })
    return `${RESULT.downloadBaseUrl}/${id}`
  }

  for (let intento = 0; intento <= UPLOAD.retries; intento++) {
    try {
      const url = await enviar(blob, meta)
      if (intento > 0) console.info(`[upload] recuperado en el intento ${intento + 1}`)
      return url
    } catch (error) {
      const ultimo = intento === UPLOAD.retries
      console.warn(`[upload] intento ${intento + 1}/${UPLOAD.retries + 1} falló`, error)
      if (ultimo) {
        console.error('[upload] se entrega la pieza sin QR')
        return null
      }
      // Espera creciente: si el wifi está saturado, insistir de inmediato no ayuda.
      await new Promise((r) => setTimeout(r, 400 * (intento + 1)))
    }
  }

  return null
}

async function enviar(blob: Blob, meta: { wordId: string }): Promise<string> {
  // AbortController y no solo el timeout del fetch: sin esto una conexión que
  // se queda colgada bloquea la pantalla de procesado indefinidamente.
  const abort = new AbortController()
  const corte = window.setTimeout(() => abort.abort(), UPLOAD.timeoutMs)

  try {
    const response = await fetch(`${UPLOAD.baseUrl}/p`, {
      method: 'POST',
      body: blob,
      // La palabra viaja en cabecera, no en el cuerpo: así el cuerpo es la
      // imagen pura y el Worker no tiene que desmontar un multipart.
      headers: { 'content-type': 'image/jpeg', 'x-kiosk-word': meta.wordId },
      signal: abort.signal,
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = (await response.json()) as { url?: string }
    if (!data.url) throw new Error('la respuesta no trae url')
    return data.url
  } finally {
    window.clearTimeout(corte)
  }
}

function createId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
