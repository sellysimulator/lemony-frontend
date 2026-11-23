import './api/socketHandlers'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { BackendStatusProvider } from './contexts/BackendStatusContext'
import AlertContainer from './components/shared/AlertContainer'
import ErrorBoundary from './components/shared/ErrorBoundary'

// After a deploy, an open tab may request chunk files that no longer exist. Reload once.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('vite_preload_reloaded')) return
    sessionStorage.setItem('vite_preload_reloaded', '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BackendStatusProvider>
          <BrowserRouter>
            <AlertContainer />
            <App />
          </BrowserRouter>
        </BackendStatusProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
