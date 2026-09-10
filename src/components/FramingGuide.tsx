import { DESIGN, FRAMING } from '../config'
import type { GuideStatus } from '../vision/faceValidation'

/**
 * Guía de encuadre de MEDIO CUERPO: cabeza + hombros + torso.
 *
 * Deliberadamente no es un óvalo de rostro — la pieza necesita a la persona de
 * cintura para arriba, y un óvalo entrena al usuario a acercarse de más.
 *
 * Se dibuja en coordenadas DESIGN, el mismo espacio en el que la validación
 * compara la caja del rostro. Lo que se ve es lo que se valida.
 */

const { head, torso, body } = FRAMING

/** Silueta construida desde los números de config, no escrita a mano. */
const TORSO_PATH = [
  `M ${head.cx - torso.waistHalfWidth} ${torso.bottomY}`,
  `C ${head.cx - torso.waistHalfWidth} ${torso.bottomY - 330},`,
  `${head.cx - torso.shoulderHalfWidth} ${torso.neckY + 70},`,
  `${head.cx - torso.neckHalfWidth} ${torso.neckY}`,
  `L ${head.cx + torso.neckHalfWidth} ${torso.neckY}`,
  `C ${head.cx + torso.shoulderHalfWidth} ${torso.neckY + 70},`,
  `${head.cx + torso.waistHalfWidth} ${torso.bottomY - 330},`,
  `${head.cx + torso.waistHalfWidth} ${torso.bottomY}`,
].join(' ')

function strokeFor(status: GuideStatus): string {
  if (status === 'ok') return FRAMING.colors.valid
  if (status === 'loading') return FRAMING.colors.idle
  if (status === 'searching' || status === 'fallback') return FRAMING.colors.searching
  return FRAMING.colors.invalid
}

export function FramingGuide({ status }: { status: GuideStatus }) {
  const stroke = strokeFor(status)
  const isValid = status === 'ok'

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={DESIGN.width}
      height={DESIGN.height}
      viewBox={`0 0 ${DESIGN.width} ${DESIGN.height}`}
      aria-hidden="true"
    >
      <defs>
        {/* Oscurece todo menos el interior de la guía. */}
        <mask id="guide-cutout">
          <rect x="0" y="0" width={DESIGN.width} height={DESIGN.height} fill="white" />
          <ellipse cx={head.cx} cy={head.cy} rx={head.rx + 46} ry={head.ry + 46} fill="black" />
          <path d={`${TORSO_PATH} Z`} fill="black" />
        </mask>
        <filter id="guide-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect
        x="0"
        y="0"
        width={DESIGN.width}
        height={DESIGN.height}
        fill="#2E040E"
        mask="url(#guide-cutout)"
        opacity={isValid ? FRAMING.dim.valid : FRAMING.dim.idle}
        style={{ transition: 'opacity 300ms' }}
      />

      <g
        fill="none"
        stroke={stroke}
        strokeWidth={FRAMING.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={isValid ? 'url(#guide-glow)' : undefined}
        style={{ transition: 'stroke 250ms ease' }}
      >
        <ellipse
          cx={head.cx}
          cy={head.cy}
          rx={head.rx}
          ry={head.ry}
          strokeDasharray={isValid ? undefined : '24 20'}
        />
        <path d={TORSO_PATH} strokeDasharray={isValid ? undefined : '24 20'} />
        <CornerBrackets />
      </g>
    </svg>
  )
}

/** Escuadras en las esquinas de la caja de encuadre: leen como "visor". */
function CornerBrackets() {
  const arm = 54
  const { x, y, width: w, height: h } = body
  return (
    <>
      <path d={`M ${x} ${y + arm} L ${x} ${y} L ${x + arm} ${y}`} />
      <path d={`M ${x + w - arm} ${y} L ${x + w} ${y} L ${x + w} ${y + arm}`} />
      <path d={`M ${x} ${y + h - arm} L ${x} ${y + h} L ${x + arm} ${y + h}`} />
      <path d={`M ${x + w - arm} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h - arm}`} />
    </>
  )
}
