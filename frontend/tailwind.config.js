/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        paper: '#EDEAE1',
        ink: '#1B1B1B',
        'ink-soft': '#4A4A46',
        teal: '#2F5D62',
        rule: '#D8D3C6'
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif']
      }
    }
  },
  plugins: []
};
