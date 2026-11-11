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
        ipa: ["'Lucida Sans Unicode'", "'DejaVu Sans'", "'Arial Unicode MS'", "'Segoe UI'", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        "2xl": "16px",
        pill: "9999px",
      },
      boxShadow: {
        hard: "0 4px 18px -2px rgba(26, 23, 20, 0.08), 0 2px 6px -1px rgba(26, 23, 20, 0.04)",
        soft: "0 4px 20px -2px rgba(26, 23, 20, 0.06), 0 2px 6px -1px rgba(26, 23, 20, 0.03)",
        card: "0 4px 24px -2px rgba(26, 23, 20, 0.07), 0 2px 8px -1px rgba(26, 23, 20, 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;

