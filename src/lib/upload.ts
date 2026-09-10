import { RESULT } from '../config'

/**
 * STUB de subida.
 *
 * Todavía no hay backend. Se genera un identificador local y se devuelve la URL
 * que codificará el QR, para que el flujo completo (pantalla 05 incluida) se
 * pueda probar de punta a punta.
 *
 * Cuando exista el endpoint, lo único que cambia es el cuerpo de esta función:
 * sube el blob, y devuelve la URL que responda el servidor. La firma se queda
 * igual a propósito.
 */
export async function uploadPiece(blob: Blob, meta: { wordId: string }): Promise<string> {
  const id = createId()
  console.info('[upload] stub — la pieza no se envía a ningún sitio', {
    id,
    wordId: meta.wordId,
    bytes: blob.size,
    type: blob.type,
  })
  return `${RESULT.downloadBaseUrl}/${id}`
}

function createId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
