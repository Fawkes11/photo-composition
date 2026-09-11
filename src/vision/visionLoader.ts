import { FaceDetector, FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import { DETECTION } from '../config'

/** El paquete no exporta el tipo del fileset, así que se deriva de la fábrica. */
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

/**
 * Carga de MediaPipe, todo desde /public: el wasm en /mediapipe/wasm y los
 * modelos en /models. Una vez cargada la página no se toca la red.
 *
 * Los detectores son singleton a propósito. Crear y cerrar un FaceDetector en
 * cada entrada a la pantalla de cámara significa reservar y liberar el heap del
 * wasm 300 veces por jornada; el heap de Emscripten no se devuelve al sistema y
 * la pestaña crece. Se crean una vez, se reutilizan en todos los ciclos y no se
 * cierran nunca mientras el kiosco esté abierto.
 */

let filesetPromise: Promise<WasmFileset> | null = null
let facePromise: Promise<FaceDetector> | null = null
let segmenterPromise: Promise<ImageSegmenter> | null = null

/**
 * Delegate impuesto tras detectar que la GPU devuelve basura.
 *
 * `withDelegateFallback` solo cubre el caso en que CREAR el segmentador lanza.
 * Hay GPUs que lo crean sin protestar, ejecutan la inferencia sin protestar, y
 * devuelven una máscara entera de ceros. Medido en un Samsung A56 (Xclipse 540
 * sobre Vulkan): segmentador cargado en 153 ms, inferencia en 457 ms, y
 * confianza 0.00 dentro y fuera de la figura.
 *
 * No hay excepción que capturar, así que el fallo tiene que detectarse por el
 * RESULTADO. De eso se encarga `segmentPerson`, que llama aquí cuando lo ve.
 */
let forcedDelegate: 'GPU' | 'CPU' | null = null

function getFileset(): Promise<WasmFileset> {
  filesetPromise ??= FilesetResolver.forVisionTasks(DETECTION.wasmPath)
  return filesetPromise
}

/**
 * Intenta con el delegate configurado (GPU por defecto) y, si el driver del
 * equipo no coopera, reintenta en CPU. Un kiosco no puede quedarse en negro
 * porque la máquina que tocó tiene una integrada rara.
 */
async function withDelegateFallback<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  const preferido = forcedDelegate ?? DETECTION.delegate
  try {
    return await create(preferido)
  } catch (error) {
    if (preferido === 'CPU') throw error
    console.warn('[vision] delegate GPU no disponible, se reintenta en CPU', error)
    return create('CPU')
  }
}

export function loadFaceDetector(): Promise<FaceDetector> {
  facePromise ??= (async () => {
    const fileset = await getFileset()
    return withDelegateFallback((delegate) =>
      FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: DETECTION.faceModelPath, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: DETECTION.minDetectionConfidence,
      }),
    )
  })().catch((error) => {
    // No cachear el fallo: el siguiente intento debe poder recuperarse.
    facePromise = null
    throw error
  })
  return facePromise
}

export function loadSegmenter(): Promise<ImageSegmenter> {
  segmenterPromise ??= (async () => {
    const fileset = await getFileset()
    return withDelegateFallback((delegate) =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: DETECTION.segmenterModelPath, delegate },
        runningMode: 'IMAGE',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }),
    )
  })().catch((error) => {
    segmenterPromise = null
    throw error
  })
  return segmenterPromise
}

/**
 * Reconstruye el segmentador en CPU y lo deja fijado ahí para el resto de la
 * sesión.
 *
 * Lo llama `segmentPerson` cuando detecta que la máscara es degenerada. Es más
 * lento que la GPU, pero un kiosco que entrega piezas sin persona durante tres
 * semanas —sin un solo error en consola que lo delate— es mucho peor que uno
 * que tarda un poco más.
 */
export async function forceSegmenterOnCpu(): Promise<ImageSegmenter> {
  forcedDelegate = 'CPU'
  segmenterPromise = null
  console.warn('[vision] la GPU devolvió una máscara inválida; se reconstruye el segmentador en CPU')
  return loadSegmenter()
}

/** Delegate con el que se está corriendo ahora mismo. Para el diagnóstico. */
export function currentDelegate(): 'GPU' | 'CPU' {
  return forcedDelegate ?? DETECTION.delegate
}

/**
 * Precalienta wasm y modelos. Se dispara desde la pantalla 01 para que la
 * cámara no tenga que esperar la descarga del modelo con el usuario delante.
 */
export function warmUpVision(): void {
  void loadFaceDetector().catch((e) => console.warn('[vision] precarga del detector falló', e))
  void loadSegmenter().catch((e) => console.warn('[vision] precarga del segmentador falló', e))
}
