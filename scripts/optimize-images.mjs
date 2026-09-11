/**
 * Optimiza las imágenes de /public/images para la descarga inicial del kiosco.
 *
 *   node scripts/optimize-images.mjs
 *
 * Los ORIGINALES no se tocan: se copian a `assets-originales/` antes de nada.
 * Esa carpeta queda fuera del build, así que no se descarga nunca, pero sigue
 * ahí para poder rehacer esto con otros ajustes o recuperar una entrega del
 * diseñador.
 *
 * ── Por qué una tabla a mano y no "optimiza todo" ──
 *
 * Porque el criterio NO es uniforme y un plugin automático se equivoca en los
 * dos sentidos:
 *
 *   swatch.png         mide 1254 px y se dibuja a 222  → hay que reducirla
 *   product-glimmer.png mide 1254 px y se dibuja a 1321 → NO hay que tocarla
 *
 * Encoger la segunda la dejaría borrosa en la pantalla de resultado, que es
 * donde más se mira. Por eso cada imagen lleva aquí escrito a qué tamaño se
 * dibuja de verdad, sacado de LAYOUT en src/config.ts.
 *
 * ── Por qué x2 ──
 *
 * El escenario son 1080x1920 px de DISEÑO que se escalan por CSS al tamaño real
 * de la pantalla del tótem. Si esa pantalla tiene más densidad, una imagen
 * guardada al tamaño exacto se vería blanda. Se reserva el doble.
 */
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ENTRADA = 'public/images'
const ORIGINALES = 'assets-originales/images'

/** Mayor lado con el que cada imagen se DIBUJA, en px de diseño. */
const USO = {
  // Ocupa la pantalla entera. Ya está justo a 1080x1920.
  'backdrop.png': { dibujadaA: 1920, nota: 'fondo a pantalla completa' },
  // Pantalla 01: dos revistas, la mayor de 655x704.
  'mockup-magazine.png': { dibujadaA: 704, nota: 'atrezo de la 01' },
  // Pantalla 01: el tablero de post-its, 600x702.
  'mockup-board.png': { dibujadaA: 702, nota: 'atrezo de la 01' },
  // OJO: en la pantalla 05 se dibuja a 1321, MÁS GRANDE que su original.
  // Reducirla la dejaría borrosa justo donde más se mira.
  'product-glimmer.png': { dibujadaA: 1321, nota: 'enorme en la 05 — no reducir' },
  // El caso claro: 1254 px de origen para dibujarse a 222.
  'swatch.png': { dibujadaA: 222, nota: 'muy sobredimensionada' },
  'mockup-phone.png': { dibujadaA: 377, nota: 'ya está al tamaño justo' },
  'lips.png': { dibujadaA: 192, nota: 'ya está al tamaño justo' },
  // No la usa ninguna pantalla: solo el diagnóstico y los bancos de pruebas.
  // Se conserva porque el diagnóstico la necesita, pero no hace falta grande.
  'model.png': { dibujadaA: 450, nota: 'solo diagnóstico y dev' },
}

const CALIDAD = 86

function kb(n) {
  return `${Math.round(n / 1024)} KB`
}

async function main() {
  mkdirSync(ORIGINALES, { recursive: true })

  const archivos = readdirSync(ENTRADA).filter((f) => f.endsWith('.png') || f.endsWith('.jpg'))
  let antes = 0
  let despues = 0

  console.log(`${'imagen'.padEnd(24)} ${'antes'.padStart(9)} ${'después'.padStart(9)}   qué se hizo`)
  console.log('-'.repeat(78))

  for (const archivo of archivos) {
    const origen = join(ENTRADA, archivo)
    const copia = join(ORIGINALES, archivo)

    // El original se guarda ANTES de tocar nada. Si ya hay copia, se respeta:
    // así volver a ejecutar el script no sobreescribe el original con una
    // versión ya optimizada.
    if (!existsSync(copia)) copyFileSync(origen, copia)

    const uso = USO[archivo]
    if (!uso) {
      console.log(`${archivo.padEnd(24)} ${'—'.padStart(9)} ${'—'.padStart(9)}   sin entrada en la tabla, SE DEJA`)
      continue
    }

    const pesoAntes = statSync(copia).size
    antes += pesoAntes

    const meta = await sharp(copia).metadata()
    const tope = uso.dibujadaA * 2
    const reducir = meta.width > tope

    let pipe = sharp(copia)
    if (reducir) pipe = pipe.resize({ width: tope, withoutEnlargement: true })

    const salida = join(ENTRADA, archivo.replace(/\.(png|jpg)$/, '.webp'))
    await pipe.webp({ quality: CALIDAD, effort: 6 }).toFile(salida)

    const pesoDespues = statSync(salida).size
    despues += pesoDespues

    // El PNG original ya está a salvo en assets-originales/: aquí se borra para
    // que no viaje al hosting una copia pesada que nadie descarga.
    unlinkSync(origen)

    const que = reducir ? `${meta.width}→${tope} px + WebP` : 'WebP'
    console.log(
      `${archivo.padEnd(24)} ${kb(pesoAntes).padStart(9)} ${kb(pesoDespues).padStart(9)}   ${que} · ${uso.nota}`,
    )
  }

  console.log('-'.repeat(78))
  console.log(
    `${'TOTAL'.padEnd(24)} ${kb(antes).padStart(9)} ${kb(despues).padStart(9)}   ` +
      `−${Math.round((1 - despues / antes) * 100)} %`,
  )
  console.log(`\nOriginales intactos en ${ORIGINALES}/`)
  console.log('Recuerda actualizar las rutas de IMAGES en src/config.ts a .webp')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
