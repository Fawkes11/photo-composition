import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useKioskStore } from './store/kioskStore'
import './index.css'

// En desarrollo se expone la máquina de estados para poder saltar de pantalla
// desde la consola (o desde dev/shots.mjs) sin recorrer el flujo entero.
if (import.meta.env.DEV) {
  ;(window as unknown as { __kiosk: typeof useKioskStore }).__kiosk = useKioskStore
}

const container = document.getElementById('root')
if (!container) throw new Error('Falta #root en index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
