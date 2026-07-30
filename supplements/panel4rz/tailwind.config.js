/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#ad0000',
          'red-hover': '#900000',
          'red-light': '#fdf2f2',
          black: '#111827',
          gray: '#6b7280',
          light: '#f9fafb'
        }
      }
    },
  },
  plugins: [],
}
