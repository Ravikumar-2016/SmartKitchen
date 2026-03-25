/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        sage: {
          50:  '#f4f7f4',
          100: '#e4ece4',
          200: '#c8d9c8',
          300: '#9fbf9f',
          400: '#6f9f6f',
          500: '#4d7f4d',
          600: '#3b653b',
          700: '#2e4e2e',
          800: '#253e25',
          900: '#1a2d1a',
        },
        cream: {
          50:  '#fdfcf8',
          100: '#f9f5ec',
          200: '#f2ead6',
          300: '#e8d9b8',
          400: '#d9c28e',
        },
        rust: {
          400: '#c4714a',
          500: '#b05c35',
          600: '#8f4826',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.5s ease forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}
