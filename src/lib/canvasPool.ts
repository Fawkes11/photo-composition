/**
 * Pool de canvas offscreen.
 *
 * El pipeline necesita 4-6 lienzos temporales por pieza. Crearlos en cada
 * ciclo deja al GC persiguiendo buffers de 8 MB y, tras unos cientos de
 * capturas en feria, la pestaña se hincha. Aquí se reutilizan por tamaño.
 */

type PooledCanvas = {
  canvas: OffscreenCanvas
  ctx: OffscreenCanvasRenderingContext2D
  inUse: boolean
}

const pool: PooledCanvas[] = []

/** Tope de lienzos retenidos entre ciclos. Por encima, se sueltan. */
const MAX_POOLED = 8

function makeCanvas(width: number, height: number): PooledCanvas {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('No se pudo crear el contexto 2D offscreen')
  return { canvas, ctx, inUse: true }
}

/** Toma un lienzo del pool con el tamaño pedido, ya limpio. */
export function acquire(width: number, height: number): PooledCanvas {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))

  let entry = pool.find((c) => !c.inUse && c.canvas.width === w && c.canvas.height === h)
  if (!entry) {
    entry = pool.find((c) => !c.inUse)
    if (entry) {
      entry.canvas.width = w
      entry.canvas.height = h
    }
  }
  if (!entry) {
    entry = makeCanvas(w, h)
    pool.push(entry)
  }

  entry.inUse = true
  // Redimensionar ya limpia; si reusamos el mismo tamaño hay que limpiar a mano.
  entry.ctx.setTransform(1, 0, 0, 1, 0, 0)
  entry.ctx.globalAlpha = 1
  entry.ctx.globalCompositeOperation = 'source-over'
  entry.ctx.filter = 'none'
  entry.ctx.clearRect(0, 0, w, h)
  return entry
}

export function release(entry: PooledCanvas): void {
  entry.inUse = false
}

/**
 * Suelta los lienzos que sobran. Se llama al terminar cada pieza: mantener
 * unos pocos calientes es la mitad del beneficio; retener veinte es la fuga.
 */
export function trim(): void {
  for (let i = pool.length - 1; i >= 0 && pool.length > MAX_POOLED; i--) {
    if (!pool[i].inUse) {
      // Encoger a 1x1 libera el buffer antes de que el GC pase.
      pool[i].canvas.width = 1
      pool[i].canvas.height = 1
      pool.splice(i, 1)
    }
  }
}

/**
 * Ejecuta `fn` con un lienzo prestado y lo devuelve pase lo que pase.
 * Es la única forma recomendada de usar el pool.
 */
export async function withCanvas<T>(
  width: number,
  height: number,
  fn: (ctx: OffscreenCanvasRenderingContext2D, canvas: OffscreenCanvas) => Promise<T> | T,
): Promise<T> {
  const entry = acquire(width, height)
  try {
    return await fn(entry.ctx, entry.canvas)
  } finally {
    release(entry)
  }
}

export type { PooledCanvas }
