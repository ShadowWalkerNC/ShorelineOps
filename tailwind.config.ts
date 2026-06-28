import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Shoreline brand tokens — update to match v4 palette
        primary: {
          DEFAULT: '#0f766e',  // teal-700
          light: '#14b8a6',    // teal-500
          dark: '#134e4a',     // teal-900
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}

export default config
