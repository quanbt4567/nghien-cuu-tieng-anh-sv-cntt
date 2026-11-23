import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#050811",
          card: "rgba(255, 255, 255, 0.06)",
          muted: "rgba(255, 255, 255, 0.10)",
          subtle: "rgba(255, 255, 255, 0.16)",
        },
        ink: {
          DEFAULT: "#F8FAFC",
          muted: "#94A3B8",
          faint: "#64748B",
          border: "rgba(255, 255, 255, 0.18)",
        },
        accent: {
          DEFAULT: "#06B6D4",
          hover: "#22D3EE",
          light: "rgba(6, 182, 212, 0.18)",
        },
        navy: "#1E3A8A",
        smoke: "#94A3B8",
      },
      fontFamily: {
        sans: ["var(--font-be-vietnam-pro)", "sans-serif"],
        display: ["var(--font-be-vietnam-pro)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        ipa: ["'Lucida Sans Unicode'", "'DejaVu Sans'", "'Arial Unicode MS'", "'Segoe UI'", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        "2xl": "24px",
        pill: "9999px",
      },
      boxShadow: {
        hard: "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.22)",
        soft: "0 6px 24px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.18)",
        card: "0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.24)",
      },
    },
  },
  plugins: [],
};

export default config;
