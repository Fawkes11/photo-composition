import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { BRAND, DEBUG, IMAGES, LAYOUT, MISSING_ASSET, RESULT } from '../config'
import { AssetImage } from '../components/AssetImage'
import { Backdrop } from '../components/Backdrop'
import { LensFlares } from '../components/LensFlare'
import { LightBeams } from '../components/LightBeam'
import { BrandArc } from '../components/BrandArc'
import { ScreenLayer } from '../components/Stage'
import { useKioskStore, type ComposedPiece } from '../store/kioskStore'

const L = LAYOUT.result

/**
 * 05 · RESULTADO — pieza compuesta + QR de descarga.
 */
export function ResultScreen() {
  const piece = useKioskStore((s) => s.piece)
  const word = useKioskStore((s) => s.selectedWord())
  const retake = useKioskStore((s) => s.retake)
  const reset = useKioskStore((s) => s.reset)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!piece) return
    let cancelled = false
    QRCode.toDataURL(piece.downloadUrl, {
      width: RESULT.qr.sizePx,
      margin: RESULT.qr.margin,
      errorCorrectionLevel: RESULT.qr.errorCorrectionLevel,
      color: { dark: RESULT.qr.dark, light: RESULT.qr.light },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch((err) => console.error('[qr] no se pudo generar', err))
    return () => {
      cancelled = true
    }
  }, [piece])

  return (
    <ScreenLayer>
      <Backdrop />
      <LensFlares flares={L.flares} />
      <LightBeams beams={L.beams} />
      <BrandArc />

      {/* El producto asoma por la esquina inferior derecha, como en la maqueta. */}
      <AssetImage
        src={IMAGES.product}
        label="producto"
        fit="contain"
        style={{ left: L.product.x, top: L.product.y, transform: `rotate(${L.product.rotation ?? 0}deg)`, width: L.product.size, height: L.product.size }}
      />

      <h2
        className="glow-text absolute text-center leading-none"
        style={{
          left: L.title.x,
          top: L.title.y,
          width: L.title.width,
          fontSize: L.title.fontSize,
          color: BRAND.colors.white,
          fontFamily: BRAND.fonts.display,
        }}
      >
        DESCARGA TU ESTILO.
      </h2>
      <p
        className="absolute text-center"
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
        Escanea el siguiente código QR para descargar tu foto.
      </p>

      <PiecePreview piece={piece} word={word?.word} />

      <div
        className="absolute flex items-center justify-center bg-white"
        style={{
          left: L.qr.x,
          top: L.qr.y,
          width: L.qr.width,
          height: L.qr.height,
          borderRadius: L.qr.radius,
          padding: L.qr.padding,
          boxShadow: '0 16px 44px rgba(0,0,0,0.35)',
        }}
      >
        {qrDataUrl && <img src={qrDataUrl} alt="QR de descarga" className="h-full w-full" />}
      </div>

      <ResultButton label="TOMAR DE NUEVO" onClick={retake} top={L.buttons.top} />
      <ResultButton label="FINALIZAR" onClick={reset} top={L.buttons.top + L.buttons.height + L.buttons.gap} />

      {DEBUG.downloadPiece && piece && <DownloadPieceBar piece={piece} wordId={word?.id ?? 'pieza'} />}
    </ScreenLayer>
  )
}

/**
 * Pieza compuesta dentro de su marco dorado.
 *
 * El marco y la foto son elementos SEPARADOS, como en el Figma: el marco mide
 * 376×639 y la foto 333×592 centrada dentro, lo que deja el aire de ~22 px que
 * el diseño pide. Antes el borde se pintaba sobre la propia imagen, así que no
 * había ningún hueco.
 *
 * El trazo va con el degradado "Gold", no con un oro plano. Como el marco no
 * tiene relleno, no basta con poner el degradado de fondo: hay que recortarlo
 * a un anillo. Eso lo hace la máscara doble de abajo — una capa cubre el área
 * interior y otra el elemento entero, y al excluir una de otra solo sobrevive
 * el borde. Es la forma estándar de tener un borde con degradado dejando ver
 * el fondo a través del centro.
 */
function PiecePreview({ piece, word }: { piece: ComposedPiece | null; word?: string }) {
  const { frame, photo } = L.preview

  // Recorta el relleno y deja solo el anillo del grosor del trazo.
  const soloElAnillo = {
    padding: frame.border,
    background: BRAND.gradients.gold,
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    maskComposite: 'exclude',
  } as const

  return (
    <>
      {/* Trazo nítido. */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
          borderRadius: frame.radius,
          ...soloElAnillo,
        }}
      />
      {/* La misma pieza difuminada encima: el halo del Figma (Rectangle 3). */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: frame.x,
          top: frame.y,
          width: frame.width,
          height: frame.height,
          borderRadius: frame.radius,
          filter: `blur(${frame.glowBlur}px)`,
          ...soloElAnillo,
        }}
      />

      {/* La foto, centrada en el marco. */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: frame.x + (frame.width - photo.width) / 2,
          top: frame.y + (frame.height - photo.height) / 2,
          width: photo.width,
          height: photo.height,
          borderRadius: photo.radius,
          boxShadow: photo.shadow,
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        {piece && <img src={piece.objectUrl} alt={`Pieza ${word ?? ''}`} className="h-full w-full object-cover" />}
      </div>
    </>
  )
}

/**
 * Barra de depuración: descarga la pieza tal cual sale del pipeline, a
 * resolución real, y muestra su peso y dimensiones.
 *
 * Se apaga con `DEBUG.downloadPiece` en config. En la activación la pieza se
 * entrega por QR — este botón es solo para revisarla fuera del kiosco.
 */
function DownloadPieceBar({ piece, wordId }: { piece: ComposedPiece; wordId: string }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    createImageBitmap(piece.blob)
      .then((bitmap) => {
        if (cancelled) {
          bitmap.close()
          return
        }
        setSize({ width: bitmap.width, height: bitmap.height })
        bitmap.close()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [piece])

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const extension = piece.blob.type.includes('png') ? 'png' : 'jpg'
    const link = document.createElement('a')
    link.href = piece.objectUrl
    link.download = `pieza-${wordId}-${stamp}.${extension}`
    document.body.append(link)
    link.click()
    link.remove()
  }

  const kilobytes = Math.round(piece.blob.size / 1024)

  return (
    <button
      type="button"
      onClick={download}
      className="kiosk-button absolute left-1/2 -translate-x-1/2"
      style={{
        bottom: 22,
        height: 56,
        paddingLeft: 30,
        paddingRight: 30,
        borderRadius: 12,
        background: MISSING_ASSET.color,
        color: BRAND.colors.black,
        fontFamily: BRAND.fonts.body,
        fontWeight: 700,
        fontSize: 25,
        // Sin esto el ancho disponible es solo media pantalla (por el
        // left:50%) y la etiqueta se parte en dos líneas.
        whiteSpace: 'nowrap',
      }}
    >
      ⬇ DEBUG · DESCARGAR {size ? `· ${size.width}×${size.height} ` : ''}· {kilobytes} KB
    </button>
  )
}

function ResultButton({ label, onClick, top }: { label: string; onClick: () => void; top: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="kiosk-button absolute transition-transform duration-150 active:scale-[0.97]"
      style={{
        left: L.buttons.x,
        top,
        width: L.buttons.width,
        height: L.buttons.height,
        borderRadius: L.buttons.radius,
        background: BRAND.colors.white,
        color: BRAND.colors.primary,
        fontFamily: BRAND.fonts.display,
        fontSize: L.buttons.fontSize,
        letterSpacing: '0.02em',
        boxShadow: '0 12px 30px rgba(60,0,10,0.38)',
      }}
    >
      {label}
    </button>
  )
}
