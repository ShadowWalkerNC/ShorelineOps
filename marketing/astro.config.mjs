import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    preview: {
      // Railway probes the container with an internal Host header.
      allowedHosts: true,
    },
  },
})
