/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#edf7f2',
          100: '#d3ebdf',
          200: '#a8d7c1',
          300: '#78bd9f',
          400: '#4fa17f',
          500: '#348568',
          600: '#256a53',
          700: '#1d5544',
          800: '#174437',
          900: '#12362c',
        },
      },
    },
  },
  plugins: [],
};
