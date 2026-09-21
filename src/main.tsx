import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './security/AuthContext'
import { DeviceProvider } from './hooks/useDevice'
import './pwa'
import './index.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'

// React Router v7 requires basenames without trailing slashes to match routes cleanly
const rawBase = import.meta.env.BASE_URL || '/'
const basename = rawBase.length > 1 && rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <DeviceProvider>
          <AppErrorBoundary><App /></AppErrorBoundary>
        </DeviceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)

