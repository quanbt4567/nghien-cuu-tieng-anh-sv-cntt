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
          DEFAULT: "#f0eeed",
          card: "#ffffff",
          muted: "#e6e4e2",
          subtle: "#d8d5d2",
        },
        ink: {
          DEFAULT: "#000000",
          muted: "#3d3d3d",
          faint: "#8d8d8d",
          border: "#3d3d3d",
        },
        accent: {
          DEFAULT: "#ba2223",
          hover: "#9e1c1d",
          light: "#fbeaea",
        },
        navy: "#142161",
        smoke: "#8d8d8d",
      },
      fontFamily: {
        sans: ["var(--font-be-vietnam-pro)", "sans-serif"],
        display: ["var(--font-be-vietnam-pro)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        ipa: ["'Lucida Sans Unicode'", "'DejaVu Sans'", "'Arial Unicode MS'", "'Segoe UI'", "sans-serif"],
      },
      borderRadius: {
        card: "6px",
        "2xl": "8px",
        pill: "9999px",
      },
      boxShadow: {
        hard: "1px 1px 6px -1px rgba(0, 0, 0, 0.08)",
        soft: "1px 1px 6px -1px rgba(0, 0, 0, 0.08)",
        card: "1px 1px 6px -1px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

