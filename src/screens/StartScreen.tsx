import { useEffect } from 'react'
import { BRAND, IMAGES, LAYOUT } from '../config'
import { AssetImage } from '../components/AssetImage'
import { Backdrop } from '../components/Backdrop'
import { LensFlares } from '../components/LensFlare'
import { LightBeams } from '../components/LightBeam'
import { BrandArc } from '../components/BrandArc'
import { ScreenLayer } from '../components/Stage'
import { ArrowIcon, CurvedArrow, QrIcon, SelfiePhoneIcon, TapIcon } from '../components/icons'
import { preloadLayerAssets } from '../lib/assets'
import { warmUpVision } from '../vision/visionLoader'
import { useKioskStore } from '../store/kioskStore'

const L = LAYOUT.start

/**
 * 01 · INICIO — pantalla atractora.
 *
 * Cualquier toque avanza; el botón está para quien necesita que se lo digan.
 * Aprovecha el tiempo de reposo para precargar wasm, modelos y capas: cuando el
 * usuario llegue a la cámara ya no habrá nada que descargar.
 */
export function StartScreen() {
  const goToWordSelection = useKioskStore((s) => s.goToWordSelection)

  useEffect(() => {
    warmUpVision()
    void preloadLayerAssets()
  }, [])

  return (
    <ScreenLayer>
      <Backdrop />
      <LensFlares flares={L.flares} />
      <LightBeams beams={L.beams} />

      {/* Capa que hace que cualquier toque de la pantalla avance. */}
      <button type="button" onClick={goToWordSelection} className="absolute inset-0 h-full w-full" aria-label="Comenzar" />

      <BrandArc />

      <h1
        className="glow-text pointer-events-none absolute text-center leading-none"
        style={{
          left: L.title.x,
          top: L.title.y,
          width: L.title.width,
          fontSize: L.title.fontSize,
          letterSpacing: `${L.title.letterSpacing}em`,
          whiteSpace: 'nowrap',
          color: BRAND.colors.white,
          fontFamily: BRAND.fonts.display,
        }}
      >
        BE UNFORGETTABLE
      </h1>

      <p
        className="pointer-events-none absolute text-center"
        style={{
          left: L.subtitle.x,
          top: L.subtitle.y,
          width: L.subtitle.width,
          fontSize: L.subtitle.fontSize,
          lineHeight: L.subtitle.lineHeight,
          color: BRAND.colors.white,
          fontFamily: BRAND.fonts.body,
        }}
      >
        Elige una palabra, pruébate el producto
        <br />y crea tu pieza personalizada para compartir.
      </p>

      <InstructionsCard />

      {/* Atrezo. En el Figma son DOS revistas superpuestas, no una. */}
      {L.magazines.map((magazine, index) => (
        <AssetImage
          key={index}
          src={IMAGES.mockupMagazine}
          label="revista"
          fit="cover"
          className="pointer-events-none"
          style={{ left: magazine.x, top: magazine.y, width: magazine.width, height: magazine.height }}
        />
      ))}
      <AssetImage
        src={IMAGES.mockupBoard}
        label="tablero"
        fit="cover"
        className="pointer-events-none"
        style={{ left: L.board.x, top: L.board.y, width: L.board.width, height: L.board.height }}
      />

      <div
        className="pointer-events-none absolute rounded-full flex items-center justify-center gap-4"
        style={{
          left: L.pill.x,
          top: L.pill.y,
          width: L.pill.width,
          height: L.pill.height,
          background: BRAND.colors.primary,
          color: BRAND.colors.white,
          boxShadow: '0 12px 30px rgba(60,0,10,0.45)',
        }}
      >
        <span
          className="whitespace-nowrap"
          style={{ left: L.pill.eligesX, top: L.pill.eligesY, fontFamily: BRAND.fonts.display, fontSize: L.pill.eligesFontSize }}
        >
          TÚ ELIGES.
        </span>
        <span
          className=" whitespace-nowrap"
          style={{ left: L.pill.taglineX, top: L.pill.taglineY, fontFamily: BRAND.fonts.script, fontSize: L.pill.taglineFontSize }}
        >
          Tú Eres Inolvidable.
        </span>
      </div>

      <button
        type="button"
        onClick={goToWordSelection}
        className="kiosk-button absolute transition-transform duration-150 active:scale-[0.97]"
        style={{
          left: L.cta.x,
          top: L.cta.y,
          width: L.cta.width,
          height: L.cta.height,
          borderRadius: L.cta.radius,
          background: BRAND.colors.white,
          color: BRAND.colors.primary,
          fontFamily: BRAND.fonts.display,
          fontSize: L.cta.fontSize,
          letterSpacing: '0.06em',
          boxShadow: '0 16px 40px rgba(40,0,8,0.45)',
        }}
      >
        INICIAR
      </button>
    </ScreenLayer>
  )
}

/** Tarjeta blanca con los tres pasos de la mecánica. */
function InstructionsCard() {
  const red = BRAND.colors.primary

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: L.card.x,
        top: L.card.y,
        width: L.card.width,
        height: L.card.height,
        borderRadius: L.card.radius,
        background: BRAND.colors.white,
        boxShadow: '0 26px 70px rgba(30,0,6,0.45)',
      }}
    >
      {/* Paso 1 */}
      <div
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full"
        style={{ top: L.stepIcon.top, width: L.stepIcon.size, height: L.stepIcon.size, background: red }}
      >
        <TapIcon size={L.stepIcon.size * 0.56} style={{ color: BRAND.colors.white }} />
      </div>
      <p
        className="absolute left-0 right-0 text-center"
        style={{ top: L.step1.top, fontSize: L.step1.fontSize, color: red, fontFamily: BRAND.fonts.display }}
      >
        1. ELIGE LA PALABRA QUE MÁS TE DEFINA.
      </p>
      <div
        className="absolute"
        style={{
          top: L.divider.top,
          left: L.divider.inset,
          right: L.divider.inset,
          height: 2,
          background: 'rgba(228,0,43,0.30)',
        }}
      />

      {/* Paso 2 */}
      <p
        className="absolute text-center"
        style={{
          top: L.stepsRow.top,
          left: 24,
          width: 300,
          fontSize: L.stepsRow.fontSize,
          color: red,
          fontFamily: BRAND.fonts.display,
        }}
      >
        2. PRUEBA EL PRODUCTO
      </p>
      <AssetImage
        src={IMAGES.swatch}
        label="swatch"
        fit="contain"
        style={{ left: L.swatch.x, top: L.swatch.y, width: L.swatch.size, height: L.swatch.size }}
      />
      <AssetImage
        src={IMAGES.product}
        label="producto"
        fit="contain"
        style={{
          left: L.product.x,
          top: L.product.y,
          width: L.product.size,
          height: L.product.size,
          transform: `rotate(${L.product.rotate}deg)`,
        }}
      />

      {/* Separador vertical entre pasos 2 y 3 */}
      <div
        className="absolute"
        style={{
          left: L.card.width / 2 - 1,
          top: L.columnDivider.top,
          width: 2,
          height: L.columnDivider.height,
          background: 'rgba(228,0,43,0.30)',
        }}
      />

      {/* Paso 3 */}
      <p
        className="absolute text-center leading-[1.2]"
        style={{
          top: L.stepsRow.top,
          right: 24,
          width: 300,
          fontSize: L.stepsRow.fontSize,
          color: red,
          fontFamily: BRAND.fonts.display,
        }}
      >
        3. HAZ TU MEJOR POSE, TOMÁTE LA FOTO Y RECIBELA POR QR
      </p>
      <div
        className="absolute flex items-center justify-center"
        style={{ top: L.howToIcons.top, right: 24, width: 300, gap: 26, color: red }}
      >
        <SelfiePhoneIcon size={L.howToIcons.selfieWidth} />
        <ArrowIcon size={L.shortArrow.width} />
        <QrIcon size={L.howToIcons.qrSize} />
      </div>
      <CurvedArrow
        width={110}
        height={140}
        className="absolute"
        style={{ right: 96, top: L.howToIcons.top + 120, color: red }}
      />

      {/* Mockup del resultado */}
      <AssetImage
        src={IMAGES.mockupPhone}
        label="mockup de móvil"
        fit="contain"
        style={{ left: L.phone.x, top: L.phone.y, width: L.phone.width, height: L.phone.height }}
      />

      {/* Banda "Nuestra pared de lo inolvidable" */}
      <div
        className="absolute"
        style={{
          left: L.wallBand.x,
          top: L.wallBand.y,
          width: L.wallBand.width,
          height: L.wallBand.height,
          background: 'linear-gradient(to right, rgba(247,185,196,0.95) 0%, rgba(247,185,196,0.75) 62%, rgba(247,185,196,0) 100%)',
        }}
      />
      <p
        className="absolute leading-[1.1]"
        style={{ left: 44, top: L.wallBand.y + 26, width: 260, fontSize: 27, color: '#8E0C1E', fontFamily: BRAND.fonts.display }}
      >
        NUESTRA PARED
        <br />
        DE LO INOLVIDABLE
      </p>
      <p
        className="absolute"
        style={{ left: 44, top: L.wallBand.y + 92, width: 250, fontSize: 20, lineHeight: 1.25, color: '#6E0A17', fontFamily: BRAND.fonts.body }}
      >
        Tu palabra se suma a muchas otras para inspirar a más personas.
      </p>

      <AssetImage
        src={IMAGES.lips}
        label="marca de labios"
        fit="contain"
        style={{ left: L.lips.x, top: L.lips.y, width: L.lips.width, height: L.lips.height }}
      />
    </div>
  )
}
