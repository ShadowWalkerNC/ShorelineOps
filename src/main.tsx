import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './security/AuthContext'
import { DeviceProvider } from './hooks/useDevice'
import './pwa'
import './index.css'
import './styles/stitch-system.css'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import { installDemoNetworkBoundary } from './demo/networkBoundary'

// Demo-only raw-fetch boundary (compile-time gated): install before React
// renders and AuthProvider mounts so no raw fetch in kitchen/admin/setup/
// scanners can transmit live credentials in the public demo. Vite statically
// inlines `import.meta.env.VITE_DEMO_MODE`, so live builds eliminate this
// branch entirely. Deliberately NOT gated on DEV alone: local dev against a
// real backend must keep working, and only the demo build blocks API access.
if (import.meta.env.VITE_DEMO_MODE === 'true') {
  installDemoNetworkBoundary({
    scope: globalThis,
    demoMode: import.meta.env.VITE_DEMO_MODE,
    apiUrl: import.meta.env.VITE_API_URL,
  })
}

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

