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
        // Apple HIG System Colors
        apple: {
          blue: '#0071e3',
          blueHover: '#0077ED',
          green: '#34c759',
          indigo: '#5856d6',
          orange: '#ff9500',
          pink: '#ff2d55',
          purple: '#af52de',
          red: '#ff3b30',
          teal: '#59adc4',
          yellow: '#ffcc00',
          gray: '#8e8e93',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', 'ui-sans-serif', 'system-ui'],
        apple: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '36px',
      },
      boxShadow: {
        'apple-subtle': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'apple-card': '0 4px 24px rgba(0, 0, 0, 0.06)',
        'apple-elevated': '0 12px 32px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}

export default config
