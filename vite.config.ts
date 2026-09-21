import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const configuredBase = process.env.VITE_BASE_PATH || '/'
const appBase = configuredBase.endsWith('/') ? configuredBase : configuredBase + '/'

export default defineConfig({
  base: appBase,
  plugins: [
    react(),
    VitePWA({
      // 'prompt' lets our PwaBanner control when the SW activates and
      // when the user is told about offline-ready / new-content events.
      registerType: 'prompt',
      injectRegister: null, // we register manually via src/pwa.ts

      // Use our hand-written service worker (injectManifest strategy).
      // Vite-plugin-pwa will inject self.__WB_MANIFEST into it at build time.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        swSrc: 'src/sw.ts',
        swDest: 'dist/sw.js',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Ensure the offline page HTML is included in the precache manifest
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
      },

      manifest: {
        name: 'Shoreline Care Center',
        short_name: 'Shoreline',
        description: 'Dietary & operations management for Shoreline Care Center',
        theme_color: '#2563a8',
        background_color: '#0d1b2a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: appBase,
        scope: appBase,
        id: appBase,
        icons: [
          {
            src: `${appBase}icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: `${appBase}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: `${appBase}apple-touch-icon.png`,
            sizes: '180x180',
            type: 'image/png',
          },
        ],
        shortcuts: [
          {
            name: "Today's Menu",
            short_name: 'Menu',
            url: `${appBase}menu`,
            description: "View today's menu",
          },
          {
            name: 'Residents',
            short_name: 'Residents',
            url: `${appBase}residents`,
            description: 'Resident diet profiles',
          },
          {
            name: 'Production',
            short_name: 'Production',
            url: `${appBase}production`,
            description: 'Meal production & service',
          },
        ],
        // Screenshots improve the install dialog on Chrome/Edge
        screenshots: [],
      },

      devOptions: {
        enabled: false,   // Disable SW in dev — prevents workbox from caching stale bundles
        type: 'module',
        navigateFallback: appBase,
      },
    }),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    port: 5180,
    strictPort: false,
    hmr: false,   // Disable HMR — Electron's renderer blocks the WS upgrade (HTTP 400)
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
