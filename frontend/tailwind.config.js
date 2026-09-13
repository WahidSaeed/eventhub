/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      // Mirrors the custom properties in src/assets/main.css.
      colors: {
        canvas: '#f4f5f6',
        ink: {
          DEFAULT: '#131517',
          2: '#737577',
          3: '#b3b5b7'
        },
        line: 'rgba(19, 21, 23, 0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif']
      }
    }
  },
  plugins: []
};
