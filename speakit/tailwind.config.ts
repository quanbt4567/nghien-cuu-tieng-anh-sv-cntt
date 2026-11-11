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
        paper: {
          DEFAULT: "#FAF6EF",
          card: "#FFFFFF",
          muted: "#F0EADF",
          subtle: "#E6DEC8",
        },
        ink: {
          DEFAULT: "#1A1714",
          muted: "#59534C",
          faint: "#8C8377",
          border: "#1A1714",
        },
        accent: {
          DEFAULT: "#E5484D",
          hover: "#DC3D43",
          light: "#FFE5E5",
        },
      },
      fontFamily: {
        sans: ["var(--font-be-vietnam-pro)", "sans-serif"],
        display: ["var(--font-be-vietnam-pro)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        card: "16px",
        "2xl": "16px",
        pill: "9999px",
      },
      boxShadow: {
        hard: "4px 4px 0px #1A1714",
        "hard-sm": "2px 2px 0px #1A1714",
        "hard-lg": "6px 6px 0px #1A1714",
        "hard-press": "1px 1px 0px #1A1714",
      },
    },
  },
  plugins: [],
};

export default config;

