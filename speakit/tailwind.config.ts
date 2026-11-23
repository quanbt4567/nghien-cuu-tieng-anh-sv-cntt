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
          DEFAULT: "#F8FAFC",
          card: "#FFFFFF",
          muted: "#F1F5F9",
          subtle: "#E2E8F0",
        },
        ink: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          faint: "#64748B",
          border: "#E2E8F0",
        },
        accent: {
          DEFAULT: "#1D4ED8",
          hover: "#1E40AF",
          light: "#EFF6FF",
        },
        coral: {
          DEFAULT: "#DC2626",
          hover: "#B91C1C",
          light: "#FEF2F2",
        },
        navy: "#1E3A8A",
        smoke: "#475569",
      },
      fontFamily: {
        sans: ["var(--font-be-vietnam-pro)", "var(--font-plus-jakarta)", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-be-vietnam-pro)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        ipa: ["'Lucida Sans Unicode'", "'DejaVu Sans'", "'Arial Unicode MS'", "'Segoe UI'", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        "2xl": "16px",
        pill: "9999px",
      },
      boxShadow: {
        hard: "0 1px 3px 0 rgba(15, 23, 42, 0.08)",
        soft: "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        card: "none",
      },
    },
  },
  plugins: [],
};

export default config;
