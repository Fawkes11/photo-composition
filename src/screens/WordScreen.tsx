import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { BRAND, LAYOUT, WORDS } from '../config'
import { Backdrop } from '../components/Backdrop'
import { LensFlares } from '../components/LensFlare'
import { LightBeams } from '../components/LightBeam'
import { BrandArc } from '../components/BrandArc'
import { ScreenLayer } from '../components/Stage'
import { useKioskStore } from '../store/kioskStore'

const L = LAYOUT.word

/**
 * 02 · SELECCIÓN DE PALABRA
 *
 * Lista de una columna con píldoras blancas, según la maqueta. El scroll vive
 * solo aquí: el contenedor lleva `overscroll-behavior: contain` y
 * `touch-action: pan-y`, así el gesto no se propaga al documento ni dispara el
 * pull-to-refresh.
 */
export function WordScreen() {
  const selectWord = useKioskStore((s) => s.selectWord)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const thumb = useScrollThumb(scrollerRef)

  return (
    <ScreenLayer>
      <Backdrop />
      <LensFlares flares={L.flares} />
      <LightBeams beams={L.beams} />
      <BrandArc />

      <h2
        className="glow-text absolute left-0 right-0 text-center leading-none"
        style={{ top: L.title.y, fontSize: L.title.fontSize, color: BRAND.colors.white, fontFamily: BRAND.fonts.display }}
      >
        ¿CÓMO ERES?
      </h2>
      <p
        className="absolute left-0 right-0 text-center"
        style={{ top: L.subtitle.y, fontSize: L.subtitle.fontSize, color: BRAND.colors.white, fontFamily: BRAND.fonts.body }}
      >
        Selecciona la palabra que más te defina.
      </p>

      <div
        ref={scrollerRef}
        className="word-scroller absolute"
        style={{ left: L.list.x, top: L.list.y, width: L.list.width, height: L.list.height }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${L.columns}, minmax(0, 1fr))`,
            // Filas y columnas NO llevan el mismo hueco: 48 entre filas (que es
            // lo que da el paso de 130 del Figma) y 33 entre columnas.
            rowGap: L.itemGap,
            columnGap: L.columnGap,
          }}
        >
          {WORDS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectWord(option.id)}
              className="kiosk-button flex items-center justify-center transition-transform duration-150 active:scale-[0.97]"
              style={{
                height: L.itemHeight,
                borderRadius: L.itemRadius,
                background: BRAND.colors.white,
                color: BRAND.colors.primary,
                fontFamily: BRAND.fonts.body,
                fontSize: L.itemFontSize,
                boxShadow: '0 10px 26px rgba(60,0,10,0.34)',
              }}
            >
              {option.word}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de desplazamiento propia: la nativa no se ve sobre el rojo. */}
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: L.scrollbar.x,
          top: L.list.y,
          width: L.scrollbar.width,
          height: L.list.height,
          background: 'rgba(255,255,255,0.9)',
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          left: L.scrollbar.x,
          top: L.list.y + thumb.offset,
          width: L.scrollbar.width,
          height: thumb.height,
          background: BRAND.colors.primaryDeep,
          transition: 'top 90ms linear',
        }}
      />

      {/* Degradado que insinúa que la lista sigue hacia abajo. */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: L.bottomFade,
          background: `linear-gradient(to top, rgba(70,4,16,0.85), transparent)`,
        }}
      />
    </ScreenLayer>
  )
}

/**
 * Posición y tamaño del pulgar de la barra de desplazamiento, en px de DESIGN.
 * Se calcula del scroller real para que refleje el recorrido de verdad.
 */
function useScrollThumb(ref: RefObject<HTMLDivElement | null>) {
  const [thumb, setThumb] = useState<{ offset: number; height: number }>({ offset: 0, height: L.list.height })

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    const { scrollHeight, clientHeight, scrollTop } = element
    if (scrollHeight <= clientHeight) {
      setThumb({ offset: 0, height: L.list.height })
      return
    }
    const height = Math.max(90, (clientHeight / scrollHeight) * L.list.height)
    const travel = L.list.height - height
    const progress = scrollTop / (scrollHeight - clientHeight)
    setThumb({ offset: progress * travel, height })
  }, [ref])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    measure()
    element.addEventListener('scroll', measure, { passive: true })
    return () => element.removeEventListener('scroll', measure)
  }, [ref, measure])

  return thumb
}
