import { BRAND, BRAND_ARC } from '../config'
import { RevlonLogo } from './RevlonLogo'

/**
 * Arco blanco de marca con el logotipo.
 *
 * Es un círculo de 931 px cuyo centro queda por encima del borde superior:
 * solo se ve el arco de abajo y su filo dorado. Aparece en las pantallas 01,
 * 02, 04 y 05; en la 03 el vídeo va a sangre y no lleva arco.
 */
export function BrandArc() {
  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{
          left: BRAND_ARC.x,
          top: BRAND_ARC.y,
          width: BRAND_ARC.size,
          height: BRAND_ARC.size,
          borderRadius: '50%',
          background: BRAND.colors.white,
          border: `${BRAND_ARC.borderWidth}px solid ${BRAND.colors.gold}`,
          boxShadow: '0 18px 60px rgba(0,0,0,0.28)',
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        style={{ top: BRAND_ARC.logo.top }}
      >
        <RevlonLogo width={BRAND_ARC.logo.width} color={BRAND.colors.primary} />
      </div>
    </>
  )
}
