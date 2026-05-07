import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#124d54",
          light: "#1a6670",
          dark: "#0d3a3f",
        },
        coral: {
          DEFAULT: "#f97444",
          light: "#fba07a",
          dark: "#e55e2a",
        },
        gold: {
          DEFAULT: "#efb11d",
          light: "#f5ca5a",
          dark: "#c9920f",
        },
      },
      fontFamily: {
        display: ["var(--font-barlow-condensed)", "sans-serif"],
        sans: ["var(--font-barlow)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
