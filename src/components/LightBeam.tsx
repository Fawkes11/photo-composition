import { DECOR, type BeamConfig } from '../config'

/**
 * Haz de luz.
 *
 * Es el vector exportado del Figma, no una aproximación: una astilla blanca
 * afilada con DOS copias del mismo trazo apiladas y desenfocadas a distinta
 * intensidad (blur 7.6 y 11.2). Ese doble desenfoque ya viene dentro del SVG
 * — reproducirlo con `filter: blur()` daría un halo plano, no el núcleo
 * nítido con halo suave que tiene el original.
 *
 * Se probaron antes una línea recta con blur y una cuña de `conic-gradient`;
 * ninguna se parecía, porque la forma real es una astilla que se afila por
 * las dos puntas.
 */
export function LightBeam({ beam }: { beam: BeamConfig }) {
  const { asset, x, y, width, height, opacity = DECOR.beamOpacity, flip } = beam
  const { src, bleedX, bleedY } = DECOR.beamAssets[asset]

  // El desenfoque se sale de la caja del grupo. Si se pinta el SVG en la caja
  // tal cual, el haz queda desplazado y con las puntas recortadas.
  const padX = width * bleedX
  const padY = height * bleedY

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute max-w-none"
      style={{
        left: x - padX,
        top: y - padY,
        width: width + padX * 2,
        height: height + padY * 2,
        opacity,
        transform: flip ? 'scaleX(-1)' : undefined,
        mixBlendMode: DECOR.beamBlendMode,
      }}
      draggable={false}
    />
  )
}

/** Pinta todos los haces declarados para una pantalla. */
export function LightBeams({ beams }: { beams: readonly BeamConfig[] }) {
  return (
    <>
      {beams.map((beam, index) => (
        <LightBeam key={index} beam={beam} />
      ))}
    </>
  )
}
