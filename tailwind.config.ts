import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#f8f6f2",
          100: "#efe9dd",
          200: "#e6dcc7",
          300: "#d4c5aa",
          400: "#b6a481",
        },
        forest: {
          950: "#101811",
          900: "#1d2a1f",
          800: "#243325",
          700: "#2f4231",
          600: "#3a513c",
          500: "#4a6a4c",
        },
        leaf: {
          50: "#effaf2",
          100: "#dcf3e2",
          200: "#b9e7c5",
          300: "#8bd39e",
          500: "#4caf6b",
          400: "#65c480",
          600: "#358e50",
          700: "#2a6f3f",
          800: "#225934",
        },
        amber: {
          500: "#f59e0b",
        },
        ember: {
          50: "#fdf2ef",
          100: "#fbe1db",
          200: "#f6c1b5",
          300: "#f09b87",
          400: "#eb7458",
          500: "#e85d3f",
          600: "#c9472d",
          700: "#a53925",
          800: "#862f22",
        },
        sky: {
          500: "#2b6cb0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
