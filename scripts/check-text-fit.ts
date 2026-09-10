/**
 * Verificación del ajuste automático de texto contra las 30 frases reales.
 *   node --experimental-strip-types scripts/check-text-fit.ts
 *
 * Usa un ctx falso cuyo ancho es proporcional al número de caracteres: no
 * sustituye a mirar la pieza, pero detecta al instante que una caja de
 * TEXT_LAYERS se ha quedado pequeña para alguna frase.
 */
import { layoutText } from '../src/lib/textLayout.ts'
import { TEXT_LAYERS, WORDS } from '../src/config.ts'

// ctx falso: ancho proporcional al numero de caracteres, como una fuente real.
const AVG = 0.47
let currentSize = 10
const ctx = {
  set font(value: string) { currentSize = Number.parseFloat(/(\d+(?:\.\d+)?)px/.exec(value)![1]) },
  get font() { return `${currentSize}px` },
  measureText: (text: string) => ({ width: text.length * currentSize * AVG }),
} as unknown as CanvasRenderingContext2D

let failures = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) { failures++; console.log('FALLA:', name, extra) }
}

console.log('frase'.padEnd(52), 'px', 'lineas')
for (const w of WORDS) {
  const word = layoutText(ctx, w.word, TEXT_LAYERS.word)
  const phrase = layoutText(ctx, w.phrase, TEXT_LAYERS.phrase)

  check(`${w.id}: la palabra cabe en una linea`, word.lines.length === 1, JSON.stringify(word.lines))
  check(`${w.id}: la palabra va en mayusculas`, word.lines[0] === w.word.toLocaleUpperCase('es-ES'))
  check(`${w.id}: la palabra respeta el ancho`, word.lines[0].length * word.fontSize * AVG <= TEXT_LAYERS.word.box.width + 0.5)
  check(`${w.id}: tamano dentro del rango`, word.fontSize <= TEXT_LAYERS.word.maxFontSize && word.fontSize >= TEXT_LAYERS.word.minFontSize)

  check(`${w.id}: la frase respeta el maximo de lineas`, phrase.lines.length <= TEXT_LAYERS.phrase.maxLines, JSON.stringify(phrase.lines))
  check(`${w.id}: la frase respeta el ancho`, phrase.lines.every((l) => l.length * phrase.fontSize * AVG <= TEXT_LAYERS.phrase.box.width + 0.5), JSON.stringify(phrase.lines))
  check(`${w.id}: la frase cabe en alto`, phrase.height <= TEXT_LAYERS.phrase.box.height + 0.5)
  check(`${w.id}: no se pierde texto`, phrase.lines.join(' ').replace(/\s+/g, ' ') === w.phrase.replace(/\s+/g, ' '), JSON.stringify(phrase.lines))

  console.log(w.phrase.padEnd(52), String(phrase.fontSize).padStart(3), phrase.lines.length)
}

// Caso extremo: frase larguisima de dos oraciones
const brutal = 'Esta es una frase deliberadamente larguisima que nadie escribiria jamas en una pieza. Pero si alguien lo hace, la app no puede romperse por ello.'
const hard = layoutText(ctx, brutal, TEXT_LAYERS.phrase)
check('frase extrema: no supera el maximo de lineas', hard.lines.length <= TEXT_LAYERS.phrase.maxLines, JSON.stringify(hard.lines))
console.log('\nextrema ->', hard.fontSize, 'px,', hard.lines.length, 'lineas:', hard.lines)

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} fallo(s)`)
process.exit(failures === 0 ? 0 : 1)
