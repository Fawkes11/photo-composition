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
  try {
    return await create(DETECTION.delegate)
  } catch (error) {
    if (DETECTION.delegate === 'CPU') throw error
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
 * Precalienta wasm y modelos. Se dispara desde la pantalla 01 para que la
 * cámara no tenga que esperar la descarga del modelo con el usuario delante.
 */
export function warmUpVision(): void {
  void loadFaceDetector().catch((e) => console.warn('[vision] precarga del detector falló', e))
  void loadSegmenter().catch((e) => console.warn('[vision] precarga del segmentador falló', e))
}
