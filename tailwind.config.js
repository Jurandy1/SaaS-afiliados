/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sidebar: "#0B1220",
        brand: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          900: "#134e4a",
        },
        shopee: { 500: "#ee4d2d", 600: "#d73211" },
        meta: { 500: "#0081fb", 600: "#0066c8" },
        pinterest: { 500: "#e60023", 600: "#ad001a" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
