"use client";

import type { ReactNode } from "react";
import "./cosmetics.css";

export interface LeaderboardRowWrapperProps {
  fxId?: string | null;
  nameplateId?: string | null;
  className?: string;
  children: ReactNode;
}

function getFxContainerClass(fxId?: string | null): string {
  switch (fxId) {
    case "lb-border-beam-sweep":
      return "cosmetic-lb-border-beam border-accent/40";
    case "lb-royal-gold-shimmer":
      return "cosmetic-lb-gold-shimmer border-amber-400/70";
    case "lb-hologram-glitch":
      return "cosmetic-lb-hologram-glitch border-sky-500/60";
    case "lb-inferno-rank-aura":
      return "cosmetic-lb-inferno-aura border-orange-500/70";
    default:
      return "";
  }
}

function getNameplateClass(nameplateId?: string | null): string {
  switch (nameplateId) {
    case "nameplate-mesh-nebula":
      return "cosmetic-nameplate-mesh-nebula";
    case "nameplate-terminal-pulse":
      return "cosmetic-nameplate-terminal-pulse";
    case "nameplate-supernova-gold":
      return "cosmetic-nameplate-supernova-gold";
    case "nameplate-cyber-glitch":
      return "cosmetic-nameplate-cyber-glitch";
    default:
      return "";
  }
}

export function LeaderboardRowWrapper({
  fxId,
  nameplateId,
  className = "",
  children,
}: LeaderboardRowWrapperProps) {
  const fxClass = getFxContainerClass(fxId);
  const nameplateClass = getNameplateClass(nameplateId);

  return (
    <div className={`relative rounded-xl ${fxClass} ${nameplateClass} ${className}`.trim()}>
      {fxId === "lb-border-beam-sweep" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[1px] rounded-xl overflow-hidden z-0"
        >
          <span
            className="cosmetic-lb-border-beam-rotator absolute -inset-[120%]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, rgba(229, 72, 77, 0.7) 45deg, transparent 90deg, transparent 360deg)",
            }}
          />
          <span className="absolute inset-[1.5px] rounded-[11px] bg-white/95" />
        </span>
      )}

      {fxId === "lb-royal-gold-shimmer" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl z-0"
        >
          <span className="cosmetic-lb-gold-shimmer-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-amber-300/35 to-transparent" />
        </span>
      )}

      {fxId === "lb-hologram-glitch" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl z-0"
        >
          <span className="cosmetic-lb-hologram-scan absolute inset-x-0 h-5 bg-gradient-to-b from-transparent via-sky-400/20 to-transparent" />
        </span>
      )}

      {nameplateId === "nameplate-terminal-pulse" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 right-2.5 inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 z-10"
        >
          <span>$</span>
          <span className="cosmetic-nameplate-terminal-cursor inline-block w-1.5 h-3 bg-emerald-600" />
        </span>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
