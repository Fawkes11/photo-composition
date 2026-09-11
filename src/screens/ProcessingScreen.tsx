import { useEffect, useRef } from 'react'
import { BRAND, LAYOUT, TIMING } from '../config'
import { Backdrop } from '../components/Backdrop'
import { BrandArc } from '../components/BrandArc'
import { ScreenLayer } from '../components/Stage'
import { composePiece } from '../compose/pipeline'
import { uploadPiece } from '../lib/upload'
import { useKioskStore } from '../store/kioskStore'

const L = LAYOUT.processing

/**
 * 04 · PROCESANDO
 * Aquí corre el pipeline de composición. La pantalla permanece un mínimo de
 * `processingMinMs` aunque el pipeline acabe antes: un parpadeo de 200 ms
 * parece un error, y el usuario necesita ver que algo pasó.
 */
export function ProcessingScreen() {
  const captured = useKioskStore((s) => s.captured)
  const word = useKioskStore((s) => s.selectedWord())
  const styleId = useKioskStore((s) => s.styleId)
  const setPiece = useKioskStore((s) => s.setPiece)
  const fail = useKioskStore((s) => s.fail)

  /**
   * El pipeline se lanza UNA sola vez.
   *
   * Ojo con el patrón habitual de `let cancelled` en el cleanup: con el doble
   * montaje de StrictMode, el primer cleanup cancelaría el único trabajo en
   * vuelo y la segunda pasada no lo relanzaría por culpa de este mismo guardia
   * — la pantalla se quedaría girando para siempre.
   *
   * En su lugar, antes de aplicar el resultado se comprueba contra el store si
   * la sesión sigue siendo esta. Así un resultado tardío nunca pisa una sesión
   * que ya se reinició, y el doble montaje no rompe nada.
   */
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (!captured || !word) {
      fail('Se perdió la foto. Inténtalo de nuevo.')
      return
    }

    const stillProcessing = () => useKioskStore.getState().screen === 'processing'
    const floor = new Promise((resolve) => setTimeout(resolve, TIMING.processingMinMs))

    const run = async () => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('El procesado tardó demasiado')), TIMING.processingTimeoutMs),
      )
      try {
        const blob = await Promise.race([composePiece({ frame: captured, word, styleId }), timeout])
        const downloadUrl = await uploadPiece(blob, { wordId: word.id })
        await floor
        if (!stillProcessing()) return
        setPiece({ blob, objectUrl: URL.createObjectURL(blob), downloadUrl })
      } catch (error) {
        console.error('[pipeline] la composición falló', error)
        await floor
        if (stillProcessing()) fail('No pudimos crear tu pieza. Inténtalo otra vez.')
      }
    }

    void run()
  }, [captured, word, styleId, setPiece, fail])

  return (
    <ScreenLayer>
      <Backdrop />
      <BrandArc />

      <div
        className="spinner absolute left-1/2 -translate-x-1/2"
        style={{
          top: L.spinner.centerY - L.spinner.size / 2,
          width: L.spinner.size,
          height: L.spinner.size,
          borderWidth: L.spinner.thickness,
          borderColor: 'rgba(255,255,255,0.14)',
          borderTopColor: BRAND.colors.white,
        }}
      />

      <h2
        className="absolute left-0 right-0 text-center"
        style={{
          top: L.title.top,
          fontSize: L.title.fontSize,
          lineHeight: L.title.lineHeight,
          color: BRAND.colors.white,
          fontFamily: BRAND.fonts.display,
          // KioskDisplay solo esta registrada en 700 (ver FONT_FACES). Pedirla sin
          // declarar peso deja el emparejado en manos del navegador y cada motor lo
          // resuelve distinto: en movil el texto se desplazaba unos pixeles.
          fontWeight: 700,
        }}
      >
        <span className="block">PROCESANDO</span>
        <span className="block">TU ESTILO.</span>
      </h2>
    </ScreenLayer>
  )
}
