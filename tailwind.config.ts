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
        },
        forest: {
          900: "#1d2a1f",
          800: "#243325",
          700: "#2f4231",
          600: "#3a513c",
          500: "#4a6a4c",
        },
        leaf: {
          500: "#4caf6b",
          400: "#65c480",
        },
        amber: {
          500: "#f59e0b",
        },
        ember: {
          500: "#e85d3f",
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
