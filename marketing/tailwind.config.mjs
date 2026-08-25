/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0071e3',
          light: '#0077ed',
          dark: '#005bb5',
        },
        apple: {
          blue: '#0071e3',
          blueHover: '#0077ed',
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
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
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
