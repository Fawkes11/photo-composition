import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  /**
   * Base del despliegue.
   *
   * En local queda en '/'. Para un GitHub Pages de proyecto la app cuelga de
   * '/<repo>/', y el workflow pasa esa ruta en VITE_BASE. Esto reescribe el
   * index.html y los assets empaquetados; las rutas que se piden en tiempo de
   * ejecución (modelos, wasm, PNG, fuentes) las resuelve el helper `asset()`
   * de src/config.ts a partir de import.meta.env.BASE_URL.
   */
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    // El kiosco corre en localhost; si se sirve por IP hace falta HTTPS para getUserMedia.
    port: 5173,
  },
  build: {
    // Los .tflite y el wasm viven en /public y se copian tal cual.
    assetsInlineLimit: 0,
  },
})
