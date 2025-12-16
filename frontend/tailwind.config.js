/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#0d3320',
          800: '#082615',
          900: '#05170d',
          950: '#020a05'
        },
        accent: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a'
        }
      }
    }
  },
  plugins: []
};
