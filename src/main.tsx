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
