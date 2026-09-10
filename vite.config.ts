import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
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
    rollupOptions: {
      // Segunda entrada: la pagina de diagnostico, para abrirla EN el
      // dispositivo que falle. Va aparte del bundle del kiosco, asi que no
      // pesa en el arranque de la app.
      input: {
        index: resolve(__dirname, 'index.html'),
        diagnostico: resolve(__dirname, 'diagnostico.html'),
      },
    },
  },
})
