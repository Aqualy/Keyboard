import '@fontsource-variable/geist/index.css'
import '@fontsource-variable/geist-mono/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { detectRegion } from './data/detectRegion'
import { prefetchBoard } from './scene/assets'
import { applyDetectedRegion, currentLayout } from './state/config'

// The region decides the model (ANSI or ISO), so it is settled before the board loads, not swapped after.
void detectRegion()
  .catch(() => undefined)
  .then((region) => {
    applyDetectedRegion(region)
    // Downloads start now, alongside the 3D code, instead of after it.
    prefetchBoard(currentLayout().id)
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
