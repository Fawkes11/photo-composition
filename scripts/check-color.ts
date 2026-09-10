/**
 * Verificación de la matemática de color, sin navegador.
 *   node --experimental-strip-types scripts/check-color.ts
 * Ejecútalo si tocas las curvas de PHOTO_STYLES o el parser de .cube.
 */
import { buildCurveTable, parseCubeLut, applyLut, applyCurves } from '../src/lib/lut.ts'

let failures = 0
const check = (name: string, ok: boolean, extra = '') => {
  if (!ok) { failures++; console.log('FALLA:', name, extra) } else console.log('ok  :', name)
}

// Curva identidad
const identity = buildCurveTable([[0, 0], [0.5, 0.5], [1, 1]])
check('curva identidad extremos', identity[0] === 0 && identity[255] === 255)
check('curva identidad centro', Math.abs(identity[128] - 128) <= 2, String(identity[128]))

// Monotonía de una S
const s = buildCurveTable([[0, 0.02], [0.25, 0.22], [0.5, 0.52], [0.75, 0.8], [1, 0.99]])
let monotone = true
for (let i = 1; i < 256; i++) if (s[i] < s[i - 1]) monotone = false
check('curva en S monotona', monotone)
check('curva en S levanta sombras', s[0] > 0, String(s[0]))

// .cube 2x2x2 que invierte el rojo
const cube = `TITLE "test"
LUT_3D_SIZE 2
DOMAIN_MIN 0 0 0
DOMAIN_MAX 1 1 1
1 0 0
0 0 0
1 1 0
0 1 0
1 0 1
0 0 1
1 1 1
0 1 1`
const lut = parseCubeLut(cube)
check('cube tamano', lut.size === 2)
check('cube entradas', lut.table.length === 24)

const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255])
applyLut(px, lut, 1)
check('LUT invierte el rojo', px[0] === 0 && px[1] === 0, `${px[0]},${px[1]},${px[2]}`)
check('LUT conserva el verde', px[5] === 255, `${px[4]},${px[5]},${px[6]}`)
check('LUT no toca el alfa', px[3] === 255)

// Saturación 0 => gris
const gray = new Uint8ClampedArray([200, 40, 90, 255])
applyCurves(gray, { rgb: identity, r: identity, g: identity, b: identity }, 0)
check('saturacion 0 da gris', gray[0] === gray[1] && gray[1] === gray[2], `${gray[0]},${gray[1]},${gray[2]}`)

console.log(failures === 0 ? '\nTODO OK' : `\n${failures} fallo(s)`)
process.exit(failures === 0 ? 0 : 1)
