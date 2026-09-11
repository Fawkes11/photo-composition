/**
 * Comparativa de tonos del destello.
 *
 *   npm run dev  →  http://localhost:5173/dev/flare-tones.html
 *
 * La paleta original de JS.LensFlare tira a verde; `hueShift` la rota. El valor
 * que usa hoy la app la lleva al rosa/rojo de marca. Aquí se pintan varios
 * giros sobre el rojo real del fondo para comparar a ojo, que es la única forma
 * sensata de elegir un tono.
 *
 * Usa el componente `LensFlare` DE VERDAD, no una copia del dibujado: si se
 * reimplanta la cadena de fantasmas aquí, la comparativa acaba mostrando algo
 * que no es lo que pinta la app.
 */
import { createRoot } from 'react-dom/client'
import { BRAND, DECOR } from '../src/config'
import { LensFlare } from '../src/components/LensFlare'

const SIZE = 300

const TONOS: readonly { tint: string; etiqueta: string }[] = [
  { tint: DECOR.flareTints.ninguno, etiqueta: 'ninguno · ACTUAL' },
  { tint: DECOR.flareTints.dorado, etiqueta: 'dorado' },
  { tint: DECOR.flareTints.ambar, etiqueta: 'ambar' },
  { tint: DECOR.flareTints.oro, etiqueta: 'oro' },
]

// Exportada solo para satisfacer a react-refresh: este archivo es un punto de
// entrada, no un modulo, pero la regla exige que un .tsx con componentes
// exporte algo.
export function Celda({ tint, etiqueta }: { tint: string; etiqueta: string }) {
  return (
    <figure style={{ margin: 0 }}>
      <div
        style={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
          overflow: 'hidden',
          borderRadius: 6,
          // El rojo profundo del fondo: hay que juzgar el tono donde va a vivir.
          background: BRAND.colors.primaryDeep,
        }}
      >
        <LensFlare flare={{ x: 0, y: 0, size: SIZE, tint }} />
      </div>
      <figcaption style={{ textAlign: 'center', paddingTop: 6, color: '#bbb' }}>{etiqueta}</figcaption>
    </figure>
  )
}

createRoot(document.getElementById('out')!).render(
  <>
    {TONOS.map((tono) => (
      <Celda key={tono.etiqueta} {...tono} />
    ))}
  </>,
)
