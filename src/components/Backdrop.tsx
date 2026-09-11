import { BRAND, IMAGES } from '../config'
import { AssetImage } from './AssetImage'

/**
 * Fondo de marca: el rojo con haces de luz de las maquetas.
 *
 * Es el MISMO en las cuatro pantallas que lo llevan (01, 02, 04 y 05). Hubo una
 * variante `deep`, un terciopelo oscuro para la pantalla de carga, que venía
 * del brief inicial: el diseño no la recogió. En el Figma las cuatro pantallas
 * apuntan al mismo nodo de fondo, con la misma posición y el mismo tamaño, así
 * que la variante se eliminó. Mientras existió, la 04 pedía un
 * `backdrop-deep.png` que nadie iba a entregar y arrastraba el marcador
 * turquesa de "falta este archivo" en cada pase.
 *
 * `fallback` sigue ahí por si el PNG no cargara: una aproximación en degradado
 * que permite revisar la maqueta sin pantalla en negro.
 */
export function Backdrop() {
  return (
    <AssetImage
      src={IMAGES.backdrop}
      label="fondo rojo con haces de luz"
      fit="cover"
      style={{ inset: 0, width: '100%', height: '100%' }}
      fallback={<div className="absolute inset-0" style={{ background: MAIN_GRADIENT }} />}
    />
  )
}

const MAIN_GRADIENT = [
  `linear-gradient(118deg, transparent 38%, rgba(255,255,255,0.16) 41%, transparent 44%)`,
  `linear-gradient(112deg, transparent 20%, rgba(255,255,255,0.10) 24%, transparent 27%)`,
  `radial-gradient(120% 90% at 22% 8%, ${BRAND.colors.primary} 0%, ${BRAND.colors.primaryDeep} 46%, #5E0714 100%)`,
].join(', ')
