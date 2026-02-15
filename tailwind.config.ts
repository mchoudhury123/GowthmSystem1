import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Growthm brand colors - gold/champagne on deep charcoal
        background: "var(--background)",
        foreground: "var(--foreground)",
        charcoal: {
          DEFAULT: "var(--charcoal)",
          light: "var(--charcoal-light)",
          lighter: "var(--charcoal-lighter)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          light: "var(--gold-light)",
          dark: "var(--gold-dark)",
        },
        champagne: {
          DEFAULT: "var(--champagne)",
          light: "var(--champagne-light)",
        },
        accent: {
          green: "var(--accent-green)",
          red: "var(--accent-red)",
          amber: "var(--accent-amber)",
        }
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
