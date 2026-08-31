/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f8fafc', 950: '#0a0a0f',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
      },
    },
  },
  plugins: [],
}