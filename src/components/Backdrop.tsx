import { BRAND, IMAGES } from '../config'
import { AssetImage } from './AssetImage'

/**
 * Fondo de marca.
 *
 * Pendiente de recibir: el rojo con haces de luz que aparece en las maquetas.
 * Mientras tanto, `AssetImage` deja el marcador turquesa sobre una aproximación
 * en degradado, para que la maqueta se pueda seguir revisando.
 *
 * `deep` es la variante terciopelo oscuro de la pantalla 04.
 */
export function Backdrop({ deep = false }: { deep?: boolean }) {
  const approximation = deep ? DEEP_GRADIENT : MAIN_GRADIENT

  return (
    <AssetImage
      src={deep ? IMAGES.backdropDeep : IMAGES.backdrop}
      label={deep ? 'fondo terciopelo (pantalla 04)' : 'fondo rojo con haces de luz'}
      fit="cover"
      style={{ inset: 0, width: '100%', height: '100%' }}
      fallback={<div className="absolute inset-0" style={{ background: approximation }} />}
    />
  )
}

const MAIN_GRADIENT = [
  `linear-gradient(118deg, transparent 38%, rgba(255,255,255,0.16) 41%, transparent 44%)`,
  `linear-gradient(112deg, transparent 20%, rgba(255,255,255,0.10) 24%, transparent 27%)`,
  `radial-gradient(120% 90% at 22% 8%, ${BRAND.colors.primary} 0%, ${BRAND.colors.primaryDeep} 46%, #5E0714 100%)`,
].join(', ')

const DEEP_GRADIENT = [
  `linear-gradient(120deg, transparent 45%, rgba(255,255,255,0.05) 50%, transparent 55%)`,
  `radial-gradient(110% 80% at 50% 40%, #6B0A18 0%, ${BRAND.colors.velvet} 55%, #23020A 100%)`,
].join(', ')
