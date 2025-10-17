/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#ecf8ff",
          100: "#d6ecff",
          200: "#add9ff",
          300: "#85c6ff",
          400: "#5cb3ff",
          500: "#339fff",
          600: "#0b80e6",
          700: "#0663b3",
          800: "#024580",
          900: "#00274d"
        }
      }
    }
  },
  plugins: []
};
