import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './security/AuthContext'
import { DeviceProvider } from './hooks/useDevice'
import './pwa'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DeviceProvider>
          <App />
        </DeviceProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)

