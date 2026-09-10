/**
 * config.ts — ÚNICA FUENTE DE VERDAD.
 *
 * Cualquier número que el diseño pueda querer mover vive aquí.
 * Regla: si un valor mágico aparece en un componente, está mal puesto.
 *
 * Sistemas de coordenadas:
 *   - DESIGN → lienzo de autoría de la UI (1080x1920). Toda la UI se escribe en
 *              estos px y se escala por CSS al viewport real.
 *   - EXPORT → lienzo de la pieza final, compuesta en canvas offscreen.
 *   Se mantienen separados a propósito: la pieza de exportación puede cambiar
 *   de tamaño sin tocar una sola línea de UI.
 */

/* ──────────────── BASE DE DESPLIEGUE (assets de /public) ───── */

/**
 * Prefija la base del despliegue a una ruta de `/public`.
 *
 * En local `BASE_URL` es `/` y esto no cambia nada. Pero en un GitHub Pages de
 * proyecto la app cuelga de `/<repo>/`, y sin este prefijo las rutas de abajo
 * darían 404: Vite reescribe los imports que empaqueta y las referencias del
 * index.html, pero NO las cadenas que se resuelven en tiempo de ejecución —
 * que es lo que son todas estas (fetch de modelos, wasm, PNG y fuentes).
 *
 * El acceso a `import.meta.env` va defendido a propósito: config.ts también lo
 * importan los scripts de `scripts/`, que corren en Node pelado, donde
 * `import.meta.env` no existe.
 */
const BASE: string = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'

const asset = (path: string): string => `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

/* ─────────────────────────── MARCA ─────────────────────────── */

export const BRAND = {
  name: 'REVLON',
  claim: 'SÉ INOLVIDABLE',
  colors: {
    black: '#0B0B0C',
    ink: '#141416',
    white: '#FFFFFF',
    /** Rojo Revlon de los botones y titulares dentro de tarjeta. */
    primary: '#E4002B',
    /** Rojo profundo del fondo y de la pantalla de carga. */
    primaryDeep: '#8E0C1E',
    /** Casi negro rojizo: fondo de la pantalla 04. */
    velvet: '#4A0510',
    accent: '#F7C7CF',
    /** Filo dorado del arco de marca. */
    gold: '#C9A227',
    goldSoft: '#E8D9A0',
    muted: '#8A8A90',
  },
  /**
   * Degradados de marca. El oro del Figma NO es un color plano: es un estilo
   * de color llamado "Gold", un degradado metálico. Pintarlo con un hex único
   * mata el efecto — la gracia está en el salto al bronce oscuro del 4 % y en
   * los tres tonos claros del tramo final.
   */
  gradients: {
    /**
     * Estilo "Gold" del Figma, stop a stop.
     *
     * `0deg` = de ABAJO hacia arriba, y los porcentajes se miden desde la base.
     * No es un capricho: verificado muestreando el render del propio Figma, los
     * bordes superior e inferior son uniformes a lo ancho (o sea, sin
     * componente horizontal) y el bronce del 4 % cae en la base. Con un ángulo
     * diagonal esa banda oscura se iría a una esquina y el filo cambia por
     * completo.
     */
    gold:
      'linear-gradient(0deg, ' +
      '#FFF0DA 1%, #94641E 4%, #FFF2DB 83%, ' +
      '#EAC885 94%, #FBF5D1 98%, #BD9A4B 100%, #ECD8A3 100%)',
  },
  /**
   * Tipografías servidas desde /public/fonts. Se cargan por JS con la API
   * `FontFace` (ver `FONT_FACES` más abajo y `src/lib/assets.ts`), no por
   * `@font-face` en CSS: un `@font-face` normal no se descarga hasta que un
   * elemento del DOM lo usa, y pintar en canvas no cuenta como uso — la pieza
   * saldría con la tipografía de respaldo la primera vez, siempre.
   * Si por lo que sea la carga falla, el navegador cae a este mismo stack de
   * respaldo y la app sigue funcionando sin romperse.
   */
  fonts: {
    // Títulos: URW DIN Cond. El respaldo busca lo más cercano que suele haber
    // instalado antes de caer en Impact.
    display: '"KioskDisplay", "Bebas Neue", "Oswald", "Haettenschweiler", "Arial Narrow", Impact, system-ui, sans-serif',
    // Textos: Gotham Book.
    body: '"KioskBody", "Helvetica Neue", Arial, system-ui, sans-serif',
    /** Script de "Tú Eres Inolvidable". */
    script: '"KioskScript", "Brush Script MT", "Segoe Script", cursive',
  },
} as const

/**
 * Manifiesto de las tipografías reales, en /public/fonts.
 *
 * Única fuente de verdad para el loader (`ensureFontsReady` en
 * `src/lib/assets.ts`): family/weight/style DEBEN coincidir exactamente con
 * los que se usan al pedir el `ctx.font` en canvas (`BRAND.fonts.*` +
 * `fontWeight` de `TEXT_LAYERS`) — si no coinciden, el navegador no encuentra
 * la cara registrada y cae al respaldo en silencio, sin error.
 */
export const FONT_FACES = [
  // El archivo real es URW DIN Cond Bold (usWeightClass 700), no Regular.
  { family: 'KioskDisplay', url: asset('/fonts/display.ttf'), weight: '700', style: 'normal' },
  { family: 'KioskBody', url: asset('/fonts/body.otf'), weight: '400', style: 'normal' },
  { family: 'KioskScript', url: asset('/fonts/script.ttf'), weight: '400', style: 'italic' },
] as const

/* ─────────────────────── RESOLUCIONES ──────────────────────── */

/** Lienzo de autoría de la UI. Todo componente se escribe en estos px. */
export const DESIGN = { width: 1080, height: 1920 } as const

/**
 * Pieza final exportada.
 * ⚠️ El brief traía un placeholder «ANCHO x ALTO» sin rellenar: se asume el
 * mismo 1080x1920 del diseño. Este es el único lugar donde se cambia.
 */
export const EXPORT = { width: 1080, height: 1920 } as const

/* ─────────────────────────── CÁMARA ────────────────────────── */

export const CAMERA = {
  constraints: {
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 30 },
    },
  } as MediaStreamConstraints,
  /** El preview se ve en espejo: es lo natural frente a un kiosco. */
  mirrorPreview: true,
  /** La captura conserva el espejo para que la foto coincida con lo que vio. */
  mirrorCapture: true,
  /** Reintentos de getUserMedia antes de mostrar error duro. */
  retries: 2,
  retryDelayMs: 700,
} as const

/* ──────────── GUÍA DE ENCUADRE — MEDIO CUERPO ──────────────── */

/**
 * Guía dibujada en coordenadas DESIGN. No es un óvalo de rostro: es una
 * silueta de medio cuerpo (cabeza + hombros + torso hasta la cintura).
 */
export const FRAMING = {
  /** Escuadras de encuadre. Terminan por encima de la banda de controles. */
  body: { x: 190, y: 400, width: 700, height: 1000 },
  /** Óvalo de la cabeza dentro de la silueta. */
  head: { cx: 540, cy: 630, rx: 150, ry: 196 },
  /**
   * Hombros y torso. La silueta se construye con estos números, no con un path
   * escrito a mano: mover la guía es cambiar aquí y ya.
   */
  torso: { neckY: 855, bottomY: 1400, neckHalfWidth: 78, shoulderHalfWidth: 268, waistHalfWidth: 292 },
  /**
   * Zona donde debe caer el centro del rostro para dar el encuadre por bueno.
   * Más ancha que alta: perdona el balanceo lateral.
   */
  headZone: { x: 350, y: 440, width: 380, height: 400 },
  /**
   * Distancia correcta, medida por el ancho del rostro detectado y normalizada
   * al ancho del escenario (DESIGN.width).
   */
  faceWidthRatio: { min: 0.13, max: 0.28 },
  /** Histéresis: una vez válido se tolera un poco más antes de invalidar. */
  hysteresis: 0.025,
  /** Frames consecutivos válidos para entrar en OK (mata el parpadeo). */
  framesToConfirm: 5,
  /** Frames consecutivos inválidos para salir de OK. */
  framesToRelease: 10,
  colors: {
    idle: 'rgba(255,255,255,0.40)',
    searching: 'rgba(255,255,255,0.75)',
    invalid: '#FF5A70',
    valid: '#43E08F',
  },
  strokeWidth: 5,
  /** Oscurecido de lo que queda fuera de la guía. 0 = sin velo. */
  dim: { idle: 0.34, valid: 0.2 },
} as const

/* ───────────────────────── DETECCIÓN ───────────────────────── */

export const DETECTION = {
  wasmPath: asset('/mediapipe/wasm'),
  faceModelPath: asset('/models/blaze_face_short_range.tflite'),
  segmenterModelPath: asset('/models/selfie_segmenter.tflite'),
  /** Si el delegate GPU falla, se reintenta solo en CPU. */
  delegate: 'GPU' as 'GPU' | 'CPU',
  minDetectionConfidence: 0.5,
  /** Tope de inferencias por segundo en el loop de preview. */
  previewFps: 15,
  /**
   * Si en este tiempo no hubo NINGUNA detección utilizable, se habilita la
   * captura igual con el encuadre por defecto.
   */
  fallbackAfterMs: 8000,
  /**
   * Escape final: pasado este tiempo se habilita la captura SIEMPRE, aunque sí
   * haya habido detecciones pero ninguna llegue a validar.
   *
   * Sin esto, a quien el modelo ve pero nunca da por bueno —una persona en
   * silla de ruedas, una niña, alguien a contraluz— se le queda el botón
   * apagado para siempre. El brief lo dice claro: nunca bloquear al usuario.
   */
  forceEnableAfterMs: 16_000,
} as const

/* ──────────────────── TIEMPOS / INACTIVIDAD ────────────────── */

export const TIMING = {
  /** Reset a pantalla 01 tras inactividad, en cualquier paso. */
  idleResetMs: 45_000,
  /** La pantalla de inicio ya es el estado de reposo: no necesita reset. */
  idleIgnoreOnStart: true,
  /** Cuenta regresiva antes del disparo. */
  countdownFrom: 3,
  countdownStepMs: 1000,
  /** Flash blanco post-disparo. */
  flashMs: 220,
  /** La pantalla 04 dura como mínimo esto aunque el pipeline acabe antes. */
  processingMinMs: 1500,
  /** Corte de seguridad del pipeline; si se excede, error recuperable. */
  processingTimeoutMs: 20_000,
} as const

/* ─────────────── CAPA MEDIO: PERSONA EN LA PIEZA ───────────── */

/**
 * Caja destino de la persona segmentada dentro de la pieza EXPORT.
 * El frame se ajusta a esta caja con estrategia "cover" y el anclaje decide qué
 * se sacrifica (por defecto, la parte de abajo: la cabeza nunca se corta).
 */
export const PERSON = {
  /**
   * Medido sobre la composición final del diseñador: la persona arranca bajo el
   * "SÉ INOLVIDABLE" y sale por el borde inferior. El texto de la capa FRENTE
   * se dibuja encima, no debajo.
   *
   * De dónde salen estos números (era 40/300/1000×1620):
   *
   * - ANCHO 1000 → 1080. La foto llega en 9:16, así que el cover lo resuelve el
   *   ancho: la escala de dibujo es `width / 607.5`. 1000 daba 1.646 y 1080 da
   *   1.778 — exactamente un 8% más grande, y sin recortar nada de origen.
   * - ALTO 1620 → 1770 y Y 300 → 150. Sube a la persona ~8% de la pieza sin
   *   despegar la caja del borde inferior: 150 + 1770 = 1920 justo. Ese borde
   *   tiene que quedar clavado en el canto de la pieza, porque ahí es donde la
   *   máscara corta el torso; si la caja terminara antes, el corte se vería.
   * - X 40 → 0. La caja crece centrada (540 - 1080/2 = 0).
   *
   * El alto se mantiene por debajo de 1921: pasado ese punto el cover cambia de
   * lado dominante y la escala dejaría de depender del ancho.
   */
  box: { x: 0, y: 150, width: 1080, height: 1770 },
  /** 0 = arriba, 0.5 = centro, 1 = abajo. */
  anchorY: 0.06,
  anchorX: 0.5,
  /**
   * Zoom EXTRA sobre el recorte cover (1 = sin cambio).
   *
   * Ojo: esto NO es la forma de agrandar a la persona. La foto capturada llega
   * siempre en 9:16 (`captureFrame` la recorta con `computeCover`), y contra
   * esta caja el lado que manda en el cover es el ANCHO. Subir `scale` estrecha
   * el recorte de origen: a 1.08 tomaría 562 px de los 607 disponibles y
   * cortaría los lados — es decir, las manos y el producto.
   *
   * Para que la persona salga más grande se agranda la CAJA: misma región de
   * origen, dibujada a mayor tamaño, sin perder nada por los lados.
   */
  scale: 1.0,
  /** Difuminado del borde de la máscara, en px de EXPORT. Sin esto el recorte canta. */
  featherPx: 2.5,
  /**
   * La máscara de MediaPipe es una confianza 0..1. Recortar por debajo de este
   * umbral elimina el halo de fondo antes de difuminar.
   */
  maskThreshold: 0.5,
  /** Contrae (negativo) o expande la máscara antes del feather, en px. */
  maskErodePx: 1,
} as const

/* ──────────── CAPA FRENTE: TEXTO RENDERIZADO POR LA APP ────── */

export type TextBlockConfig = {
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly align: CanvasTextAlign
  readonly uppercase: boolean
  readonly fontFamily: string
  readonly fontWeight: string
  readonly maxFontSize: number
  readonly minFontSize: number
  readonly lineHeight: number
  /** Espaciado entre letras como fracción del fontSize. */
  readonly letterSpacing: number
  readonly color: string
  readonly maxLines: number
  /**
   * Hacia dónde crece el bloque dentro de su caja cuando ocupa varias líneas.
   * `middle` lo centra; `bottom` clava el borde inferior y crece hacia arriba.
   * La frase usa `bottom`: así una frase de dos líneas se aleja de la palabra
   * en vez de invadirla — el hueco entre frase y palabra es de solo ~24 px.
   */
  readonly verticalAlign: 'middle' | 'bottom'
  /** Permite partir por el punto cuando el texto tiene dos oraciones. */
  readonly splitOnSentence: boolean
  readonly shadow: { readonly color: string; readonly blur: number; readonly offsetX: number; readonly offsetY: number } | null
}

/**
 * Dos bloques en coordenadas EXPORT, medidos sobre la composición final:
 * la frase va ARRIBA ("Eres inolvidable por ser") y la palabra debajo, grande.
 * `box.width` manda: el fontSize baja hasta que el texto entra.
 * Ver src/lib/textLayout.ts.
 */
export const TEXT_LAYERS = {
  word: {
    // Frame "Frente" del Figma (371:13331): "AUDAZ" en x=308, y=1453, 408×176.
    // La caja se deja ancha (900) porque las palabras varían de largo y el
    // ajuste automático necesita sitio; lo que manda es la vertical.
    box: { x: 90, y: 1453, width: 900, height: 176 },
    align: 'center',
    uppercase: true,
    fontFamily: BRAND.fonts.display,
    // El archivo real de URW DIN Cond es un corte Bold (peso 700, ver
    // FONT_FACES): pedir un peso distinto hace que el navegador no encuentre
    // la cara registrada y caiga al respaldo del sistema.
    fontWeight: '700',
    maxFontSize: 160,
    minFontSize: 64,
    lineHeight: 1.0,
    letterSpacing: 0.02,
    color: BRAND.colors.white,
    maxLines: 1,
    verticalAlign: 'middle',
    splitOnSentence: false,
    shadow: { color: 'rgba(0,0,0,0.45)', blur: 24, offsetX: 0, offsetY: 6 },
  },
  phrase: {
    // Frame "Frente" del Figma: la frase va en x=139, y=1367, 746×63.
    // Anclada abajo: una frase de dos líneas crece hacia arriba y no invade
    // la palabra, que queda justo debajo.
    box: { x: 139, y: 1304, width: 746, height: 126 },
    align: 'center',
    uppercase: false,
    fontFamily: BRAND.fonts.body,
    fontWeight: '400',
    maxFontSize: 63,
    minFontSize: 24,
    lineHeight: 1.16,
    letterSpacing: 0,
    color: BRAND.colors.white,
    maxLines: 2,
    verticalAlign: 'bottom',
    splitOnSentence: true,
    shadow: { color: 'rgba(0,0,0,0.35)', blur: 16, offsetX: 0, offsetY: 3 },
  },
} satisfies Record<'word' | 'phrase', TextBlockConfig>

/**
 * Logotipo Revlon al pie de la pieza (capa FRENTE, por encima de la persona),
 * bajo el bloque de la palabra. Coordenadas EXPORT.
 * El wordmark vive en `src/lib/brandLogo.ts`; aquí solo su encaje en la pieza.
 */
export const PIECE_LOGO = {
  // Frame "Frente" del Figma: x=354, y=1712, 315.39 × 51.53.
  width: 315.4,
  centerX: EXPORT.width / 2,
  /** Margen desde el borde inferior de la pieza (1920 − 1712 − 51.53). */
  bottom: 156,
  color: BRAND.colors.white,
} as const

/**
 * "SÉ INOLVIDABLE" — el titular de la pieza, en coordenadas EXPORT.
 *
 * El brief decía que este texto venía incrustado en el PNG de FONDO, pero el
 * fondo entregado (`/layers/back-default.png`) NO lo trae: lo dibuja la app,
 * justo encima del fondo y por debajo de la persona — el mismo orden que
 * mostraba el desglose de capas del diseñador.
 *
 * Si algún día llega un FONDO con el texto ya incrustado, poner `render` en
 * false; si no, saldría dos veces.
 *
 * Medido sobre la composición de referencia: ~956 px de ancho, línea base en
 * y≈320.
 */
export const CLAIM_TEXT = {
  render: true,
  text: BRAND.claim,
  // Frame "Fondo" del Figma (371:13317): x=67, y=215, 947 × 176.
  fontSize: 156,
  /** Y de la línea media del texto (canvas `textBaseline: 'middle'`). */
  centerY: 300,
  letterSpacing: 0.02,
  color: BRAND.colors.white,
  /** Suave: el fondo tiene haces claros que pueden comerse el blanco. */
  shadow: { color: 'rgba(120,0,20,0.28)', blur: 22, offsetX: 0, offsetY: 4 },
} as const

/* ─────────────────────────── CAPAS PNG ─────────────────────── */

/**
 * Rutas de las capas del diseñador. Si el PNG no está, el loader genera un
 * placeholder de color sólido (src/lib/assets.ts) y la app funciona igual. Al
 * soltar el archivo en /public/layers empieza a usarse solo.
 *
 * NO hay capa FRENTE por defecto, y es a propósito. Lo único que va por encima
 * de la persona es la palabra que eligió el usuario, su frase y el wordmark —
 * y esos tres los dibuja la app en `drawWordText` / `drawLogo`, no un PNG.
 * Mientras existió un `frontDefault` apuntando a un archivo que nadie iba a
 * entregar, cada arranque hacía un fetch condenado a fallar.
 *
 * El punto de extensión sigue abierto: una entrada de `WORDS` puede declarar
 * `frontLayer` con la ruta de un PNG y esa pieza lo dibujará encima.
 */
export const LAYERS = {
  /** Capa 1 — FONDO. Incluye el texto "SÉ INOLVIDABLE" del diseñador. */
  backDefault: asset('/layers/back-default.png'),
  placeholders: {
    back: { fill: '#1A0710' },
    /** Para un `frontLayer` por palabra que no cargue: mejor nada que un marco. */
    front: { fill: 'transparent' },
  },
} as const

/* ──────────────────── ESTILOS FOTOGRÁFICOS ─────────────────── */

/** Punto de curva [entrada, salida], ambos en 0..1. */
export type CurvePoint = readonly [number, number]

export type PhotoStyle = {
  readonly id: string
  readonly label: string
  /** 1 — Suavizado de piel: desenfoque selectivo en zonas de bajo contraste. */
  readonly skinSmooth: {
    readonly enabled: boolean
    /** Radio del desenfoque, en px de EXPORT. */
    readonly radiusPx: number
    /** 0..1 — cuánto del desenfoque se mezcla en las zonas planas. */
    readonly strength: number
    /**
     * Umbral de detalle local (0..255). Por encima de este contraste el píxel
     * se deja intacto: así sobreviven ojos, pestañas, cejas y labios.
     */
    readonly detailThreshold: number
    /** Ancho de la transición entre "zona plana" y "detalle". */
    readonly detailSoftness: number
  }
  /** 2 — Color grading: LUT .cube si existe; si no, curvas por canal. */
  readonly grading: {
    readonly enabled: boolean
    /** Ruta a un .cube en /public/luts. null → usa el fallback de curvas. */
    readonly lutPath: string | null
    /** 0..1 — mezcla de la LUT contra el original. */
    readonly lutAmount: number
    /** Fallback por canal, usado cuando no hay LUT (o si falla al cargar). */
    readonly curves: {
      readonly rgb: readonly CurvePoint[]
      readonly r: readonly CurvePoint[]
      readonly g: readonly CurvePoint[]
      readonly b: readonly CurvePoint[]
    }
    /** Saturación multiplicativa después de las curvas. 1 = neutro. */
    readonly saturation: number
  }
  /** 3 — Glow: copia desenfocada compuesta con 'screen'. */
  readonly glow: {
    readonly enabled: boolean
    readonly radiusPx: number
    /** Opacidad de la copia. El brief pide 25%. */
    readonly opacity: number
    /** Corte de luminancia (0..1) del bright-pass. 0 = toda la imagen brilla. */
    readonly threshold: number
  }
  /** 4 — Viñeteado radial. */
  readonly vignette: {
    readonly enabled: boolean
    /** 0..1 — oscurecimiento máximo en la esquina. */
    readonly strength: number
    /** Radios de la caída, relativos a la media diagonal de la caja. */
    readonly innerRadius: number
    readonly outerRadius: number
    /** Centro del viñeteado, relativo a la caja (0..1). */
    readonly centerX: number
    readonly centerY: number
  }
}

const NEUTRAL: readonly CurvePoint[] = [
  [0, 0],
  [0.5, 0.5],
  [1, 1],
]

/** Tres entradas listas; hoy solo la primera está en uso. */
export const PHOTO_STYLES: readonly PhotoStyle[] = [
  {
    id: 'signature',
    label: 'Signature',
    skinSmooth: { enabled: true, radiusPx: 6, strength: 0.55, detailThreshold: 14, detailSoftness: 8 },
    grading: {
      enabled: true,
      lutPath: null, // ← asset('/luts/signature.cube') cuando llegue la LUT del diseñador
      lutAmount: 1,
      curves: {
        // S suave + sombras levantadas.
        rgb: [
          [0, 0.02],
          [0.25, 0.22],
          [0.5, 0.52],
          [0.75, 0.8],
          [1, 0.99],
        ],
        r: [
          [0, 0.01],
          [0.5, 0.53],
          [1, 1],
        ],
        g: NEUTRAL,
        b: [
          [0, 0.03],
          [0.5, 0.49],
          [1, 0.98],
        ],
      },
      saturation: 1.06,
    },
    glow: { enabled: true, radiusPx: 18, opacity: 0.25, threshold: 0.62 },
    vignette: { enabled: true, strength: 0.38, innerRadius: 0.45, outerRadius: 1.0, centerX: 0.5, centerY: 0.42 },
  },
  {
    id: 'noir',
    label: 'Noir',
    skinSmooth: { enabled: true, radiusPx: 5, strength: 0.4, detailThreshold: 16, detailSoftness: 8 },
    grading: {
      enabled: true,
      lutPath: null,
      lutAmount: 1,
      curves: {
        rgb: [
          [0, 0],
          [0.3, 0.24],
          [0.7, 0.78],
          [1, 1],
        ],
        r: NEUTRAL,
        g: NEUTRAL,
        b: NEUTRAL,
      },
      saturation: 0.3,
    },
    glow: { enabled: true, radiusPx: 26, opacity: 0.2, threshold: 0.7 },
    vignette: { enabled: true, strength: 0.55, innerRadius: 0.35, outerRadius: 1.0, centerX: 0.5, centerY: 0.45 },
  },
  {
    id: 'glossy',
    label: 'Glossy',
    skinSmooth: { enabled: true, radiusPx: 8, strength: 0.65, detailThreshold: 12, detailSoftness: 6 },
    grading: {
      enabled: true,
      lutPath: null,
      lutAmount: 1,
      curves: {
        rgb: [
          [0, 0.04],
          [0.5, 0.55],
          [1, 1],
        ],
        r: [
          [0, 0.02],
          [0.5, 0.55],
          [1, 1],
        ],
        g: NEUTRAL,
        b: [
          [0, 0.02],
          [0.5, 0.52],
          [1, 1],
        ],
      },
      saturation: 1.18,
    },
    glow: { enabled: true, radiusPx: 24, opacity: 0.3, threshold: 0.55 },
    vignette: { enabled: true, strength: 0.28, innerRadius: 0.5, outerRadius: 1.0, centerX: 0.5, centerY: 0.4 },
  },
]

export const DEFAULT_STYLE_ID = PHOTO_STYLES[0].id

export function getStyle(id: string | undefined): PhotoStyle {
  return PHOTO_STYLES.find((s) => s.id === id) ?? PHOTO_STYLES[0]
}

/* ───────────────────────── PALABRAS ────────────────────────── */

export type WordOption = {
  readonly id: string
  /** Se pinta en mayúsculas en la pieza; aquí va tal cual. */
  readonly word: string
  /** Frase asociada. Longitud libre: el ajuste automático se encarga. */
  readonly phrase: string
  /** Capas propias de esta palabra. Si falta, se usa la capa por defecto. */
  readonly backLayer?: string
  readonly frontLayer?: string
  /** Estilo fotográfico. Si falta, DEFAULT_STYLE_ID. */
  readonly styleId?: string
}

export const WORDS: readonly WordOption[] = [
  { id: 'audaz', word: 'Audaz', phrase: 'No pides permiso. Entras y el lugar cambia.' },
  { id: 'radiante', word: 'Radiante', phrase: 'La luz no te llega: sale de ti.' },
  { id: 'libre', word: 'Libre', phrase: 'Nadie más escribe tu historia.' },
  { id: 'intensa', word: 'Intensa', phrase: 'Todo o nada, siempre.' },
  { id: 'magnetica', word: 'Magnética', phrase: 'No buscas la atención. La atención te busca a ti.' },
  { id: 'feroz', word: 'Feroz', phrase: 'Suave por fuera. Imparable por dentro.' },
  { id: 'autentica', word: 'Auténtica', phrase: 'La copia nunca gana.' },
  { id: 'imparable', word: 'Imparable', phrase: 'Te caes, te levantas y sigues más rápido que antes.' },
  { id: 'valiente', word: 'Valiente', phrase: 'El miedo también viene, pero va detrás.' },
  { id: 'poderosa', word: 'Poderosa', phrase: 'Tu poder no se explica. Se nota.' },
  { id: 'unica', word: 'Única', phrase: 'De ti solo hay una versión y es la buena.' },
  { id: 'brillante', word: 'Brillante', phrase: 'Brillas incluso cuando nadie está mirando.' },
  { id: 'rebelde', word: 'Rebelde', phrase: 'Las reglas eran una sugerencia.' },
  { id: 'segura', word: 'Segura', phrase: 'Caminas como si ya lo supieras todo.' },
  { id: 'atrevida', word: 'Atrevida', phrase: 'Primero lo haces. Después lo piensas.' },
  { id: 'elegante', word: 'Elegante', phrase: 'Menos siempre fue más contigo.' },
  { id: 'salvaje', word: 'Salvaje', phrase: 'Domesticarte nunca estuvo en el plan.' },
  { id: 'sensual', word: 'Sensual', phrase: 'Hay una forma de mirar que lo dice todo.' },
  { id: 'inolvidable', word: 'Inolvidable', phrase: 'Te fuiste hace rato y todavía hablan de ti.' },
  { id: 'luminosa', word: 'Luminosa', phrase: 'Enciendes los cuartos oscuros.' },
  { id: 'fiel', word: 'Fiel', phrase: 'Fiel a ti antes que a nadie.' },
  { id: 'creativa', word: 'Creativa', phrase: 'Donde otros ven un muro, tú ves un lienzo.' },
  { id: 'invencible', word: 'Invencible', phrase: 'Ya sobreviviste a cosas peores.' },
  { id: 'magica', word: 'Mágica', phrase: 'No es suerte. Eres tú.' },
  { id: 'vibrante', word: 'Vibrante', phrase: 'Contigo el color sube de volumen.' },
  { id: 'infinita', word: 'Infinita', phrase: 'No cabes en una sola definición.' },
  { id: 'real', word: 'Real', phrase: 'Sin filtros y aun así perfecta.' },
  { id: 'reina', word: 'Reina', phrase: 'La corona nunca se te movió de sitio.' },
  { id: 'serena', word: 'Serena', phrase: 'La calma también es una forma de fuerza.' },
  { id: 'eterna', word: 'Eterna', phrase: 'Pasan las modas. Tú te quedas.' },
]

export function getWord(id: string | null): WordOption | null {
  if (!id) return null
  return WORDS.find((w) => w.id === id) ?? null
}

/* ───────────────────── RESULTADO / QR ──────────────────────── */

export const RESULT = {
  mimeType: 'image/jpeg',
  quality: 0.92,
  /** Base del enlace de descarga. El backend real la reemplaza. */
  downloadBaseUrl: 'https://descarga.ejemplo.com/p',
  qr: {
    sizePx: 420,
    margin: 1,
    dark: BRAND.colors.black,
    light: BRAND.colors.white,
    errorCorrectionLevel: 'M',
  },
} as const

/* ──────────────────── IMÁGENES DE INTERFAZ ─────────────────── */

/**
 * Recursos de la interfaz, en /public/images.
 *
 * Los que aún no han llegado se dejan apuntados igual: <AssetImage> intenta
 * cargarlos y, si fallan, pinta un marcador bien visible con su etiqueta
 * (ver src/components/AssetImage.tsx). En cuanto el archivo aparece con ese
 * nombre, el marcador desaparece solo — no hay que tocar código.
 */
export const IMAGES = {
  /* — Recibidos — */
  model: asset('/images/model.png'),
  product: asset('/images/product-glimmer.png'),
  swatch: asset('/images/swatch.png'),
  mockupPhone: asset('/images/mockup-phone.png'),
  mockupMagazine: asset('/images/mockup-magazine.png'),
  mockupBoard: asset('/images/mockup-board.png'),

  /** Fondo rojo con haces de luz, común a las pantallas 01, 02 y 05. */
  backdrop: asset('/images/backdrop.png'),
  /** Marca de labios de la tarjeta de instrucciones. */
  lips: asset('/images/lips.png'),

  /* — PENDIENTE — */
  /** Fondo terciopelo oscuro de la pantalla 04 (la de procesando). */
  backdropDeep: asset('/images/backdrop-deep.png'),
} as const

/**
 * Marcadores de material pendiente.
 *
 * `show: false` los apaga de golpe para una demo al cliente, sin quitar los
 * placeholders del código.
 */
export const MISSING_ASSET = {
  show: true,
  /** Turquesa: es el color que más canta sobre el rojo de marca. */
  color: '#00E5FF',
  tint: 'rgba(0, 229, 255, 0.22)',
  stripe: 'rgba(0, 229, 255, 0.38)',
} as const

/* ──────────────── DECORADO: HACES Y DESTELLOS ──────────────── */

/**
 * Un haz de luz.
 *
 * No se dibuja por código: es el vector exportado del Figma (una astilla
 * blanca afilada con doble desenfoque ya horneado). `x/y/width/height` son la
 * caja del grupo en Figma; el SVG se pinta un poco más grande porque el blur
 * se sale de esa caja (ver `bleed` en DECOR.beamAssets).
 */
export type BeamConfig = {
  readonly asset: 'a' | 'b'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly opacity?: number
  /** Espejo horizontal, para cruzar haces en direcciones opuestas. */
  readonly flip?: boolean
}

/** Un destello de lente. */
export type FlareConfig = {
  readonly x: number
  readonly y: number
  readonly size?: number
  /**
   * Multiplica la opacidad de todos los elementos del destello. Puede pasar
   * de 1: las opacidades de la tabla original son muy bajas (0.05–0.2) y
   * sobre el rojo de marca se quedan cortas.
   */
  readonly intensity?: number
  /** Rotación de tono aplicada a la paleta original, en grados. */
  readonly hueShift?: number
  /** Cuánto se prolonga la cadena de fantasmas más allá del centro. */
  readonly spread?: number
}

/** Aspecto compartido de los haces y los destellos. */
export const DECOR = {
  /**
   * Los haces son SVG exportados del Figma (nodos "Group 9/10/11/12").
   * Cada uno es una astilla blanca con DOS copias del mismo trazo apiladas y
   * desenfocadas a distinta intensidad (blur 7.6 y 11.2) — eso ya viene dentro
   * del archivo, no se reproduce por CSS.
   *
   * `bleed` es cuánto se sale el SVG de la caja del grupo por culpa de ese
   * desenfoque, en fracción del ancho/alto. Sin compensarlo el haz sale
   * desplazado y con las puntas cortadas.
   */
  beamAssets: {
    a: { src: asset('/images/decor/beam-a.svg'), bleedX: 0.0513, bleedY: 0.0308 },
    b: { src: asset('/images/decor/beam-b.svg'), bleedX: 0.0409, bleedY: 0.0246 },
  },
  /**
   * `overlay` es el modo del Figma, no `screen`: sobre el rojo profundo dobla
   * el brillo conservando el tono, en vez de lavarlo hacia el blanco.
   */
  beamBlendMode: 'overlay',
  beamOpacity: 1,

  /**
   * — Destello de lente (procedural, ver LensFlare.tsx) —
   *
   * De dónde sale la luz, en fracción del lienzo del destello. Abajo a la
   * izquierda: la cadena de fantasmas cruza el centro y sube hacia arriba a la
   * derecha. Es el punto espejo de (0.74, 0.24), así que el eje es el mismo;
   * lo que cambia es en qué extremo está el foco.
   */
  flareSource: { x: 0.26, y: 0.76 },
  flareDefaults: {
    size: 620,
    intensity: 2.2,
    hueShift: 250,
    spread: 2,
  },
} as const

/* ───────────────────────── DEPURACIÓN ──────────────────────── */

/**
 * Interruptores de depuración.
 *
 * ⚠️ TODOS deben quedar en `false` antes de la activación: son herramientas de
 * calibración, no funcionalidad del kiosco. Se pintan en el turquesa de
 * `MISSING_ASSET` justamente para que canten y no se olviden encendidos.
 */
export const DEBUG = {
  /**
   * Botón en la pantalla 05 para descargar la pieza a resolución real y poder
   * revisarla fuera del kiosco. En producción la pieza se entrega por QR.
   */
  downloadPiece: true,
  /**
   * HUD de calibración de la guía de encuadre en la pantalla 03: caja del
   * rostro detectado, zona objetivo y los números que decide `evaluateFraming`.
   */
  framingHud: false,
  /**
   * Marco alrededor de la pieza cuando falta un PNG de capa.
   *
   * Apagado por defecto y a propósito: mientras estuvo encendido dibujaba un
   * recuadro ROJO sobre un fondo rojo, así que no se leía como "falta un
   * archivo" sino como parte del diseño. Si se enciende, sale en el turquesa de
   * `MISSING_ASSET` — que es justo el color acordado para que no se confunda
   * con la marca.
   */
  missingLayerFrame: false,
  /**
   * Habilita "TOMAR FOTO" desde el primer momento, sin esperar a que la
   * detección dé el encuadre por bueno.
   *
   * Para probar en el tótem: ahorra los 8 s del fallback (y los 16 s del
   * escape final) en cada intento, que al hacer decenas de capturas seguidas
   * se vuelven insufribles.
   *
   * NO se salta `cameraState === 'ready'`, y es deliberado: disparar antes de
   * que el <video> tenga dimensiones hace que `captureFrame` lance.
   *
   * En la activación tiene que estar en false. La validación de encuadre es lo
   * único que evita piezas con la cabeza o los brazos cortados.
   */
  captureAlwaysEnabled: true,
} as const

/* ──────────────────────── UI / KIOSCO ──────────────────────── */

export const UI = {
  /** Duración de las transiciones entre pantallas. */
  screenFadeMs: 260,
  /** Aviso visible antes de que caduque la sesión por inactividad. */
  idleWarningMs: 8000,
} as const

/**
 * Arco blanco de marca: el círculo que asoma por el borde superior con el
 * logotipo dentro y el filo dorado. Presente en las pantallas 01, 02, 04 y 05
 * (en la 03 el vídeo va a sangre).
 *
 * Es una elipse cuyo centro queda fuera de pantalla; solo se ve el arco de
 * abajo. Medido sobre las maquetas: cruza el borde superior a x=94 y x=986, y
 * baja hasta y=235 en el centro.
 */
export const BRAND_ARC = {
  // En el Figma es un CÍRCULO perfecto de 931 px, no una elipse: x=75, y=−675.
  // Su centro cae en 540.5, medio píxel a la derecha del eje de la pantalla,
  // así que se posiciona por `x` y no centrándolo.
  x: 75,
  y: -675,
  size: 931,
  borderWidth: 4,
  // El alto del logo sale solo de su proporción real (316:52); aquí solo
  // hace falta el ancho y la posición. Ver RevlonLogo.tsx.
  logo: { top: 102, width: 315.4 },
} as const

/* ─────────────────── GEOMETRÍA POR PANTALLA ────────────────── */

/**
 * Coordenadas en px de DESIGN (1080x1920), medidas sobre las maquetas.
 * Todo lo que el diseño pueda querer mover está aquí y no en el JSX.
 */
export const LAYOUT = {
  /* 01 · INICIO */
  /**
   * Todo medido en el Figma (nodo 345:19205, frame "01 - Inicio", 1080×1920).
   * Los hijos de la tarjeta van en coordenadas RELATIVAS a ella; su origen en
   * el Figma es (176, 655), así que rel = absoluto − ese origen.
   */
  start: {
    title: { x: 83, y: 388, width: 915, height: 100, fontSize: 130, letterSpacing: -0.01 },
    subtitle: { x: 138, y: 556, width: 804, height: 70, fontSize: 33, lineHeight: 1.06 },
    card: { x: 176, y: 655, width: 728, height: 922, radius: 26 },

    /* — hijos de la tarjeta, relativos a (176, 655) — */
    stepIcon: { top: 65, size: 77 },
    step1: { top: 166, fontSize: 35 },
    divider: { top: 214, inset: 96 },
    stepsRow: { top: 281, fontSize: 24, leftX: 67, leftWidth: 226, rightX: 385, rightWidth: 300 },
    swatch: { x: 87, y: 299, size: 222 },
    /** El PNG viene recto; la inclinación de la maqueta se aplica por CSS. */
    product: { x: 114, y: 319, size: 179, rotate: -24 },
    columnDivider: { x: 364, top: 281, height: 189 },
    howToIcons: { top: 366, selfieX: 415, selfieWidth: 86, selfieHeight: 112, qrX: 570, qrSize: 100 },
    shortArrow: { x: 519, y: 416, width: 41 },
    curvedArrow: { x: 555, y: 451, width: 107, height: 131 },
    phone: { x: 218, y: 543, width: 373, height: 377 },
    wallBand: { x: 20, y: 621, width: 356, height: 181 },
    wallTitle: { x: 46, y: 650, width: 222, fontSize: 27 },
    wallBody: { x: 49, y: 718, width: 240, fontSize: 20 },
    /** La rotación de −19.3° ya viene horneada en el PNG exportado. */
    lips: { x: 505, y: 772, width: 192, height: 156 },

    /* — atrezo y controles, en coordenadas de pantalla — */
    /** Son DOS revistas superpuestas, no una. */
    magazines: [
      { x: -270, y: 1798, width: 655, height: 704 },
      { x: -25, y: 1533, width: 494, height: 596 },
    ],
    board: { x: 731, y: 1345, width: 791, height: 856 },
    /**
     * Los dos textos van colocados, no en flujo: en el Figma están en
     * x=382 y x=529 (relativos a la píldora, 45 y 192) y con tamaños muy
     * distintos — el script es bastante más pequeño que la display.
     */
    pill: {
      x: 337,
      y: 1557,
      width: 406,
      height: 62,
      eligesX: 45,
      eligesY: 18,
      eligesFontSize: 36,
      taglineX: 192,
      taglineY: 15,
      taglineFontSize: 23.5,
    },
    cta: { x: 318, y: 1674, width: 444, height: 106, radius: 16, fontSize: 48 },

    /** Los cuatro haces del Figma: dos arriba-izquierda, dos abajo-derecha. */
    beams: [
      { asset: 'a', x: -55, y: -49, width: 437, height: 727 },
      { asset: 'a', x: 66, y: -378, width: 437, height: 727 },
      { asset: 'b', x: 622, y: 1121, width: 548, height: 912 },
      { asset: 'b', x: 620, y: 986, width: 548, height: 912 },
    ] as readonly BeamConfig[],

    flares: [{ x: 680, y: -10, size: 460, intensity: 2.6 }] as readonly FlareConfig[],
  },

  /* 02 · SELECCIÓN DE PALABRA */
  /** Medido en el Figma, nodo 345:19206. */
  word: {
    title: { y: 468, fontSize: 96 },
    subtitle: { y: 597, fontSize: 36 },
    /** La pista del scroll del Figma va de y=687 a y=1640. */
    list: { x: 238, y: 687, width: 604, height: 953 },
    /**
     * El diseño entregado usa UNA columna, no las tres del brief inicial.
     * Sube el número si vuelve a hacer falta la retícula.
     */
    columns: 1,
    /** 82 de alto + 48 de hueco = los 130 de paso que tiene el Figma. */
    itemHeight: 82,
    itemGap: 48,
    itemFontSize: 38,
    itemRadius: 50,
    scrollbar: { x: 868, width: 8, thumbHeight: 105 },
    bottomFade: 200,
    beams: [
      { asset: 'a', x: -211, y: -15, width: 757, height: 1261 },
      { asset: 'a', x: -1, y: -585, width: 757, height: 1261 },
    ] as readonly BeamConfig[],
    flares: [{ x: 675, y: 100, size: 440, intensity: 2.0 }] as readonly FlareConfig[],
  },

  /* 03 · TOMA DE FOTO */
  capture: {
    countdown: { centerY: 900, size: 210, fontSize: 96, ring: 5 },
    bottomBar: { top: 1440 },
    status: { top: 1490, fontSize: 40 },
    cameraIcon: { top: 1548, size: 76 },
    shutter: { x: 200, y: 1662, width: 680, height: 136, radius: 12, fontSize: 46 },
    back: { x: 60, y: 70, fontSize: 30 },
  },

  /* 04 · PROCESANDO */
  processing: {
    spinner: { centerY: 940, size: 186, thickness: 15 },
    title: { top: 1108, fontSize: 92, lineHeight: 1.04 },
  },

  /* 05 · RESULTADO */
  /** Medido en el Figma, nodo 361:19517. Esta pantalla no lleva haces. */
  result: {
    title: { x: 168, y: 335, width: 745, height: 94, fontSize: 96 },
    subtitle: { x: 208, y: 448, width: 665, height: 70, fontSize: 36, lineHeight: 1.32 },
    /**
     * Marco dorado y foto dentro. Son piezas SEPARADAS, no un borde sobre la
     * imagen: en el Figma el marco es un rectángulo mayor (376×639) y la foto
     * va dentro (333×592), de ahí el aire de ~22 px alrededor.
     *
     * El marco son dos rectángulos superpuestos (371:368 y 371:370), idénticos
     * salvo que el segundo lleva blur: no es un doble filo, es un halo — una
     * copia difuminada del mismo trazo encima del nítido. Sin ella el oro se ve
     * plano y recortado.
     */
    preview: {
      frame: { x: 354, y: 550, width: 376, height: 639, radius: 20, border: 3, glowBlur: 4.7 },
      /** Nodo "7 1" del Figma: centrado en el marco, con esquina más cerrada. */
      photo: {
        width: 333,
        height: 592,
        radius: 12,
        shadow: '14px 15px 25.1px 0px rgba(0, 0, 0, 0.25)',
      },
    },
    qr: { x: 417, y: 1249, width: 247, height: 273, radius: 24, padding: 20 },
    product: { x: 344, y: 1010, rotation: -34.8, size: 1321 },
    buttons: { x: 318, width: 444, top: 1583, height: 106, gap: 26, radius: 16, fontSize: 40 },
    beams: [] as readonly BeamConfig[],
    flares: [{ x: 30, y: 1050, size: 440, intensity: 1.8 }] as readonly FlareConfig[],
  },
} as const
