import { create } from 'zustand'
import { DEFAULT_STYLE_ID, getWord, type WordOption } from '../config'

/**
 * Máquina de estados del kiosco. Sin router: la pantalla es un dato.
 *
 * Transiciones legales:
 *   start   → word
 *   word    → capture            (al elegir palabra)
 *   capture → processing         (tras la cuenta regresiva)
 *   capture → word               (volver a elegir)
 *   processing → result | capture(error)
 *   result  → capture            ("TOMAR DE NUEVO")
 *   *       → start              (FINALIZAR / inactividad / reset)
 *
 * Higiene de memoria: el kiosco debe aguantar 300+ ciclos. Todo recurso
 * pesado (ImageBitmap, object URL) se libera en `releaseSession`, que corre en
 * cada reset y en cada retoma. Nada sobrevive a un ciclo.
 */

export type Screen = 'start' | 'word' | 'capture' | 'processing' | 'result'

export type CapturedFrame = {
  /** Frame recortado ya al aspecto de la pieza de exportación. */
  bitmap: ImageBitmap
  width: number
  height: number
}

export type ComposedPiece = {
  blob: Blob
  /** Object URL creado a partir del blob. Se revoca al soltar la sesión. */
  objectUrl: string
  /** Enlace que codifica el QR (hoy lo produce el stub de subida). */
  downloadUrl: string
}

type KioskState = {
  screen: Screen
  selectedWordId: string | null
  styleId: string
  captured: CapturedFrame | null
  piece: ComposedPiece | null
  error: string | null
  /** Contador de sesiones completadas; útil para depurar fugas en feria. */
  cycleCount: number

  /* selectores derivados */
  selectedWord: () => WordOption | null

  /* transiciones */
  goToWordSelection: () => void
  selectWord: (id: string) => void
  backToWords: () => void
  setCaptured: (frame: CapturedFrame) => void
  startProcessing: () => void
  setPiece: (piece: ComposedPiece) => void
  fail: (message: string) => void
  retake: () => void
  reset: () => void
}

/** Libera bitmaps y object URLs de la sesión en curso. */
function releaseSession(state: Pick<KioskState, 'captured' | 'piece'>) {
  state.captured?.bitmap.close()
  if (state.piece) URL.revokeObjectURL(state.piece.objectUrl)
}

export const useKioskStore = create<KioskState>((set, get) => ({
  screen: 'start',
  selectedWordId: null,
  styleId: DEFAULT_STYLE_ID,
  captured: null,
  piece: null,
  error: null,
  cycleCount: 0,

  selectedWord: () => getWord(get().selectedWordId),

  goToWordSelection: () => set({ screen: 'word', error: null }),

  selectWord: (id) => {
    const word = getWord(id)
    if (!word) return
    set({
      selectedWordId: id,
      styleId: word.styleId ?? DEFAULT_STYLE_ID,
      screen: 'capture',
      error: null,
    })
  },

  backToWords: () => {
    const { captured } = get()
    captured?.bitmap.close()
    set({ captured: null, screen: 'word', error: null })
  },

  setCaptured: (frame) => {
    // Una retoma rápida puede dejar un frame anterior colgando.
    get().captured?.bitmap.close()
    set({ captured: frame })
  },

  startProcessing: () => set({ screen: 'processing', error: null }),

  setPiece: (piece) => {
    const previous = get().piece
    if (previous) URL.revokeObjectURL(previous.objectUrl)
    set({ piece, screen: 'result', error: null })
  },

  fail: (message) => set({ error: message, screen: 'capture' }),

  retake: () => {
    const state = get()
    releaseSession(state)
    set({ captured: null, piece: null, screen: 'capture', error: null })
  },

  reset: () => {
    const state = get()
    releaseSession(state)
    set({
      screen: 'start',
      selectedWordId: null,
      styleId: DEFAULT_STYLE_ID,
      captured: null,
      piece: null,
      error: null,
      cycleCount: state.cycleCount + 1,
    })
  },
}))
