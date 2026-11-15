"use client";

import type { CSSProperties } from "react";
import "./cosmetics.css";

export interface FullPageProfileEffectProps {
  themeId?: string | null;
}

const METEOR_STREAKS = [
  { left: "15%", top: "-5%", duration: "3.8s", delay: "0s" },
  { left: "34%", top: "-8%", duration: "4.6s", delay: "1.1s" },
  { left: "52%", top: "-6%", duration: "3.4s", delay: "0.5s" },
  { left: "70%", top: "-10%", duration: "4.9s", delay: "1.8s" },
  { left: "86%", top: "-4%", duration: "4.1s", delay: "2.4s" },
  { left: "96%", top: "-12%", duration: "3.7s", delay: "0.8s" },
];

const MATRIX_COLUMNS = [
  { left: "5%", duration: "6.4s", delay: "0s", glyphs: "0 1 1 0 1 0 0 1 1 0 1 1" },
  { left: "14%", duration: "7.8s", delay: "1.2s", glyphs: "1 0 0 1 0 1 1 0 1 0 0 1" },
  { left: "26%", duration: "5.9s", delay: "0.4s", glyphs: "0 1 0 1 1 1 0 0 1 1 0 1" },
  { left: "39%", duration: "8.2s", delay: "2.1s", glyphs: "1 1 0 0 1 0 1 1 0 1 0 0" },
  { left: "54%", duration: "6.7s", delay: "0.9s", glyphs: "0 0 1 1 0 1 0 1 1 0 1 0" },
  { left: "68%", duration: "7.3s", delay: "1.6s", glyphs: "1 0 1 0 1 1 0 0 1 0 1 1" },
  { left: "81%", duration: "6.1s", delay: "2.5s", glyphs: "0 1 1 0 0 1 1 0 0 1 1 0" },
  { left: "92%", duration: "7.5s", delay: "0.7s", glyphs: "1 0 0 1 1 0 1 0 1 1 0 1" },
];

export function FullPageProfileEffect({ themeId }: FullPageProfileEffectProps) {
  if (!themeId) return null;

  if (themeId === "theme-neon-meteor-shower") {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden cosmetic-theme-meteor-shower"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.05] via-transparent to-amber-500/[0.06]" />
        {METEOR_STREAKS.map((streak, index) => (
          <span
            key={index}
            className="cosmetic-meteor-streak absolute w-[2px] h-28 rounded-full bg-gradient-to-b from-accent/80 via-amber-400/50 to-transparent"
            style={
              {
                left: streak.left,
                top: streak.top,
                "--meteor-duration": streak.duration,
                "--meteor-delay": streak.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>
    );
  }

  if (themeId === "theme-digital-matrix-rain") {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden cosmetic-theme-matrix-rain"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.05] via-transparent to-emerald-700/[0.05]" />
        {MATRIX_COLUMNS.map((col, index) => (
          <div
            key={index}
            className="cosmetic-matrix-col absolute top-0 w-4 text-[11px] font-mono font-bold leading-5 text-emerald-600/25 select-none whitespace-pre-wrap text-center"
            style={
              {
                left: col.left,
                "--col-duration": col.duration,
                "--col-delay": col.delay,
              } as CSSProperties
            }
          >
            {col.glyphs.split(" ").join("\n")}
          </div>
        ))}
      </div>
    );
  }

  if (themeId === "theme-aurora-cyber-grid") {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden cosmetic-theme-aurora-grid"
      >
        <div
          className="cosmetic-aurora-layer absolute -inset-12 opacity-60"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, rgba(13, 148, 136, 0.14), transparent 45%), radial-gradient(circle at 80% 30%, rgba(217, 119, 6, 0.12), transparent 42%)",
          }}
        />
        <div className="cosmetic-grid-plane absolute inset-0 opacity-65" />
      </div>
    );
  }

  if (themeId === "theme-electric-storm-surge") {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden cosmetic-theme-electric-storm"
      >
        <div
          className="cosmetic-storm-arc absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 18% 15%, rgba(202, 138, 4, 0.16), transparent 42%), radial-gradient(circle at 84% 75%, rgba(2, 132, 199, 0.14), transparent 45%)",
          }}
        />
        <svg
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
          className="cosmetic-storm-arc absolute inset-0 w-full h-full opacity-30"
        >
          <polyline
            points="120,0 165,140 130,170 210,320"
            fill="none"
            stroke="#CA8A04"
            strokeWidth="2"
          />
          <polyline
            points="1020,0 970,130 1010,165 940,340"
            fill="none"
            stroke="#0284C7"
            strokeWidth="2"
          />
        </svg>
      </div>
    );
  }

  return null;
}
