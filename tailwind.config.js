/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF',
        'bg-soft': '#FAFAFA',
        ink: {
          900: '#1A1A1A',
          700: '#3A3A3A',
          500: '#6B7280'
        },
        line: {
          200: '#ECECEC',
          100: '#F3F3F3'
        },
        accent: {
          50: '#FFFBEC',
          100: '#FFF6D6',
          400: '#F0C63A',
          500: '#E4B200',
          600: '#D9A400'
        },
        success: { 500: '#2DBE7E' },
        danger: { 500: '#E05656' },
        warning: { 500: '#F2A93B' }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'Times', 'serif'],
        ui: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '16px',
        ctl: '12px',
        pill: '999px'
      },
      boxShadow: {
        card: '0 8px 24px rgba(10,10,10,0.06)',
        pop: '0 12px 32px rgba(10,10,10,0.10)',
        none: 'none'
      },
      transitionTimingFunction: {
        shabe: 'cubic-bezier(.2,.7,.2,1)'
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}