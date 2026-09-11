/**
 * Backend del QR: guarda la pieza y sirve el enlace de descarga.
 *
 * Hace tres cosas y ninguna más:
 *
 *   POST /p       recibe la pieza, la guarda, devuelve { id, url }
 *   GET  /p/:id   la sirve al móvil que escanea el QR
 *   GET  /health  para comprobar que está vivo
 *
 * No hay base de datos. Las piezas son objetos en R2 y las métricas son objetos
 * diminutos de JSON; agregarlas es recorrer un prefijo. Para 400 piezas al día
 * montar una base de datos sería pagar complejidad por nada.
 *
 * ── Sobre las caducidades ──
 * NO se gestionan aquí. Van como reglas de ciclo de vida del bucket, por
 * prefijo, que es donde R2 las aplica solo:
 *
 *   d/   copia de descarga   caducidad corta (la del QR)
 *   a/   archivo             solo si ARCHIVE_ENABLED, caducidad larga
 *   m/   métricas            sin fotos, se pueden guardar sin problema
 *
 * Separar los prefijos es lo que permite que la copia que ve el visitante
 * caduque pronto y el archivo —si la marca lo autoriza— viva aparte y con sus
 * propias reglas. Ver backend/README.md.
 */

export interface Env {
  PIEZAS: R2Bucket
  /** 'true' activa el archivo. Apagado por defecto: guardar caras necesita permiso. */
  ARCHIVE_ENABLED?: string
  /** Orígenes autorizados a subir, separados por comas. */
  ALLOWED_ORIGINS?: string
}

const MAX_BYTES = 2 * 1024 * 1024 // una pieza real pesa ~270 KB; 2 MB es margen de sobra

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (url.pathname === '/health') return json({ ok: true }, cors)

    if (url.pathname === '/p' && request.method === 'POST') return subir(request, env, cors)

    const match = url.pathname.match(/^\/p\/([A-Za-z0-9_-]{6,64})$/)
    if (match && request.method === 'GET') return descargar(match[1], env)

    return json({ error: 'no encontrado' }, cors, 404)
  },
}

/** POST /p — la pieza llega como cuerpo binario. */
async function subir(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  if (!origenPermitido(request, env)) return json({ error: 'origen no autorizado' }, cors, 403)

  const declarado = Number(request.headers.get('content-length') ?? '0')
  if (declarado > MAX_BYTES) return json({ error: 'demasiado grande' }, cors, 413)

  const bytes = new Uint8Array(await request.arrayBuffer())
  // El content-length se puede mentir: se vuelve a comprobar con lo recibido.
  if (bytes.byteLength === 0) return json({ error: 'cuerpo vacío' }, cors, 400)
  if (bytes.byteLength > MAX_BYTES) return json({ error: 'demasiado grande' }, cors, 413)

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  const word = (request.headers.get('x-kiosk-word') ?? '').slice(0, 40)
  const ahora = new Date()
  const dia = ahora.toISOString().slice(0, 10)

  await env.PIEZAS.put(`d/${id}.jpg`, bytes, {
    httpMetadata: { contentType: 'image/jpeg' },
  })

  if (env.ARCHIVE_ENABLED === 'true') {
    await env.PIEZAS.put(`a/${dia}/${id}.jpg`, bytes, {
      httpMetadata: { contentType: 'image/jpeg' },
    })
  }

  // Métrica sin ningún dato personal: qué palabra y cuándo. Sirve para el
  // informe de la marca sin necesidad de guardar una sola cara.
  await env.PIEZAS.put(`m/${dia}/${id}.json`, JSON.stringify({ word, ts: ahora.toISOString() }), {
    httpMetadata: { contentType: 'application/json' },
  })

  const base = new URL(request.url).origin
  return json({ id, url: `${base}/p/${id}` }, cors)
}

/** GET /p/:id — lo que abre el móvil al escanear. */
async function descargar(id: string, env: Env): Promise<Response> {
  const objeto = await env.PIEZAS.get(`d/${id}.jpg`)
  if (!objeto) {
    return new Response('Esta foto ya no está disponible.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(objeto.body, {
    headers: {
      'content-type': 'image/jpeg',
      // `attachment` hace que el móvil la GUARDE en vez de solo mostrarla, que
      // es lo que la gente espera al escanear un QR de descarga.
      'content-disposition': `attachment; filename="revlon-${id}.jpg"`,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}

/**
 * CORS. El kiosco vive en otro dominio (GitHub Pages), así que sin esto el
 * navegador bloquea la subida.
 *
 * Con `ALLOWED_ORIGINS` sin definir se permite cualquier origen, que es lo
 * cómodo para desarrollo. En producción conviene ponerlo: no es seguridad de
 * verdad —una cabecera Origin se falsifica— pero filtra el abuso casual.
 */
function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('origin') ?? '*'
  return {
    'access-control-allow-origin': origenPermitido(request, env) ? origin : 'null',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-allow-headers': 'content-type, x-kiosk-word',
    'access-control-max-age': '86400',
  }
}

function origenPermitido(request: Request, env: Env): boolean {
  const permitidos = (env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  if (permitidos.length === 0) return true
  const origin = request.headers.get('origin')
  return !!origin && permitidos.includes(origin)
}

function json(body: unknown, cors: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })
}
