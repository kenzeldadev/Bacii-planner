/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', '"Noto Sans Khmer"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
