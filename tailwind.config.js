/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#FDFCFB',
          100: '#F8F6F2',
          200: '#EFECE6',
          300: '#E0DDD5',
          400: '#C7C2B8',
          500: '#9E988D',
          600: '#736E64',
          700: '#524E46',
          800: '#33302B',
          900: '#1C1A17',
          950: '#11100E',
        },
        brand: {
          50: '#FBF5F1',
          100: '#F5E8E0',
          200: '#EBCDC0',
          300: '#DCAB97',
          400: '#CB7F64',
          500: '#B85834',
          600: '#A44222',
          700: '#87341B',
          800: '#6E2D1A',
          900: '#5A2618',
          950: '#31110B',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        serif: [
          'Newsreader',
          'Georgia',
          'Cambria',
          'serif',
        ],
      },
    },
  },
  plugins: [],
}
