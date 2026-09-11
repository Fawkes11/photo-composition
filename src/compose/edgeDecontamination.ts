import { PERSON } from '../config'

/**
 * Descontaminación de borde: le quita al contorno el color del fondo original.
 *
 * ── El problema ──
 * Un píxel del borde del pelo no es "sujeto" ni "fondo": es una MEZCLA de los
 * dos. Lo que la cámara registra ahí es
 *
 *     C = a·F + (1 - a)·B
 *
 * donde `a` es la opacidad, `F` el color real del sujeto y `B` el del fondo.
 * Al recortar conservamos C y le bajamos la opacidad, así que el color del
 * fondo original sigue dentro — y aterriza sobre el rojo de la pieza. Es el
 * fleco azulado que se ve alrededor del pelo cuando alguien se ha retratado
 * contra una pared clara.
 *
 * Erosionar la máscara no lo arregla: recorta FORMA (y se come pelo) cuando el
 * problema es de COLOR.
 *
 * ── La corrección ──
 * Se despeja F:
 *
 *     F = (C - (1 - a)·B) / a
 *
 * `B` se estima con los píxeles de fondo cercanos: en el borde del pelo el
 * fondo de al lado es, casi siempre, el mismo que se coló.
 *
 * ── Coste ──
 * Solo se tocan los píxeles de borde (~5 % del total), no la imagen entera.
 */
export function decontaminateEdges(
  ctx: OffscreenCanvasRenderingContext2D,
  mask: OffscreenCanvas,
  width: number,
  height: number,
): void {
  const cfg = PERSON.edgeDecontamination
  if (!cfg.enabled) return

  const maskCtx = mask.getContext('2d')
  if (!maskCtx) return

  const color = ctx.getImageData(0, 0, width, height)
  const alfa = maskCtx.getImageData(0, 0, width, height)
  const px = color.data
  const ma = alfa.data

  const radio = Math.max(1, Math.round(cfg.searchRadiusPx))
  const minA = cfg.alphaMin * 255
  const maxA = cfg.alphaMax * 255

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const a255 = ma[i * 4 + 3]
      if (a255 <= minA || a255 >= maxA) continue

      // Color del fondo de alrededor. Se promedian solo los vecinos claramente
      // transparentes: los de borde ya están contaminados y no sirven de
      // referencia.
      let br = 0
      let bg = 0
      let bb = 0
      let n = 0
      // Con una docena de muestras la media del fondo local ya es estable;
      // seguir recorriendo la ventana entera no cambia el resultado y es lo que
      // más pesa de toda la función (se ejecuta por cada píxel de borde).
      busqueda: for (let dy = -radio; dy <= radio; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radio; dx <= radio; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const j = yy * width + xx
          if (ma[j * 4 + 3] > minA) continue
          br += px[j * 4]
          bg += px[j * 4 + 1]
          bb += px[j * 4 + 2]
          n++
          if (n >= 12) break busqueda
        }
      }
      // Sin fondo cerca no hay nada que restar: pasa en el interior de un
      // agujero de la máscara, donde la estimación sería inventada.
      if (n === 0) continue

      const a = a255 / 255
      const k = cfg.strength / a
      const uno = (1 - a) * cfg.strength

      px[i * 4] = limitar(px[i * 4] * (1 - cfg.strength + k * a) - (br / n) * uno, px[i * 4], a)
      px[i * 4 + 1] = limitar(px[i * 4 + 1] * (1 - cfg.strength + k * a) - (bg / n) * uno, px[i * 4 + 1], a)
      px[i * 4 + 2] = limitar(px[i * 4 + 2] * (1 - cfg.strength + k * a) - (bb / n) * uno, px[i * 4 + 2], a)
    }
  }

  ctx.putImageData(color, 0, 0)
}

/**
 * Acota el resultado del despeje.
 *
 * Dividir entre `a` amplifica cualquier error cuando la opacidad es baja, y un
 * píxel puede salir disparado a un color imposible. Se limita a 0..255 y además
 * se impide que se aleje del original más de lo razonable para su opacidad:
 * cuanto más transparente el píxel, menos fiable la estimación y menos se le
 * deja moverse.
 */
function limitar(valor: number, original: number, a: number): number {
  const margen = 255 * (1 - a) + 24
  const min = Math.max(0, original - margen)
  const max = Math.min(255, original + margen)
  return Math.max(min, Math.min(max, valor))
}
