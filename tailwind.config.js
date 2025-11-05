/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6fbff',
          100: '#e9f4ff',
          200: '#cfe7ff',
          300: '#a8d2ff',
          400: '#78b6ff',
          500: '#4d9aff',
          600: '#2f77ea',
          700: '#235fbe',
          800: '#1f4f9b',
          900: '#1d447f',
        }
      },
      boxShadow: {
        'glass': '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(15,23,42,0.12)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
